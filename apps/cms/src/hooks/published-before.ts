import type { CollectionBeforeChangeHook, CollectionSlug } from 'payload'

/**
 * What the public saw before this save.
 *
 * With drafts on, Payload's `previousDoc` is the *latest version* — usually
 * an autosave, already carrying the editor's new slug, tags or status. Side
 * effects that are about the live site (old-slug redirects, revalidation,
 * tag counts) must compare against the published document instead: the
 * collection's main table, which draft saves never touch.
 *
 * Stored per id in `context`, since one request can update many documents.
 */
type Snapshot = Record<string, unknown> & { _status?: string; slug?: string; tags?: unknown }
const KEY = 'publishedBefore'

export const capturePublished: CollectionBeforeChangeHook = async ({ operation, originalDoc, req, context, collection }) => {
  if (operation !== 'update' || !originalDoc?.id) return
  const live = await req.payload.db.findOne({
    collection: collection.slug as CollectionSlug,
    where: { id: { equals: originalDoc.id } },
    req,
  })
  const map = ((context[KEY] as Record<string, Snapshot> | undefined) ??= {})
  map[String(originalDoc.id)] = (live as Snapshot | null) ?? {}
}

/** The published state before this save (falls back to previousDoc for collections without drafts). */
export const publishedBefore = (context: Record<string, unknown>, doc: { id?: unknown }, previousDoc?: Snapshot | null): Snapshot | null | undefined => {
  const snap = (context[KEY] as Record<string, Snapshot> | undefined)?.[String(doc.id)]
  return snap ?? previousDoc
}
