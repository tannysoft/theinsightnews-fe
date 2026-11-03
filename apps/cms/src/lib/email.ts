import type { EmailAdapter, SendEmailOptions } from 'payload'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Payload email adapter for Cloudflare Email Sending (the `EMAIL` send_email
 * binding in wrangler.jsonc). Used for forgot-password and other auth mail.
 * Sender domain: notify.theinsightnews.co (onboarded with
 * `wrangler email sending enable notify.theinsightnews.co`).
 * Outside Workers (scripts, `next dev` without the binding) mail is logged.
 */
export const FROM_ADDRESS = process.env.EMAIL_FROM || 'no-reply@notify.theinsightnews.co'
export const FROM_NAME = 'The Insight News CMS'

type Address = { email: string; name?: string }
/** Plain string when there's no display name: the binding rejects an EmailAddress without `name`. */
type Recipient = string | { email: string; name: string }
const out = (a: Address): Recipient => (a.name ? { email: a.email, name: a.name } : a.email)
type SendEmailBinding = {
  send: (m: {
    to: Recipient[]
    from: Recipient
    subject: string
    html?: string
    text?: string
    cc?: Recipient[]
    bcc?: Recipient[]
    replyTo?: Recipient
  }) => Promise<{ messageId: string }>
}

type AnyAddress = string | { address: string; name?: string } | undefined | null
/** The binding rejects `name: undefined`, so only set it when there is one. */
const addr = (email: string, name?: string | null): Address => {
  const clean = name?.trim().replace(/^"|"$/g, '')
  return clean ? { email: email.trim(), name: clean } : { email: email.trim() }
}
const toAddress = (a: AnyAddress): Address | null => {
  if (!a) return null
  if (typeof a !== 'string') return a.address ? addr(a.address, a.name) : null
  // "Name <user@example.com>" or a bare address
  const m = a.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  return m ? addr(m[2], m[1]) : addr(a)
}
const toList = (v: unknown): Address[] =>
  (Array.isArray(v) ? v : v ? [v] : [])
    .flatMap((a) => (typeof a === 'string' ? a.split(',') : [a]))
    .map((a) => toAddress(typeof a === 'string' ? a.trim() : (a as AnyAddress)))
    .filter((a): a is Address => Boolean(a?.email))

const htmlToText = (html: string) =>
  html
    .replace(/<(br|\/p|\/div|\/h\d|\/li)\b[^>]*>/gi, '\n')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

async function binding(): Promise<SendEmailBinding | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return ((env as unknown as { EMAIL?: SendEmailBinding }).EMAIL ?? null)
  } catch {
    return null
  }
}

export const cloudflareEmailAdapter: EmailAdapter<{ messageId: string } | null> = ({ payload }) => ({
  name: 'cloudflare-email',
  defaultFromAddress: FROM_ADDRESS,
  defaultFromName: FROM_NAME,
  sendEmail: async (message: SendEmailOptions) => {
    const to = toList(message.to)
    const subject = String(message.subject ?? '')
    const html = typeof message.html === 'string' ? message.html : undefined
    const text = typeof message.text === 'string' ? message.text : html ? htmlToText(html) : undefined
    const from = toAddress(message.from as AnyAddress) ?? { email: FROM_ADDRESS, name: FROM_NAME }
    const email = await binding()
    const cc = toList(message.cc)
    const bcc = toList(message.bcc)
    const replyTo = toAddress(message.replyTo as AnyAddress)
    if (!email) {
      payload.logger.info(`[email, not sent: no EMAIL binding] to=${to.map((a) => a.email).join(',')} subject=${subject}`)
      return null
    }
    try {
      return await email.send({
        to: to.map(out),
        from: out(addr(from.email, from.name ?? FROM_NAME)),
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(cc.length ? { cc: cc.map(out) } : {}),
        ...(bcc.length ? { bcc: bcc.map(out) } : {}),
        ...(replyTo ? { replyTo: out(replyTo) } : {}),
      })
    } catch (err) {
      const e = err as Error & { code?: string }
      payload.logger.error(`email send failed (${e.code ?? 'error'}): ${e.message}`)
      throw err
    }
  },
})
