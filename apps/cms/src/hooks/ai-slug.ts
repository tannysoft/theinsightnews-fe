import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'
import { generateEnglishSlug, lexicalText } from '../lib/ai-slug'
import { slugify } from '../lib/slug'

/**
 * New posts saved without a slug get an English one written by Claude from
 * the headline and body (lib/ai-slug.ts); if that isn't available, the slug
 * is made from the title as before. Autosaves are skipped (they run every few
 * seconds while typing) — the slug is made on the first real save.
 *
 * Only posts that have never had a slug: an existing post keeps its slug,
 * and clearing the field puts the old one back rather than writing a new one.
 */
export const fillSlugWithAI: CollectionBeforeValidateHook = async ({ data, originalDoc, req, operation }) => {
  if (!data || (operation !== 'create' && operation !== 'update')) return data
  const existing = typeof originalDoc?.slug === 'string' ? originalDoc.slug.trim() : ''
  if (existing) {
    if (data.slug !== undefined && !String(data.slug ?? '').trim()) data.slug = existing
    return data
  }
  if (isAutosave(req)) return data
  if (typeof data.slug === 'string' && data.slug.trim()) return data

  const title = String(data.title ?? originalDoc?.title ?? '').trim()
  if (!title) return data

  const ai = await generateEnglishSlug({
    title,
    excerpt: String(data.excerpt ?? originalDoc?.excerpt ?? ''),
    body: lexicalText(data.content ?? originalDoc?.content),
  })
  const base = ai ?? slugify(title)
  if (!base) return data
  data.slug = await uniqueSlug(req, base, originalDoc?.id ?? data.id)
  return data
}

function isAutosave(req: PayloadRequest) {
  const q = req.query as Record<string, unknown> | undefined
  return q?.autosave === 'true' || q?.autosave === true
}

/** base, base-2, base-3, … — the first one no other post uses. */
async function uniqueSlug(req: PayloadRequest, base: string, selfId?: number | string): Promise<string> {
  // Exact candidates, not LIKE: D1 rejects long LIKE patterns (Thai is 3 bytes a letter).
  const candidates = [base, ...Array.from({ length: 49 }, (_, i) => `${base}-${i + 2}`)]
  const { docs } = await req.payload.find({
    collection: 'posts',
    where: { slug: { in: candidates } },
    select: { slug: true },
    limit: candidates.length,
    depth: 0,
    overrideAccess: true,
    pagination: false,
    req,
  })
  const taken = new Set(docs.filter((d) => d.id !== selfId).map((d) => d.slug as string))
  return candidates.find((c) => !taken.has(c)) ?? `${base}-${Date.now()}`
}
