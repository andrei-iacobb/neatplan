export interface RoomScheduleTaskInput {
  id: string
  description: string
  frequency?: string | null
  additionalNotes?: string | null
}

export interface RoomScheduleInput {
  id: string
  title: string
  frequency: string
  nextDue: string
  status: string
  completedToday?: boolean
  /** Present on the API payload; not used by the merge itself. */
  estimatedDuration?: string
  tasks: RoomScheduleTaskInput[]
}

export interface MergedTaskReference {
  scheduleId: string
  taskId: string
}

export interface MergedRoomTask {
  id: string
  description: string
  frequency: string | null
  additionalNotes: string | null
  taskRefs: MergedTaskReference[]
}

export interface RoomWorkPackage {
  id: string
  title: string
  frequency: string
  nextDue: string
  status: string
  completedToday: false
  estimatedDuration: string
  scheduleIds: string[]
  sourceTitles: string[]
  /** Of those, the ones brought forward rather than due. Empty in the normal case. */
  earlyScheduleIds: string[]
  tasks: MergedRoomTask[]
}

interface TaskCandidate {
  scheduleId: string
  scheduleTitle: string
  scheduleFrequency: string
  task: RoomScheduleTaskInput
  objectTokens: Set<string>
}

const FREQUENCY_WEIGHT: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 2,
  BIWEEKLY: 3,
  MONTHLY: 4,
  QUARTERLY: 5,
  SEMIANNUAL: 6,
  YEARLY: 7,
}

// These verbs and generic qualifiers describe how to clean, not what is being
// cleaned. Removing them makes "clean inside windows" match "windows and ledges"
// without making every task beginning with "clean" look equivalent.
const GENERIC_TASK_WORDS = new Set([
  'all', 'and', 'area', 'bedroom', 'clean', 'cleaning', 'check', 'daily', 'deep', 'descale',
  'disinfect', 'dry', 'dust', 'empty', 'external', 'high', 'inside', 'internal',
  'leave', 'low', 'mop', 'outside', 'polish', 'present', 'refill', 'remove',
  'replenish', 'restock', 'room', 'sanitise', 'scrub', 'sweep', 'the', 'thoroughly',
  'vacuum', 'wash', 'weekly', 'where', 'wipe',
])

const TOKEN_ALIASES: Record<string, string> = {
  armchairs: 'armchair',
  blinds: 'blind',
  boards: 'board',
  carpeted: 'carpet',
  carpets: 'carpet',
  chairs: 'chair',
  curtains: 'curtain',
  doors: 'door',
  extinguishers: 'extinguisher',
  floors: 'floor',
  frames: 'frame',
  handrails: 'handrail',
  hoover: 'vacuum',
  ledges: 'ledge',
  mirrors: 'mirror',
  radiators: 'radiator',
  sinks: 'sink',
  taps: 'tap',
  toilets: 'toilet',
  windows: 'window',
}

// A shared physical object is stronger evidence than general word similarity.
// This lets a terse deep-clean row such as "Radiators" absorb the daily radiator
// row while the same-source guard below keeps two distinct deep-clean rows apart.
const OBJECT_ANCHORS = new Set([
  'armchair', 'bin', 'blind', 'cabinet', 'carpet', 'chair', 'commode',
  'curtain', 'dispenser', 'door', 'extinguisher',
  'furniture', 'glass', 'handrail', 'headboard', 'ledge', 'mirror', 'ornament',
  'radiator', 'shelf', 'sink', 'skirting', 'stairlift', 'table', 'tap', 'tile',
  'toilet', 'wall', 'window',
])

function normalizeToken(token: string): string {
  const aliased = TOKEN_ALIASES[token]
  if (aliased) return aliased
  if (token.endsWith('ing') && token.length > 6) return token.slice(0, -3)
  if (token.endsWith('ed') && token.length > 5) return token.slice(0, -2)
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 4) return token.slice(0, -1)
  return token
}

function taskObjectTokens(description: string): Set<string> {
  const tokens = description
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken)
    .filter((token) => !GENERIC_TASK_WORDS.has(token) && token.length > 2)

  return new Set(tokens)
}

function tasksOverlap(left: Set<string>, right: Set<string>): boolean {
  if (left.size === 0 || right.size === 0) return false

  let shared = 0
  for (const token of left) {
    if (right.has(token)) shared += 1
  }

  if (shared === 0) return false
  const smallerSize = Math.min(left.size, right.size)

  for (const token of left) {
    if (right.has(token) && OBJECT_ANCHORS.has(token)) return true
  }

  // One specific object is enough when one description is deliberately terse,
  // e.g. "Handrails" versus "Wipe handrails and other touch points".
  if (smallerSize === 1) return true

  return shared >= 2 && shared / smallerSize >= 0.6
}

function candidatePriority(candidate: TaskCandidate): number {
  const deepCleanBonus = /deep|thorough/i.test(candidate.scheduleTitle) ? 100 : 0
  const frequency = FREQUENCY_WEIGHT[candidate.scheduleFrequency] ?? 0
  const detail = candidate.task.additionalNotes?.length ?? 0
  return deepCleanBonus + frequency * 10 + Math.min(detail, 9)
}

function formatDuration(taskCount: number): string {
  const minutes = Math.max(15, taskCount * 5)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder > 0 ? `${hours}h ${remainder}min` : `${hours}h`
}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function nextDay(date: Date): Date {
  const result = startOfDay(date)
  result.setDate(result.getDate() + 1)
  return result
}

function calendarDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function schedulesForNextVisit(
  schedules: RoomScheduleInput[],
  now: Date,
  alsoDoing: ReadonlySet<string>,
): RoomScheduleInput[] {
  // Completed today is the one exclusion nothing overrides. Asking to do a
  // schedule early that has already been signed off today is asking to do it
  // twice, which the completion endpoint refuses anyway.
  const outstanding = schedules.filter((schedule) => !schedule.completedToday)
  if (outstanding.length === 0) return []

  const tomorrow = nextDay(now)
  const dueNow = outstanding.filter((schedule) => new Date(schedule.nextDue) < tomorrow)

  /*
   * Work the cleaner has explicitly chosen to bring forward.
   *
   * The room is empty today, the quarterly deep clean is not due for six weeks,
   * and doing it now is the sensible thing. This is what lets them - and it is
   * strictly additive: the daily that IS due does not stop being required, and
   * every task of both still has to be ticked before either can be signed off.
   */
  const chosen = outstanding.filter(
    (schedule) => alsoDoing.has(schedule.id) && !dueNow.includes(schedule),
  )

  if (dueNow.length > 0) return [...dueNow, ...chosen]

  // Nothing is due. An explicit choice stands on its own - that is the whole
  // point of doing something early.
  if (chosen.length > 0) return chosen

  const earliest = [...outstanding].sort(
    (left, right) => new Date(left.nextDue).getTime() - new Date(right.nextDue).getTime(),
  )[0]
  const earliestDay = calendarDay(new Date(earliest.nextDue))
  return outstanding.filter((schedule) => calendarDay(new Date(schedule.nextDue)) === earliestDay)
}

/**
 * Schedules a cleaner could choose to bring forward on this visit.
 *
 * Everything outstanding that is not already part of today's due work. Each
 * carries its real next due date, because "not due until 4 November" is the
 * context somebody needs to decide whether doing it now is sensible or a waste
 * of an afternoon.
 */
export function schedulesAvailableEarly(
  schedules: RoomScheduleInput[],
  now = new Date(),
): RoomScheduleInput[] {
  const outstanding = schedules.filter((schedule) => !schedule.completedToday)
  const tomorrow = nextDay(now)

  return outstanding
    .filter((schedule) => new Date(schedule.nextDue) >= tomorrow)
    .sort((left, right) => new Date(left.nextDue).getTime() - new Date(right.nextDue).getTime())
}

function mergeTasks(schedules: RoomScheduleInput[]): MergedRoomTask[] {
  const groups: TaskCandidate[][] = []
  const orderedSchedules = [...schedules].sort(
    (left, right) =>
      (FREQUENCY_WEIGHT[left.frequency] ?? 0) - (FREQUENCY_WEIGHT[right.frequency] ?? 0) ||
      left.title.localeCompare(right.title),
  )

  for (const schedule of orderedSchedules) {
    for (const task of schedule.tasks) {
      const candidate: TaskCandidate = {
        scheduleId: schedule.id,
        scheduleTitle: schedule.title,
        scheduleFrequency: schedule.frequency,
        task,
        // Deep-clean templates often keep the actual objects in the instruction
        // text ("Ensuite" is the short label), so both fields participate in the
        // mechanical overlap check.
        objectTokens: taskObjectTokens(`${task.description} ${task.additionalNotes ?? ''}`),
      }

      const group = groups.find((existing) =>
        // Never collapse two separate checklist rows from the same source schedule.
        // A broad daily row may overlap two specific deep-clean rows, but the two
        // deep-clean rows must remain independently tickable.
        existing.every((member) => member.scheduleId !== schedule.id) &&
        existing.some((member) => tasksOverlap(member.objectTokens, candidate.objectTokens)),
      )

      if (group) group.push(candidate)
      else groups.push([candidate])
    }
  }

  return groups.map((group, index) => {
    const preferred = [...group].sort((left, right) => candidatePriority(right) - candidatePriority(left))[0]
    const notes: string[] = []

    if (preferred.task.additionalNotes?.trim()) notes.push(preferred.task.additionalNotes.trim())
    for (const member of group) {
      if (member === preferred) continue
      if (member.task.description.trim().toLowerCase() !== preferred.task.description.trim().toLowerCase()) {
        notes.push(`Also covers: ${member.task.description.trim()}.`)
      }
      if (member.task.additionalNotes?.trim()) notes.push(member.task.additionalNotes.trim())
    }

    return {
      id: `combined-task-${index + 1}`,
      description: preferred.task.description,
      frequency: group.length === 1 ? preferred.task.frequency ?? null : null,
      additionalNotes: notes.length > 0 ? [...new Set(notes)].join(' ') : null,
      taskRefs: group.map((member) => ({ scheduleId: member.scheduleId, taskId: member.task.id })),
    }
  })
}

export function buildRoomWorkPackage(
  schedules: RoomScheduleInput[],
  now = new Date(),
  /**
   * Schedule ids the cleaner has chosen to bring forward. Ids that are not
   * outstanding, or are already due, are simply ignored - a stale selection in a
   * URL must not change what is required.
   */
  alsoDoing: readonly string[] = [],
): RoomWorkPackage | null {
  const included = schedulesForNextVisit(schedules, now, new Set(alsoDoing))
  if (included.length === 0) return null

  const tasks = mergeTasks(included)
  const earliestDue = new Date(
    Math.min(...included.map((schedule) => new Date(schedule.nextDue).getTime())),
  )
  const overdue = included.some(
    (schedule) => schedule.status === 'OVERDUE' || new Date(schedule.nextDue) < startOfDay(now),
  )
  const scheduleIds = included.map((schedule) => schedule.id).sort()

  return {
    id: `work-${scheduleIds.join('-')}`,
    title: included.length === 1 ? included[0].title : 'Combined cleaning checklist',
    frequency: included.length === 1 ? included[0].frequency : 'COMBINED',
    nextDue: earliestDue.toISOString(),
    status: overdue ? 'OVERDUE' : 'PENDING',
    completedToday: false,
    estimatedDuration: formatDuration(tasks.length),
    scheduleIds,
    sourceTitles: included.map((schedule) => schedule.title),
    earlyScheduleIds: included
      .filter((schedule) => new Date(schedule.nextDue) >= nextDay(now))
      .map((schedule) => schedule.id)
      .sort(),
    tasks,
  }
}
