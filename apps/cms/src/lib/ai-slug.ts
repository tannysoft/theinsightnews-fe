import Anthropic from '@anthropic-ai/sdk'

/**
 * English URL slug for a Thai story, in the style of the site's WordPress
 * archive (e.g. "super-el-nino-thailand-drought-crisis"), written by Claude
 * from the headline and body. Returns null when no API key is set or the
 * call fails, so the caller can fall back to a slug from the title.
 */

const SYSTEM = `You write URL slugs for The Insight News, a Thai-language news and analysis site.

Given a story's Thai headline and body, return one English slug in the style of the site's existing URLs:
- lowercase ASCII letters, digits and hyphens only
- 3 to 6 words that say what the story is about (the subject, people, places, issue), not a literal translation of the headline
- names of people, places, companies and parties in their usual English or romanized spelling (e.g. Bhumjaithai, Pattaya, Nong Nooch, NIDA Poll)
- leave out filler words (a, an, the, of, and, in) unless they are needed for meaning; no dates unless the date is the story

Examples from the site:
สัญญาณแวดล้อมฟ้อง โลกกำลังเข้าสู่โหมดวิกฤต ? → doomsday-clock-planetary-crisis
ข่าวลือสงครามโลก VS ข่าวจริงวิกฤตเอลนีโญ่ ที่คนแทบไม่สนใจ → super-el-nino-thailand-drought-crisis
“ศิริโชค” เปิดปม “ไอเดียร์” บริจาคเงินให้ภูมิใจไทย โยงข้อสงสัยที่มาของทรัพย์สิน → sirichok-donation-inquiry-bhumjai-thai
วิเคราะห์ผลสำรวจนิด้าโพล เมื่อน้ำท่วม กทม. ศรัทธาประชาชนอยู่ที่ใคร ? → nida-poll-bangkok-flood-trust
“สามารถ” กางแผนผ่าโครงการรถไฟฟ้า จังหวัดไหนจะได้สร้างก่อน ? → electric-train-regional-provinces-priority`

const SCHEMA = {
  type: 'object',
  properties: { slug: { type: 'string', description: 'The English URL slug' } },
  required: ['slug'],
  additionalProperties: false,
} as const

const MAX_BODY_CHARS = 6000

/** Keep only what a URL slug may contain; the model's output is checked, not trusted. */
export function cleanEnglishSlug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 8)
    .join('-')
    .slice(0, 80)
    .replace(/-+$/, '')
}

/** Plain text of a Lexical document (paragraphs, headings, lists, captions). */
export function lexicalText(content: unknown): string {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; children?: unknown[]; fields?: { caption?: string } }
    if (typeof n.text === 'string') out.push(n.text)
    if (n.type === 'upload' && n.fields?.caption) out.push(`\n${n.fields.caption}\n`)
    if (Array.isArray(n.children)) {
      n.children.forEach(walk)
      if (n.type && n.type !== 'text' && n.type !== 'root') out.push('\n')
    }
  }
  walk((content as { root?: unknown } | null)?.root)
  return out.join('').replace(/\n{3,}/g, '\n\n').trim()
}

export async function generateEnglishSlug(input: { title: string; excerpt?: string; body?: string }): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  // Saving waits for this, so keep it short; on any failure the title slug is used.
  const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 })

  const parts = [`Headline: ${input.title.trim()}`]
  if (input.excerpt?.trim()) parts.push(`Summary: ${input.excerpt.trim()}`)
  if (input.body?.trim()) parts.push(`Body:\n${input.body.trim().slice(0, MAX_BODY_CHARS)}`)

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: parts.join('\n\n') }],
    })
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      console.warn(`ai slug: stopped (${response.stop_reason})`)
      return null
    }
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return null
    const { slug } = JSON.parse(text.text) as { slug?: unknown }
    const clean = typeof slug === 'string' ? cleanEnglishSlug(slug) : ''
    // Two words or more, or it's not a useful slug.
    return clean.includes('-') ? clean : null
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.warn(`ai slug: API error ${err.status}: ${err.message}`)
    else console.warn('ai slug failed:', (err as Error).message)
    return null
  }
}
