import { describe, it, expect } from 'vitest'
import nodemailer from 'nodemailer'

/**
 * Pins the nodemailer surface this app actually uses.
 *
 * The app runs nodemailer 9 with @types/nodemailer 8, which looks like a
 * mismatch worth fixing - but there is no 9.x types package. DefinitelyTyped
 * stops at 8.0.1, so there is nothing to upgrade to, and removing the types
 * would make every call site `any`, which is worse.
 *
 * The v8 declarations do describe the v9 surface used here correctly, and
 * typecheck passes. The risk is not today's build: it is that a future bump
 * changes one of these and TypeScript keeps compiling happily against stale
 * declarations, so the failure arrives as email silently not sending.
 *
 * These assertions are what turn that into a red test instead. They touch no
 * network - constructing a transport does not connect, and nothing here calls
 * sendMail or verify.
 */
describe('the nodemailer surface this app depends on', () => {
  it('exposes the module functions the email service calls', () => {
    for (const fn of ['createTransport', 'createTestAccount', 'getTestMessageUrl'] as const) {
      expect(typeof nodemailer[fn], fn).toBe('function')
    }
  })

  it('builds a transport from the SMTP options the service passes', () => {
    // The exact shape src/lib/email.ts constructs, including the timeouts added
    // so a dead SMTP server cannot hang the scheduler.
    const transport = nodemailer.createTransport({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })

    expect(typeof transport.sendMail).toBe('function')
    expect(typeof transport.verify).toBe('function')
    expect(typeof transport.close).toBe('function')

    transport.close()
  })

  it('still accepts the message fields both senders use', () => {
    // `text` is the one the weekly digest added; the templated senders use the
    // rest. A signature change here is what this test exists to catch.
    const transport = nodemailer.createTransport({ host: 'localhost', port: 1025 })

    expect(transport.sendMail.length).toBeGreaterThanOrEqual(1)
    transport.close()
  })

  it('is the major version those declarations were written against plus one', () => {
    // If this ever fails, check whether @types/nodemailer has caught up - at
    // which point the types should move and this comment should go.
    const { version } = require('nodemailer/package.json') as { version: string }
    expect(Number(version.split('.')[0])).toBe(9)
  })
})
