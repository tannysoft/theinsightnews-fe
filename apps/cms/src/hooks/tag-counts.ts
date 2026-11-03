import { isDraftSave } from './draft-save'
import { publishedBefore } from './published-before'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload, PayloadRequest } from 'payload'

const ids = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((t) => (typeof t === 'object' && t ? Number((t as { id: unknown }).id) : Number(t))).filter(Boolean) : []

/** Recount published posts for the given tags. */
export async function recountTags(payload: Payload, tagIds: number[], req?: PayloadRequest) {
  for (const id of new Set(tagIds)) {
    const { totalDocs } = await payload.count({
      collection: 'posts',
      where: { and: [{ tags: { contains: id } }, { _status: { equals: 'published' } }] },
      req,
    })
    await payload.update({
      collection: 'tags',
      id,
      data: { postCount: totalDocs },
      context: { disableRevalidate: true },
      req,
    })
  }
}

export const updateTagCounts: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (context.disableTagCounts || isDraftSave(req)) return doc
  const live = publishedBefore(context, doc, previousDoc)
  // Counts are of published stories: nothing to do unless one side is published.
  if (doc._status !== 'published' && live?._status !== 'published') return doc
  const before = ids(live?.tags)
  const after = ids(doc.tags)
  const statusChanged = live?._status !== doc._status
  const changed = statusChanged ? [...before, ...after] : [...before.filter((t) => !after.includes(t)), ...after.filter((t) => !before.includes(t))]
  if (changed.length) await recountTags(req.payload, changed, req)
  return doc
}

export const updateTagCountsOnDelete: CollectionAfterDeleteHook = async ({ doc, req, context }) => {
  if (context.disableTagCounts) return doc
  const t = ids(doc.tags)
  if (t.length) await recountTags(req.payload, t, req)
  return doc
}
