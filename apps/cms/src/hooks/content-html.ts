import type { CollectionBeforeChangeHook } from 'payload'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { collectMediaIds, lexicalToHTML, type MediaLite } from '../lib/lexical-html'

/**
 * Store the rendered HTML of the body next to the Lexical JSON, so the
 * website reads ready-made HTML instead of converting on every request.
 * The WordPress import passes `context.skipContentHtml` with HTML it already built.
 */
export const renderContentHtml: CollectionBeforeChangeHook = async ({ data, req, context }) => {
  if (context.skipContentHtml || !data.content) return data
  const state = data.content as SerializedEditorState
  const ids = collectMediaIds(state)
  const media = new Map<number, MediaLite>()
  // In batches: D1 allows at most 100 bound parameters per query.
  for (let i = 0; i < ids.length; i += 80) {
    const found = await req.payload.find({
      collection: 'media',
      where: { id: { in: ids.slice(i, i + 80) } },
      depth: 0,
      pagination: false,
      req,
    })
    found.docs.forEach((m) => media.set(m.id as number, m as unknown as MediaLite))
  }
  data.contentHtml = lexicalToHTML(state, media)
  data.readingMinutes = readingMinutes(data.contentHtml)
  return data
}

/** Same rule as the WordPress plugin the site used: 220 words a minute, at least 1. */
export function readingMinutes(html: string | null | undefined): number {
  const text = (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, ' ').trim()
  if (!text) return 1
  return Math.max(1, Math.round(text.split(/\s+/u).filter(Boolean).length / 220))
}
