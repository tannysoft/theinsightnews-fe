import type { Endpoint, PayloadRequest, Where } from 'payload'
import { parseHTML } from 'linkedom'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { htmlToLexical, type DomClass, type MediaIndex } from '../lib/html-to-lexical'
import type { MediaLite } from '../lib/lexical-html'
import { articleEditor } from '../lib/editor'
import { slugify } from '../lib/slug'
import { MEDIA_URL, WEB_URL } from '../lib/env'

/**
 * POST /api/posts/drafts — let other tools send stories in as drafts.
 *
 *   Authorization: users API-Key <key>     (Users → a person → Enable API key)
 *   {
 *     "id": 123,                       // optional: update this post's draft instead of creating one
 *     "title": "…",                    // required when creating
 *     "html": "<p>…</p>",              // or "markdown": "…"
 *     "excerpt": "…",
 *     "slug": "…",                     // default: English slug by Claude from title + body (made unique)
 *     "categories": ["politics", 3094],// slugs or ids; required when creating
 *     "tags": ["AI", "เศรษฐกิจ"],       // names; missing tags are created
 *     "featuredImage": 41094,          // media id, or an image URL to add to the library
 *     "publishedAt": "2026-11-05T09:00:00+07:00",
 *     "author": 102,                   // editors/admins only; default: the API key's user
 *     "meta": { "title": "…", "description": "…" }
 *   }
 *
 * Always saves a draft: nothing goes live until an editor publishes it in
 * the admin, and an already-published story keeps its live version.
 * Images in the body that are already on files.theinsightnews.co link to the
 * library; images from elsewhere are downloaded into it.
 */

type Body = {
  id?: number
  title?: string
  html?: string
  markdown?: string
  excerpt?: string
  slug?: string
  categories?: (string | number)[]
  tags?: string[]
  featuredImage?: number | string
  publishedAt?: string
  author?: number
  sticky?: boolean
  meta?: { title?: string; description?: string }
}

const MAX_IMAGES = 40
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

/**
 * linkedom behind JSDOM's constructor shape (see DomClass). Payload's
 * converter passes a bare fragment, which linkedom only parses correctly
 * inside a full document.
 */
class LinkedomDOM {
  window: { document: Document }
  constructor(html: string) {
    const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><head></head><body>${html}</body></html>`
    this.window = parseHTML(full) as unknown as { document: Document }
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const json = (status: number, body: unknown) => Response.json(body, { status })

const roleOf = (req: PayloadRequest) => (req.user as { role?: string } | null)?.role

/** Storage key of a URL on our media domain ("wp-content/uploads/2026/11/x.jpg"), or null. */
function ownKey(src: string): string | null {
  try {
    const u = new URL(src, MEDIA_URL || 'https://files.theinsightnews.co')
    const path = decodeURIComponent(u.pathname).replace(/^\/+/, '')
    return path.startsWith('wp-content/uploads/') ? path : null
  } catch {
    return null
  }
}

async function findByKey(req: PayloadRequest, key: string): Promise<MediaLite | null> {
  const dir = key.slice(0, key.lastIndexOf('/'))
  const file = key.slice(key.lastIndexOf('/') + 1)
  // A WordPress-sized copy (-300x169.jpg) belongs to its original.
  const names = [...new Set([file, file.replace(/-\d+x\d+(\.\w+)$/, '$1'), file.replace(/-scaled(\.\w+)$/, '$1')])]
  const res = await req.payload.find({
    collection: 'media',
    where: { and: [{ prefix: { equals: dir } }, { filename: { in: names } }] },
    limit: 1,
    depth: 0,
    req,
  })
  return (res.docs[0] as unknown as MediaLite) ?? null
}

/** Download an image into the library (the upload hook makes its WebP sizes). */
async function uploadFromUrl(req: PayloadRequest, src: string, alt?: string): Promise<MediaLite> {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    throw new HttpError(400, `bad image URL: ${src}`)
  }
  if (!/^https?:$/.test(url.protocol)) throw new HttpError(400, `bad image URL: ${src}`)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new HttpError(400, `image ${res.status}: ${src}`)
  const mimetype = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!mimetype.startsWith('image/')) throw new HttpError(400, `not an image (${mimetype || 'unknown type'}): ${src}`)
  const data = Buffer.from(await res.arrayBuffer())
  if (data.byteLength > MAX_IMAGE_BYTES) throw new HttpError(400, `image larger than 20 MB: ${src}`)
  const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') ?? 'jpg'
  const base = slugify(decodeURIComponent(url.pathname.split('/').pop() ?? '').replace(/\.[^.]+$/, '')) || 'image'
  const doc = await req.payload.create({
    collection: 'media',
    data: { alt: alt || undefined },
    file: { data, mimetype, name: `${base}.${ext}`, size: data.byteLength },
    req,
  })
  return doc as unknown as MediaLite
}

async function resolveImage(req: PayloadRequest, src: string, alt?: string): Promise<MediaLite> {
  const key = ownKey(src)
  if (key) {
    const found = await findByKey(req, key)
    if (found) return found
  }
  return uploadFromUrl(req, src, alt)
}

async function resolveCategories(req: PayloadRequest, list: (string | number)[]): Promise<number[]> {
  const ids = list.filter((c): c is number => typeof c === 'number')
  const slugs = list.filter((c): c is string => typeof c === 'string').map((s) => slugify(s))
  const where: Where = { or: [...(ids.length ? [{ id: { in: ids } }] : []), ...(slugs.length ? [{ slug: { in: slugs } }] : [])] }
  const res = await req.payload.find({ collection: 'categories', where, limit: 100, depth: 0, req })
  const found = res.docs as { id: number; slug: string }[]
  const missing = [...ids.filter((id) => !found.some((c) => c.id === id)), ...slugs.filter((s) => !found.some((c) => c.slug === s))]
  if (missing.length) throw new HttpError(400, `unknown categories: ${missing.join(', ')}`)
  // Keep the caller's order: the first one is the primary category.
  return list
    .map((c) => found.find((f) => (typeof c === 'number' ? f.id === c : f.slug === slugify(c)))?.id)
    .filter((id): id is number => Boolean(id))
}

async function resolveTags(req: PayloadRequest, names: string[]): Promise<number[]> {
  const out: number[] = []
  for (const raw of names) {
    const name = String(raw).trim()
    if (!name) continue
    const slug = slugify(name)
    const res = await req.payload.find({
      collection: 'tags',
      where: { or: [{ name: { equals: name } }, { slug: { equals: slug } }] },
      limit: 1,
      depth: 0,
      req,
    })
    const tag = res.docs[0] ?? (await req.payload.create({ collection: 'tags', data: { name, slug }, req }))
    if (!out.includes(tag.id as number)) out.push(tag.id as number)
  }
  return out
}

/** The slug, or the slug with -2, -3… when another post already has it. */
async function uniqueSlug(req: PayloadRequest, wanted: string, selfId?: number): Promise<string> {
  const base = slugify(wanted) || `post-${Date.now()}`
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    const res = await req.payload.find({
      collection: 'posts',
      where: { and: [{ slug: { equals: slug } }, ...(selfId ? [{ id: { not_equals: selfId } }] : [])] },
      limit: 1,
      depth: 0,
      draft: true,
      req,
      overrideAccess: true,
    })
    if (!res.docs.length) return slug
  }
  throw new HttpError(409, `slug already taken: ${base}`)
}

async function bodyToLexical(req: PayloadRequest, body: Body) {
  const editorConfig = await editorConfigFactory.fromEditor({ config: req.payload.config, editor: articleEditor })
  if (typeof body.markdown === 'string') return convertMarkdownToLexical({ editorConfig, markdown: body.markdown })

  // Resolve every <img> to a library item first, then convert with a media
  // index holding just those.
  const doc = new LinkedomDOM(`<!doctype html><html><body>${body.html ?? ''}</body></html>`).window.document
  const imgs = [...doc.querySelectorAll('img')]
  if (imgs.length > MAX_IMAGES) throw new HttpError(400, `too many images (max ${MAX_IMAGES})`)
  const media: MediaIndex = { byId: new Map(), byPath: new Map() }
  for (const img of imgs) {
    const src = img.getAttribute('src')
    if (!src || src.startsWith('data:')) {
      img.remove()
      continue
    }
    const m = await resolveImage(req, src, img.getAttribute('alt') ?? undefined)
    media.byId.set(m.id, m)
    // The converter finds library images by their wp-image-{id} class.
    img.setAttribute('class', `${img.getAttribute('class') ?? ''} wp-image-${m.id}`.trim())
  }
  const { state, warnings } = htmlToLexical(doc.body.innerHTML, { editorConfig, media, DOM: LinkedomDOM as unknown as DomClass })
  if (warnings.length) req.payload.logger.info(`drafts endpoint: ${warnings.join('; ')}`)
  return state
}

export const draftsEndpoint: Endpoint = {
  path: '/drafts',
  method: 'post',
  handler: async (req) => {
    if (!req.user) return json(401, { error: 'send an API key: Authorization: users API-Key <key>' })
    let body: Body
    try {
      body = (await req.json?.()) as Body
    } catch {
      return json(400, { error: 'body must be JSON' })
    }
    if (!body || typeof body !== 'object') return json(400, { error: 'body must be a JSON object' })

    try {
      const updating = body.id !== undefined
      if (updating && (!Number.isInteger(body.id) || (body.id as number) <= 0)) throw new HttpError(400, 'id must be a post id')
      if (!updating && !body.title?.trim()) throw new HttpError(400, 'title is required')
      if (!updating && !body.categories?.length) throw new HttpError(400, 'categories is required (slugs or ids)')
      if (body.html !== undefined && body.markdown !== undefined) throw new HttpError(400, 'send html or markdown, not both')
      if (body.author !== undefined && body.author !== req.user.id && !['admin', 'editor'].includes(roleOf(req) ?? ''))
        throw new HttpError(403, 'only editors and admins can set another author')
      if (body.publishedAt !== undefined && Number.isNaN(Date.parse(body.publishedAt))) throw new HttpError(400, 'publishedAt must be an ISO date')

      const data: Record<string, unknown> = { _status: 'draft' }
      if (body.title !== undefined) data.title = body.title.trim()
      if (body.excerpt !== undefined) data.excerpt = body.excerpt
      if (body.html !== undefined || body.markdown !== undefined) data.content = await bodyToLexical(req, body)
      if (body.categories !== undefined) {
        const cats = await resolveCategories(req, body.categories)
        data.categories = cats
        data.primaryCategory = cats[0]
      }
      if (body.tags !== undefined) data.tags = await resolveTags(req, body.tags)
      if (body.featuredImage !== undefined) {
        data.featuredImage =
          typeof body.featuredImage === 'number' ? body.featuredImage : (await resolveImage(req, body.featuredImage)).id
      }
      if (body.publishedAt !== undefined) data.publishedAt = new Date(body.publishedAt).toISOString()
      if (body.sticky !== undefined) data.sticky = Boolean(body.sticky)
      if (body.meta) data.meta = { title: body.meta.title, description: body.meta.description }
      if (!updating) data.author = body.author ?? req.user.id
      else if (body.author !== undefined) data.author = body.author
      // No slug given: hooks/ai-slug.ts writes an English one from the title and body.
      if (body.slug) data.slug = await uniqueSlug(req, body.slug, body.id)

      // `draftSave` keeps public side effects (cache revalidation, tag
      // counts, old-slug redirects) for when an editor publishes.
      const context = { draftSave: true }
      const post = updating
        ? await req.payload.update({ collection: 'posts', id: body.id as number, data, draft: true, req, overrideAccess: false, context })
        : await req.payload.create({ collection: 'posts', data: data as never, draft: true, req, overrideAccess: false, context })

      const admin = req.payload.config.routes.admin
      const cms = (process.env.CMS_URL || '').replace(/\/$/, '')
      return json(updating ? 200 : 201, {
        id: post.id,
        slug: post.slug,
        status: 'draft',
        adminUrl: `${cms}${admin}/collections/posts/${post.id}`,
        // Live URL once published. (Preview from the admin: the secret stays out of API responses.)
        url: `${WEB_URL}/${encodeURIComponent(String(post.slug ?? ''))}`,
      })
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message })
      const e = err as Error & { status?: number; data?: { errors?: { message: string; path?: string }[] } }
      if (e.status && e.status < 500) return json(e.status, { error: e.message, details: e.data?.errors })
      req.payload.logger.error(`drafts endpoint: ${e.message}`)
      return json(500, { error: 'could not save the draft' })
    }
  },
}
