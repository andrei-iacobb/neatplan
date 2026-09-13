import type { DigestContent, DigestRow } from './build'

/**
 * The digest email.
 *
 * Table-based and inline-styled because that is what mail clients render. No
 * external stylesheet, no web font, no image carrying information - Outlook
 * blocks images by default and a digest whose numbers live in a PNG is a blank
 * email to half its readers.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'numeric',
    year: 'numeric',
    weekday: 'short',
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${MONTHS[Number(get('month')) - 1] ?? ''}`
}

function lateLabel(row: DigestRow): string {
  if (row.daysLate <= 0) return ''
  if (row.daysLate === 1) return '1 day late'
  return `${row.daysLate} days late`
}

function rowsTable(rows: DigestRow[], timeZone: string, showLate: boolean): string {
  if (rows.length === 0) return ''

  const body = rows
    .map(
      (row) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e6e6ec;font-size:14px;color:#111118;">
          <strong>${escapeHtml(row.name)}</strong>
          ${row.place ? `<span style="color:#6e6e85;"> &middot; ${escapeHtml(row.place)}</span>` : ''}
          <div style="color:#6e6e85;font-size:12px;">${escapeHtml(row.schedule)}</div>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e6e6ec;font-size:13px;color:#44444f;white-space:nowrap;" align="right">
          ${escapeHtml(formatDay(row.due, timeZone))}
          ${showLate ? `<div style="color:#c5292a;font-size:12px;font-weight:600;">${escapeHtml(lateLabel(row))}</div>` : ''}
        </td>
      </tr>`
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">${body}</table>`
}

function section(title: string, count: number, tone: 'bad' | 'plain', inner: string): string {
  if (!inner) return ''
  const colour = tone === 'bad' ? '#c5292a' : '#111118'
  return `
    <div style="margin-top:24px;">
      <h2 style="margin:0;font-size:15px;color:${colour};">
        ${escapeHtml(title)} <span style="color:#6e6e85;font-weight:400;">(${count})</span>
      </h2>
      ${inner}
    </div>`
}

export interface RenderedDigest {
  subject: string
  html: string
  text: string
}

export function renderDigest(content: DigestContent, appUrl: string | null): RenderedDigest {
  const { overdue, due, siteName, timeZone } = content

  const weekLabel = `${formatDay(content.week.start, timeZone)} to ${formatDay(
    new Date(content.week.end.getTime() - 1),
    timeZone
  )}`

  // The subject carries the number, because that is all most people read.
  const subject =
    overdue.length > 0
      ? `${siteName}: ${overdue.length} overdue, ${due.length} due this week`
      : `${siteName}: ${due.length} due this week`

  const link = appUrl
    ? `<p style="margin-top:24px;">
         <a href="${escapeHtml(appUrl)}/diary" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Open the diary</a>
       </p>`
    : ''

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111118;">
  <p style="margin:0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6e6e85;font-weight:700;">NeatPlan &middot; weekly digest</p>
  <h1 style="margin:6px 0 0;font-size:22px;letter-spacing:-0.02em;">${escapeHtml(siteName)}</h1>
  <p style="margin:4px 0 0;color:#6e6e85;font-size:14px;">${escapeHtml(weekLabel)}</p>

  ${section('Overdue', overdue.length, 'bad', rowsTable(overdue, timeZone, true))}
  ${section('Due this week', due.length, 'plain', rowsTable(due, timeZone, false))}

  ${
    overdue.length === 0 && due.length === 0
      ? `<p style="margin-top:24px;font-size:15px;">Nothing is overdue and nothing falls due this week. ${
          content.completedLastWeek > 0
            ? `${content.completedLastWeek} ${content.completedLastWeek === 1 ? 'clean was' : 'cleans were'} signed off last week.`
            : ''
        }</p>`
      : `<p style="margin-top:24px;font-size:13px;color:#6e6e85;">${content.completedLastWeek} ${
          content.completedLastWeek === 1 ? 'clean was' : 'cleans were'
        } signed off last week.</p>`
  }

  ${
    content.truncated
      ? `<p style="margin-top:16px;padding:10px 12px;border-left:3px solid #111118;background:#f4f6fa;font-size:13px;">This is the start of a longer list. Open the diary to see everything.</p>`
      : ''
  }

  ${link}

  <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e6e6ec;font-size:12px;color:#6e6e85;">
    You receive this because the weekly digest is switched on for your account. Turn it off under
    Settings, Notifications.
  </p>
</div>`

  // A plain-text alternative, so a client that refuses HTML still shows
  // something a person can act on.
  const textLines = [
    `NeatPlan weekly digest - ${siteName}`,
    weekLabel,
    '',
    `Overdue: ${overdue.length}`,
    ...overdue.slice(0, 20).map((row) => `  - ${row.name} - ${row.schedule} - ${lateLabel(row)}`),
    '',
    `Due this week: ${due.length}`,
    ...due.slice(0, 20).map((row) => `  - ${row.name} - ${row.schedule} - ${formatDay(row.due, timeZone)}`),
    '',
    `${content.completedLastWeek} signed off last week.`,
    appUrl ? `\nOpen the diary: ${appUrl}/diary` : '',
    '',
    'Turn this off under Settings, Notifications.',
  ]

  return { subject, html, text: textLines.join('\n') }
}
