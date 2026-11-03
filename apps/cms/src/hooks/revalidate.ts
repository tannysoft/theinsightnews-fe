import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { WEB_URL } from '../lib/env'
import { isDraftSave } from './draft-save'
import { publishedBefore } from './published-before'

/**
 * Tell the website which cached data changed: cache tags (the Payload
 * adapter tags every fetch, apps/web/lib/payload.js) plus the page paths.
 * Handled by apps/web/app/api/revalidate. Skipped during bulk imports
 * (`context.disableRevalidate`).
 */
type Change = { tags: string[]; paths: string[]; layoutPaths?: string[] }

async function notify(change: Change, req: { payload: { logger: { warn: (m: string) => void } } }) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret || !change.tags.length) return
  try {
    const res = await fetch(`${WEB_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify(change),
    })
    if (!res.ok) req.payload.logger.warn(`revalidate ${res.status}: ${change.tags.join(',')}`)
  } catch (err) {
    req.payload.logger.warn(`revalidate failed: ${(err as Error).message}`)
  }
}

const path = (prefix: string, slug: unknown) => (slug ? `${prefix}${encodeURIComponent(String(slug))}` : null)

const changeFor = (collection: string, doc: Record<string, unknown>): Change => {
  const id = doc.id
  switch (collection) {
    case 'posts':
      return { tags: ['posts', `post-${id}`], paths: ['/', path('/', doc.slug)].filter(Boolean) as string[] }
    case 'pages':
      return { tags: ['pages', `page-${doc.slug}`], paths: [path('/', doc.slug)].filter(Boolean) as string[] }
    case 'categories':
      return { tags: ['categories', 'posts'], paths: ['/'], layoutPaths: [path('/category/', doc.slug)].filter(Boolean) as string[] }
    case 'tags':
      return { tags: ['tags', `tag-${doc.slug}`], paths: [], layoutPaths: [path('/tag/', doc.slug)].filter(Boolean) as string[] }
    case 'users':
      return { tags: ['users', 'posts'], paths: [], layoutPaths: [path('/author/', doc.slug)].filter(Boolean) as string[] }
    default:
      return { tags: [collection], paths: [] }
  }
}

const merge = (a: Change, b: Change): Change => ({
  tags: [...new Set([...a.tags, ...b.tags])],
  paths: [...new Set([...a.paths, ...b.paths])],
  layoutPaths: [...new Set([...(a.layoutPaths ?? []), ...(b.layoutPaths ?? [])])],
})

export const revalidateAfterChange =
  (collection: string): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req, context }) => {
    if (context.disableRevalidate || isDraftSave(req)) return doc
    const live = publishedBefore(context, doc, previousDoc)
    // Nothing public changed: not published before this save, nor after it.
    if (doc._status === 'draft' && live?._status !== 'published') return doc
    let change = changeFor(collection, doc)
    if (live?.slug && live.slug !== doc.slug) change = merge(change, changeFor(collection, live))
    await notify(change, req)
    return doc
  }

export const revalidateAfterDelete =
  (collection: string): CollectionAfterDeleteHook =>
  async ({ doc, req, context }) => {
    if (context.disableRevalidate) return doc
    await notify(changeFor(collection, doc), req)
    return doc
  }
