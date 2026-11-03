/**
 * Export the local D1 database (filled by `pnpm migrate:wp`) as a data-only
 * SQL file that the remote D1 can import:
 *
 *  - D1 caps every SQL statement at 100 KB. Long stories (Thai text is 3
 *    bytes per character) are inserted with their big text columns empty,
 *    then filled with UPDATE … || chunk statements.
 *  - Skips tables the remote already manages: payload_migrations (the schema
 *    comes from `payload migrate`), sessions, preferences, locks.
 *  - Users are copied without passwords (an admin sets them on the live CMS).
 *  - Skips users the remote already has (by id), so an admin account created
 *    on the live CMS is kept — e.g. id 1 created through the admin UI takes
 *    over WordPress user 1's stories.
 *
 *   tsx scripts/export-d1.ts <local.sqlite> <out.sql> [--skip-user-ids=1,2]
 */
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const [, , dbPath, outPath, ...rest] = process.argv
if (!dbPath || !outPath) {
  console.error('usage: export-d1.ts <local.sqlite> <out.sql> [--skip-user-ids=1,2]')
  process.exit(1)
}
const skipUsers = new Set(
  (rest.find((a) => a.startsWith('--skip-user-ids='))?.split('=')[1] ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number),
)

const SKIP_TABLES = new Set([
  'payload_migrations',
  'users_sessions',
  'payload_preferences',
  'payload_preferences_rels',
  'payload_locked_documents',
  'payload_locked_documents_rels',
  'payload_kv',
  '_cf_METADATA',
  'sqlite_sequence',
])
// Parents before children (foreign keys).
const ORDER = ['users', 'media', 'categories', 'tags', 'posts', 'posts_rels', 'pages', '_posts_v', '_posts_v_rels', '_pages_v']

const MAX_STMT = 90_000 // bytes, under D1's 100 KB
const CHUNK = 60_000 // bytes per appended piece

const db = new DatabaseSync(dbPath, { readOnly: true })
const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
  .map((t) => t.name)
  .filter((t) => !SKIP_TABLES.has(t) && !t.startsWith('sqlite_'))
  .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))

const out = fs.createWriteStream(outPath)
const bytes = (s: string) => Buffer.byteLength(s, 'utf8')
const q = (name: string) => `"${name.replace(/"/g, '""')}"`
const lit = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString('hex')}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

/** Split a string into pieces of at most `max` UTF-8 bytes (never inside a character). */
function chunks(s: string, max: number): string[] {
  const parts: string[] = []
  let cur = ''
  let size = 0
  for (const ch of s) {
    const b = bytes(ch)
    if (size + b > max) {
      parts.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += b
  }
  if (cur) parts.push(cur)
  return parts
}

let statements = 0
let split = 0
out.write('PRAGMA defer_foreign_keys = true;\n')
for (const table of tables) {
  const cols = (db.prepare(`PRAGMA table_info(${q(table)})`).all() as { name: string }[]).map((c) => c.name)
  const hasId = cols.includes('id')
  let n = 0
  // D1 checks foreign keys per statement, so a parent category must come before its children.
  const select =
    table === 'categories'
      ? `WITH RECURSIVE d(id, depth) AS (
           SELECT id, 0 FROM categories WHERE parent_id IS NULL
           UNION ALL SELECT c.id, d.depth + 1 FROM categories c JOIN d ON c.parent_id = d.id
         ) SELECT c.* FROM categories c JOIN d USING (id) ORDER BY d.depth, c.id`
      : `SELECT * FROM ${q(table)}`
  for (const row of db.prepare(select).iterate() as Iterable<Record<string, unknown>>) {
    if (table === 'users') {
      if (skipUsers.has(Number(row.id))) continue
      // No local passwords go to production: an admin sets them in the CMS.
      row.hash = null
      row.salt = null
    }
    const values = cols.map((c) => lit(row[c]))
    const stmt = `INSERT INTO ${q(table)} (${cols.map(q).join(',')}) VALUES (${values.join(',')});\n`
    if (bytes(stmt) <= MAX_STMT || !hasId) {
      out.write(stmt)
      statements++
    } else {
      // Insert with the large text columns empty, then append them in pieces.
      const big = cols.filter((c) => typeof row[c] === 'string' && bytes(row[c] as string) > 2_000)
      const small = cols.map((c) => (big.includes(c) ? "''" : lit(row[c])))
      out.write(`INSERT INTO ${q(table)} (${cols.map(q).join(',')}) VALUES (${small.join(',')});\n`)
      statements++
      for (const c of big) {
        for (const piece of chunks(row[c] as string, CHUNK)) {
          out.write(`UPDATE ${q(table)} SET ${q(c)} = ${q(c)} || ${lit(piece)} WHERE id = ${lit(row.id)};\n`)
          statements++
        }
      }
      split++
    }
    n++
  }
  console.log(`${table}: ${n} rows`)
}
out.end()
console.log(`${statements} statements, ${split} long rows split → ${outPath}`)
