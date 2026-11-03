/**
 * Broken story images → review rows for /admin/image-recovery.
 *
 *   sqlite3 -json <local d1> "SELECT id, content_html FROM posts WHERE content_html LIKE '%songsue%'" > posts.json
 *   node 1-wayback-exact.mjs posts.json found.json     # same file in the Wayback Machine
 *   node 2-wayback-folders.mjs found.json              # other sizes of the same file
 *   node 3-seed-sql.mjs posts.json found.json > seed.sql
 *   npx wrangler d1 execute theinsightnews-cms --remote --file seed.sql
 *
 * Rows already present (same post + image) are skipped, so re-running is safe.
 */
import fs from 'node:fs'

const posts = new Map(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).map((p) => [p.id, p]))
const rows = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))

const text = (html) =>
  html
    .replace(/<figcaption[\s\S]*?<\/figcaption>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const lit = (v) => (v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const now = new Date().toISOString()

const out = []
for (const r of rows) {
  const html = posts.get(r.post)?.content_html ?? ''
  const at = html.indexOf(r.src)
  const tagStart = html.lastIndexOf('<img', at)
  const after = html.slice(at, at + 1500)
  const figEnd = after.indexOf('</figure>')
  const capMatch = (figEnd >= 0 ? after.slice(0, figEnd) : after.slice(0, 400)).match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)
  const caption = capMatch ? text(capMatch[1]) : ''
  const before = text(html.slice(Math.max(0, tagStart - 1500), tagStart)).slice(-220)
  const context = before ? `…${before}` : ''
  const f = r.found
  const candidate = f ? `https://web.archive.org/web/${f.ts}im_/${f.original}` : null
  const source = f ? (f.via === 'other-size' ? 'wayback-other-size' : 'wayback') : 'none'
  const archivedAt = f ? `${f.ts.slice(0, 4)}-${f.ts.slice(4, 6)}-${f.ts.slice(6, 8)}T00:00:00.000Z` : null
  out.push(
    `INSERT INTO image_recoveries (post_id, original_src, candidate_url, source, archived_at, caption, context, status, updated_at, created_at) ` +
      `SELECT ${r.post}, ${lit(r.src)}, ${lit(candidate)}, ${lit(source)}, ${lit(archivedAt)}, ${lit(caption)}, ${lit(context)}, 'pending', ${lit(now)}, ${lit(now)} ` +
      `WHERE NOT EXISTS (SELECT 1 FROM image_recoveries WHERE post_id = ${r.post} AND original_src = ${lit(r.src)});`,
  )
}
console.log(out.join('\n'))
console.error(`${out.length} rows, ${rows.filter((r) => r.found).length} with a candidate`)
