/**
 * WordPress → Payload import.
 *
 *   pnpm migrate:wp                         # everything, into local D1 (.wrangler)
 *   pnpm migrate:wp --steps=posts --limit=50
 *   pnpm migrate:wp --since=2026-11-01      # delta: posts changed since a date (upsert)
 *   pnpm migrate:wp --steps=posts --ids=8066,9492  # re-import specific posts
 *   pnpm migrate:wp --steps=files           # check every media file in R2, upload missing ones
 *   pnpm migrate:wp --steps=sizes           # make the resized WebP copies the website uses
 *   PAYLOAD_REMOTE=1 pnpm migrate:wp …      # write straight to the Cloudflare D1/R2
 *
 * Steps run in dependency order: users → categories → tags → media → posts →
 * pages → redirects → counts (→ files / sizes, only when asked). Re-running is safe: existing ids
 * are skipped (or updated with --update / --since), and paging progress is
 * saved in .migrate/state.json.
 *
 * WordPress ids and slugs are kept, so /{slug} URLs, tag pages and media
 * references survive unchanged.
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { getPayload, type Payload } from 'payload'
import { editorConfigFactory } from '@payloadcms/richtext-lexical'
import { sql } from '@payloadcms/db-d1-sqlite'
import { WordPress, type WPMedia, type WPPost, type WPTerm, type WPUser, type YoastHead } from './wp'
import { JSDOM } from 'jsdom'
import { htmlToLexical, resolveMediaUrl, type MediaIndex } from '../../src/lib/html-to-lexical'
import { cleanExcerpt, decodeEntities, decodeSlug, gmt, looksLikeRealName, stripHtml, untexturize } from './text'
import { copyFiles, UPLOADS } from './files'
import { generateSizes } from './sizes'
import { lexicalToHTML, type MediaLite } from '../../src/lib/lexical-html'
import { articleEditor } from '../../src/lib/editor'
import { readingMinutes } from '../../src/hooks/content-html'

process.env.PAYLOAD_SCRIPT = '1'

// ---------- options ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
)
const ALL_STEPS = ['users', 'categories', 'tags', 'media', 'posts', 'pages', 'redirects', 'counts'] as const
const steps = new Set((args.steps ?? ALL_STEPS.join(',')).split(','))
const LIMIT = args.limit ? Number(args.limit) : Infinity
const SINCE = args.since ? new Date(args.since).toISOString() : undefined
/** --ids=1,2,3: re-import just these posts/pages (implies --update). */
const IDS = args.ids
const UPDATE = args.update === 'true' || Boolean(SINCE) || Boolean(IDS)
const CONCURRENCY = Number(args.concurrency ?? 6)
const YOAST = args.yoast !== 'false'
// The admin lists drafts-enabled collections from their versions table, so
// every story needs one; --drop-versions only for throwaway test imports.
const KEEP_VERSIONS = args['drop-versions'] !== 'true'
const WP_URL = args.wp ?? process.env.WP_URL ?? 'https://cms.theinsightnews.co'

const WORK_DIR = path.resolve(import.meta.dirname, '../../.migrate')
const STATE_FILE = path.join(WORK_DIR, 'state.json')
fs.mkdirSync(WORK_DIR, { recursive: true })

type State = Record<string, { page?: number; done?: boolean }>
const state: State = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
// A filtered or partial run must not move the saved page cursor.
const trackPages = !SINCE && !IDS && LIMIT === Infinity && args.restart !== 'true'
if (args.restart === 'true') for (const k of Object.keys(state)) delete state[k]

const ctx = { disableRevalidate: true, disableTagCounts: true, skipContentHtml: true }
const log = (...m: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...m)

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

async function existingIds(payload: Payload, collection: 'users' | 'categories' | 'tags' | 'media' | 'posts' | 'pages' | 'redirects') {
  const ids = new Set<number>()
  let page = 1
  for (;;) {
    const res = await payload.find({ collection, limit: 2000, page, depth: 0, select: {}, pagination: true, overrideAccess: true, draft: false })
    res.docs.forEach((d) => ids.add(d.id as number))
    if (!res.hasNextPage) return ids
    page++
  }
}

/** First line of an error plus its causes (database errors hide the reason in `cause`). */
function errorText(err: unknown): string {
  const parts: string[] = []
  for (let e = err as { message?: string; cause?: unknown } | undefined; e && parts.length < 4; e = e.cause as typeof e) {
    if (e.message) parts.push(e.message.split('\n')[0].replace(/^Failed query: (insert|update|select)[^]*?(returning|where)[^]*$/i, 'Failed query'))
  }
  return parts.join(' ← ')
}

// ---------- steps ----------
/**
 * Accounts arrive without a password (WordPress hashes can't be carried
 * over): each person sets one with "Forgot password" on the CMS. Written
 * with payload.db so no password is ever generated or stored.
 */
async function migrateUsers(payload: Payload, wp: WordPress) {
  const have = await existingIds(payload, 'users')
  const params = wp.authenticated ? { context: 'edit' } : {}
  for await (const { items } of wp.pages<WPUser>('/users', params)) {
    for (const u of items) {
      if (have.has(u.id) && !UPDATE) continue
      const role = u.roles?.includes('administrator') ? 'admin' : u.roles?.includes('editor') || !u.roles ? 'editor' : 'author'
      const data = {
        name: decodeEntities(u.name),
        slug: decodeSlug(u.slug),
        bio: u.description || null,
        showByline: true,
      }
      if (have.has(u.id)) {
        // Byline visibility is decided in the CMS; keep it.
        const { showByline: _keep, ...fromWordPress } = data
        await payload.db.updateOne({ collection: 'users', id: u.id, data: fromWordPress })
        continue
      }
      // Without an Application Password the API hides emails; an admin fills
      // in the real address before that person uses "Forgot password".
      const email = u.email || `${decodeSlug(u.slug)}@users.theinsightnews.invalid`
      await payload.db.create({ collection: 'users', data: { id: u.id, email, role, ...data } })
      log(`user ${u.id} ${u.name} (${role}${u.email ? '' : ', placeholder email'})`)
    }
  }
}

async function migrateCategories(payload: Payload, wp: WordPress) {
  const have = await existingIds(payload, 'categories')
  const all: WPTerm[] = []
  for await (const { items } of wp.pages<WPTerm>('/categories', { hide_empty: 'false', _fields: 'id,name,slug,description,parent,count,link,yoast_head_json' })) all.push(...items)
  // Parents first so the relation exists.
  all.sort((a, b) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0))
  for (const c of all) {
    const slug = decodeSlug(c.slug)
    const seo = yoastMeta(c.yoast_head_json, decodeEntities(c.name), c.link)
    const data = {
      name: decodeEntities(c.name),
      slug,
      description: c.description || undefined,
      parent: c.parent || undefined,
      order: 100,
      showInMenu: true,
      noindex: seo.noindex ?? false,
      meta: { title: seo.title, description: seo.description, noindex: seo.noindex ?? false, nofollow: seo.nofollow ?? false },
    }
    if (have.has(c.id)) {
      // Menu order, visibility and SEO are managed in the CMS after the first import.
      const { order: _o, showInMenu: _m, noindex: _n, meta: _s, ...fromWordPress } = data
      if (UPDATE) await payload.update({ collection: 'categories', id: c.id, data: fromWordPress as never, overrideAccess: true, context: ctx })
      continue
    }
    await payload.create({ collection: 'categories', data: { id: c.id, ...data } as never, overrideAccess: true, context: ctx })
    log(`category ${c.id} ${slug}`)
  }
}

async function migrateTags(payload: Payload, wp: WordPress) {
  const have = await existingIds(payload, 'tags')
  const key = 'tags'
  let n = 0
  for await (const { items, page, totalPages, total } of wp.pages<WPTerm>('/tags', { hide_empty: 'false' }, trackPages ? (state[key]?.page ?? 0) + 1 : 1)) {
    for (const t of items) {
      if (have.has(t.id)) continue
      await payload.db.create({
        collection: 'tags',
        data: {
          id: t.id,
          name: decodeEntities(t.name),
          slug: decodeSlug(t.slug),
          description: t.description || null,
          postCount: t.count,
        },
      })
      n++
    }
    if (trackPages) {
      state[key] = { page }
      saveState()
    }
    if (page % 20 === 0 || page === totalPages) log(`tags page ${page}/${totalPages} (+${n}, ${total} in WordPress)`)
  }
}

function mediaData(m: WPMedia) {
  let rel = m.media_details?.file
  if (!rel) {
    try {
      rel = decodeURIComponent(new URL(m.source_url).pathname).split('/wp-content/uploads/')[1]
    } catch {
      rel = undefined
    }
  }
  rel = rel || `${new Date(gmt(m.date_gmt)!).getUTCFullYear()}/${path.basename(m.source_url)}`
  const dir = path.posix.dirname(rel)
  return {
    id: m.id,
    filename: path.posix.basename(rel),
    prefix: dir && dir !== '.' ? `${UPLOADS}/${dir}` : UPLOADS,
    mimeType: m.mime_type,
    filesize: m.media_details?.filesize ?? null,
    width: m.media_details?.width ?? null,
    height: m.media_details?.height ?? null,
    alt: m.alt_text || null,
    caption: stripHtml(m.caption?.rendered ?? '') || null,
    createdAt: gmt(m.date_gmt),
    updatedAt: gmt(m.modified_gmt),
  }
}

async function migrateMedia(payload: Payload, wp: WordPress) {
  const have = await existingIds(payload, 'media')
  const key = 'media'
  let n = 0
  const params = {
    _fields: 'id,date_gmt,modified_gmt,caption,alt_text,mime_type,source_url,media_details,author',
    ...(SINCE ? { modified_after: SINCE } : {}),
  }
  for await (const { items, page, totalPages, total } of wp.pages<WPMedia>('/media', params, trackPages ? (state[key]?.page ?? 0) + 1 : 1)) {
    for (const m of items) {
      if (have.has(m.id)) continue
      try {
        await payload.db.create({ collection: 'media', data: mediaData(m) })
        n++
      } catch (err) {
        log(`media ${m.id} skipped: ${errorText(err)}`)
      }
    }
    if (trackPages) {
      state[key] = { page }
      saveState()
    }
    if (page % 20 === 0 || page === totalPages) log(`media page ${page}/${totalPages} (+${n}, ${total} in WordPress)`)
  }
}

async function loadMediaIndex(payload: Payload): Promise<MediaIndex> {
  const byId = new Map<number, MediaLite>()
  const byPath = new Map<string, number>()
  let page = 1
  for (;;) {
    const res = await payload.find({
      collection: 'media',
      limit: 5000,
      page,
      depth: 0,
      overrideAccess: true,
      select: { filename: true, prefix: true, alt: true, width: true, height: true },
    })
    for (const m of res.docs as unknown as MediaLite[]) {
      byId.set(m.id, m)
      if (m.filename) byPath.set([m.prefix, m.filename].filter(Boolean).join('/'), m.id)
    }
    if (!res.hasNextPage) break
    page++
  }
  log(`media index: ${byId.size} items`)
  return { byId, byPath }
}

const normTitle = (t: string) => t.replace(/[“”„"]/g, '"').replace(/[‘’']/g, "'").replace(/\s+/g, ' ').trim()
/** Yoast appends " : The Insight News"; keep only a title an editor actually customised. */
function customTitle(metaTitle: string | undefined, title: string) {
  if (!metaTitle) return undefined
  const bare = metaTitle.replace(/\s*[:»|–-]\s*The Insight News\s*$/i, '').trim()
  return normTitle(bare) === normTitle(title) ? undefined : bare
}

/** Yoast values from `yoast_head_json`; only what differs from the defaults. */
function yoastMeta(y: YoastHead | undefined | null, title: string, link?: string) {
  if (!YOAST || !y) return {} as { title?: string; description?: string; canonical?: string; noindex?: boolean; nofollow?: boolean }
  const canonical = y.canonical?.trim()
  const own = (u: string) => u.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '')
  return {
    title: customTitle(y.title ? decodeEntities(y.title) : undefined, title),
    description: y.description ? decodeEntities(y.description).trim() : undefined,
    noindex: /noindex/.test(y.robots?.index ?? ''),
    nofollow: /nofollow/.test(y.robots?.follow ?? ''),
    // Only a canonical pointing somewhere else (the default is the page itself).
    canonical: canonical && link && own(canonical) !== own(link) ? canonical : undefined,
  }
}

/**
 * WordPress sometimes has several attachment records for one file; only the
 * first was imported. Map a duplicate id to the imported record by its path.
 */
const featuredCache = new Map<number, number | undefined>()
async function resolveFeatured(wp: WordPress, id: number, media: MediaIndex): Promise<number | undefined> {
  if (!id) return undefined
  if (media.byId.has(id)) return id
  if (featuredCache.has(id)) return featuredCache.get(id)
  let found: number | undefined
  try {
    const { data } = await wp.json<WPMedia>(`/media/${id}`, { _fields: 'id,source_url,media_details' })
    found = resolveMediaUrl(data.source_url, media) ?? undefined
  } catch {
    found = undefined
  }
  featuredCache.set(id, found)
  return found
}

const WP_STATUS: Record<string, 'published' | 'draft'> = { publish: 'published', future: 'published', draft: 'draft', pending: 'draft', private: 'draft' }

async function migrateContent(
  payload: Payload,
  wp: WordPress,
  kind: 'posts' | 'pages',
  media: MediaIndex,
  editorConfig: Awaited<ReturnType<typeof editorConfigFactory.fromEditor>>,
) {
  const have = await existingIds(payload, kind)
  const tags = kind === 'posts' ? await existingIds(payload, 'tags') : new Set<number>()
  const cats = kind === 'posts' ? await existingIds(payload, 'categories') : new Set<number>()
  const users = await existingIds(payload, 'users')
  // Posts must have a category; WordPress here has no "Uncategorized" (id 1).
  const DEFAULT_CATEGORY = cats.has(1) ? 1 : 1719
  const key = kind
  const report = fs.createWriteStream(path.join(WORK_DIR, `${kind}-warnings.log`), { flags: 'a' })
  let created = 0
  let updated = 0
  let failed = 0
  let seen = 0

  const params: Record<string, string> = {
    _fields: 'id,date_gmt,modified_gmt,slug,status,link,title,content,excerpt,author,featured_media,categories,tags,sticky,format,yoast_head_json',
    ...(wp.authenticated ? { status: 'publish,future,draft,pending,private', context: 'edit' } : {}),
    ...(SINCE ? { modified_after: SINCE } : {}),
  }

  // Titles and excerpts as typed: wp/v2 only has them run through wptexturize
  // (curly quotes, en dashes), which the old site never showed. The Headless
  // Helpers plugin returns the plain text.
  const plain = new Map<number, { title: string; excerpt: string }>()
  const loadPlain = async (ids: number[]) => {
    if (kind !== 'posts' || !ids.length) return
    try {
      const { data } = await wp.json<{ id: number; title: string; excerpt: string }[]>(`${wp.base}/wp-json/tin/v1/posts`, {
        include: ids.join(','),
        per_page: ids.length,
        _fields: 'id,title,excerpt',
      })
      data.forEach((d) => plain.set(d.id, d))
    } catch {
      // Fall back to the rendered text.
    }
  }

  const one = async (p: WPPost) => {
    const exists = have.has(p.id)
    if (exists && !UPDATE) return
    try {
      const title = (plain.get(p.id)?.title ?? untexturize(decodeEntities(p.title.rendered))).trim() || `(ไม่มีชื่อ ${p.id})`
      const { state: content, mediaIds, warnings } = htmlToLexical(p.content.rendered ?? '', { editorConfig, media, DOM: JSDOM as never })
      warnings.forEach((w) => report.write(`${p.id}\t${w}\n`))
      const lookup = new Map<number, MediaLite>(mediaIds.map((id) => [id, media.byId.get(id)!]))
      const seo = yoastMeta(p.yoast_head_json, title, p.link)
      const featured = await resolveFeatured(wp, p.featured_media, media)
      // A share image picked in Yoast, when it isn't just the featured image (or a size of it).
      const ogUrl = YOAST ? p.yoast_head_json?.og_image?.[0]?.url : undefined
      const ogImage = ogUrl ? (resolveMediaUrl(ogUrl, media) ?? undefined) : undefined
      const categories = (p.categories ?? []).filter((c) => cats.has(c))
      const primary = categories[0]
      const excerpt = plain.get(p.id)?.excerpt?.trim() || cleanExcerpt(p.excerpt?.raw || p.excerpt?.rendered || '')
      const data = {
        title,
        slug: decodeSlug(p.slug),
        content,
        contentHtml: lexicalToHTML(content as never, lookup),
        // From WordPress's own content, as the old site counted it.
        readingMinutes: readingMinutes(p.content.rendered),
        excerpt: excerpt || undefined,
        featuredImage: featured,
        publishedAt: gmt(p.date_gmt),
        author: users.has(p.author) ? p.author : undefined,
        ...(kind === 'posts'
          ? {
              categories: categories.length ? categories : [DEFAULT_CATEGORY],
              primaryCategory: primary ?? DEFAULT_CATEGORY,
              tags: (p.tags ?? []).filter((t) => tags.has(t)),
              sticky: Boolean(p.sticky),
              format: p.format === 'video' || p.format === 'gallery' ? p.format : 'standard',
            }
          : {}),
        _status: WP_STATUS[p.status] ?? 'draft',
        meta: {
          image: ogImage && ogImage !== featured ? ogImage : undefined,
          title: seo.title,
          description: seo.description,
          canonical: seo.canonical,
          noindex: seo.noindex ?? false,
          nofollow: seo.nofollow ?? false,
        },
        createdAt: gmt(p.date_gmt),
      }
      if (exists) {
        await payload.update({ collection: kind, id: p.id, data: data as never, overrideAccess: true, context: ctx })
        // Keep WordPress's modified date: re-importing is not an editorial change.
        await payload.db.updateOne({ collection: kind, id: p.id, data: { updatedAt: gmt(p.modified_gmt) } })
        updated++
      } else {
        await payload.create({ collection: kind, data: { id: p.id, ...data } as never, overrideAccess: true, context: ctx })
        // Keep WordPress's timestamps (the import is not an edit).
        await payload.db.updateOne({ collection: kind, id: p.id, data: { updatedAt: gmt(p.modified_gmt), createdAt: gmt(p.date_gmt) } })
        created++
      }
    } catch (err) {
      failed++
      const msg = errorText(err)
      report.write(`${p.id}\tFAILED\t${msg}\n`)
      log(`${kind} ${p.id} failed: ${msg}`)
    }
  }

  // --ids: fetch in groups of 100 (a long include= list overflows WordPress's response headers).
  const idGroups = IDS ? IDS.split(',').reduce<string[][]>((g, id, i) => (i % 100 ? g[g.length - 1].push(id) : g.push([id]), g), []) : [null]
  for (const group of idGroups)
  for await (const { items, page, totalPages, total } of wp.pages<WPPost>(`/${kind}`, group ? { ...params, include: group.join(',') } : params, trackPages ? (state[key]?.page ?? 0) + 1 : 1)) {
    const batch = items.slice(0, Math.max(0, LIMIT - seen))
    seen += batch.length
    await loadPlain(batch.map((p) => p.id))
    await pool(batch, CONCURRENCY, one)
    if (trackPages) {
      state[key] = { page }
      saveState()
    }
    log(`${kind} page ${page}/${totalPages} — created ${created}, updated ${updated}, failed ${failed} (of ${total})`)
    if (seen >= LIMIT) break
  }
  report.end()

  if (!KEEP_VERSIONS && created) {
    // --drop-versions: remove the version rows the import wrote. The admin
    // list will then be empty for those stories (it reads versions).
    const versions = kind === 'posts' ? '_posts_v' : '_pages_v'
    await payload.db.drizzle.run(
      sql.raw(`DELETE FROM ${versions} WHERE parent_id IN (SELECT id FROM ${kind})
               AND parent_id IN (SELECT parent_id FROM ${versions} GROUP BY parent_id HAVING COUNT(*) = 1)`),
    )
    log(`${kind}: dropped import-time version copies`)
  }
}

/**
 * Renamed posts: WordPress keeps each previous slug (`_wp_old_slug`) so old
 * links still redirect. Read from the Headless Helpers plugin's
 * /tin/v1/old-slugs (added for this migration; older plugin versions 404,
 * and the step is skipped).
 */
async function migrateRedirects(payload: Payload, wp: WordPress) {
  const res = await wp.fetch(`${wp.base}/wp-json/tin/v1/old-slugs`, 3)
  if (!res.ok) {
    log(`redirects skipped: /tin/v1/old-slugs → ${res.status} (update the WordPress plugin to export old slugs)`)
    return
  }
  const rows = (await res.json()) as { post: number; slug: string }[]
  const posts = await existingIds(payload, 'posts')
  const have = new Set<string>()
  let page = 1
  for (;;) {
    const r = await payload.find({ collection: 'redirects', limit: 2000, page, depth: 0, overrideAccess: true, select: { from: true } })
    r.docs.forEach((d) => have.add((d as { from: string }).from))
    if (!r.hasNextPage) break
    page++
  }
  let n = 0
  for (const row of rows) {
    const from = decodeSlug(row.slug)
    if (!from || have.has(from) || !posts.has(row.post)) continue
    await payload.create({ collection: 'redirects', data: { from, post: row.post } as never, overrideAccess: true, context: ctx })
    have.add(from)
    n++
  }
  log(`redirects: +${n} old slugs (${rows.length} in WordPress)`)
}

async function recountTags(payload: Payload) {
  await payload.db.drizzle.run(
    sql.raw(`UPDATE tags SET post_count = (
       SELECT COUNT(*) FROM posts_rels r JOIN posts p ON p.id = r.parent_id
       WHERE r.path = 'tags' AND r.tags_id = tags.id AND p._status = 'published')`),
  )
  log('tag post counts recalculated')
}

// ---------- run ----------
const wp = new WordPress(WP_URL, { user: process.env.WP_USER ?? '', password: process.env.WP_APP_PASSWORD ?? '' })
log(`WordPress ${WP_URL}${wp.authenticated ? ' (authenticated: drafts included)' : ' (public API: published content only)'}`)

const dbSteps = [...steps].filter((s) => s !== 'files' && s !== 'sizes')
if (dbSteps.length) {
  const { default: config } = await import('../../src/payload.config')
  const payload = await getPayload({ config })
  log(`target: ${process.env.PAYLOAD_REMOTE === '1' ? 'Cloudflare (remote D1/R2)' : 'local D1 (.wrangler)'}; steps: ${dbSteps.join(', ')}`)

  if (steps.has('users')) await migrateUsers(payload, wp)
  if (steps.has('categories')) await migrateCategories(payload, wp)
  if (steps.has('tags')) await migrateTags(payload, wp)
  if (steps.has('media')) await migrateMedia(payload, wp)
  if (steps.has('posts') || steps.has('pages')) {
    const media = await loadMediaIndex(payload)
    const editorConfig = await editorConfigFactory.fromEditor({ config: payload.config, editor: articleEditor })
    if (steps.has('posts')) await migrateContent(payload, wp, 'posts', media, editorConfig)
    if (steps.has('pages')) await migrateContent(payload, wp, 'pages', media, editorConfig)
  }
  if (steps.has('redirects')) await migrateRedirects(payload, wp)
  if (steps.has('counts') || steps.has('posts')) await recountTags(payload)
}

// Files go to the real R2 bucket (not the local database), see files.ts.
if (steps.has('files')) {
  await copyFiles(wp, {
    concurrency: Number(args['file-concurrency'] ?? 16),
    workDir: WORK_DIR,
    local: args['local-r2'] === 'true',
    since: SINCE,
  })
}

// Resized copies for the website (reads the local database, writes to R2).
if (steps.has('sizes')) {
  await generateSizes({
    workDir: WORK_DIR,
    concurrency: Number(args['file-concurrency'] ?? 12),
    local: args['local-r2'] === 'true',
    mediaUrl: (process.env.MEDIA_URL || 'https://files.theinsightnews.co').replace(/\/$/, ''),
  })
}

log('done')
process.exit(0)
