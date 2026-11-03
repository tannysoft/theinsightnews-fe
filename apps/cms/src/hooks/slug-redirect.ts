import type { CollectionAfterChangeHook } from 'payload'
import { isDraftSave } from './draft-save'
import { publishedBefore } from './published-before'

/**
 * A published post whose slug changed keeps its old URL as a redirect.
 * If the new slug was itself an old redirect, that entry is removed so the
 * live post isn't shadowed.
 */
export const rememberOldSlug: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (context.disableRevalidate || isDraftSave(req)) return doc
  const live = publishedBefore(context, doc, previousDoc)
  const before = live?.slug as string | undefined
  const after = doc.slug as string | undefined
  if (!before || !after || before === after || live?._status !== 'published' || doc._status !== 'published') return doc
  await req.payload.delete({ collection: 'redirects', where: { from: { equals: after } }, req, overrideAccess: true })
  const existing = await req.payload.find({ collection: 'redirects', where: { from: { equals: before } }, limit: 1, depth: 0, req, overrideAccess: true })
  if (existing.docs[0]) {
    await req.payload.update({ collection: 'redirects', id: existing.docs[0].id, data: { post: doc.id }, req, overrideAccess: true })
  } else {
    await req.payload.create({ collection: 'redirects', data: { from: before, post: doc.id }, req, overrideAccess: true })
  }
  return doc
}
