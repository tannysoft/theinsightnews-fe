import type { CollectionBeforeChangeHook, CollectionSlug } from 'payload'

/**
 * Documents made in the CMS get ids above this; WordPress ids stay below.
 *
 * Imported content keeps its WordPress id, and WordPress keeps handing out
 * new ones until the cutover, so a final delta import must not collide with
 * anything created here in the meantime. SQLite would otherwise use
 * max(id) + 1 — right inside WordPress's range.
 */
export const ID_FLOOR = 1_000_000

export const idAboveWordPress: CollectionBeforeChangeHook = async ({ data, operation, req, collection }) => {
  if (operation !== 'create' || data.id !== undefined) return data
  const res = await req.payload.find({
    collection: collection.slug as CollectionSlug,
    where: { id: { greater_than: ID_FLOOR } },
    sort: '-id',
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    draft: true,
    req,
    select: {},
  })
  const top = Number(res.docs[0]?.id ?? ID_FLOOR)
  data.id = top + 1
  return data
}
