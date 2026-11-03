import fs from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import sharp from 'sharp'
import { openBucket } from './files'
import { IMAGE_SIZES, RESIZABLE, sizeKey } from '@theinsightnews/shared/image-sizes'

/**
 * Backfill the resized WebP copies (packages/shared/src/image-sizes.ts) for every image
 * already in the library. Resizes with sharp on this machine (no Cloudflare
 * Images charges), reading originals from the public media domain and
 * writing the copies to the R2 bucket.
 * Done ids: .migrate/sizes-done.txt; failures: .migrate/sizes-failed.tsv.
 */
export async function generateSizes(opts: { workDir: string; concurrency: number; local: boolean; mediaUrl: string }) {
  const dbFile = fs
    .readdirSync(path.resolve(opts.workDir, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject'))
    .filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
    .map((f) => path.resolve(opts.workDir, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject', f))
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0]
  const db = new DatabaseSync(dbFile, { readOnly: true })
  const rows = db
    .prepare('SELECT id, prefix, filename, mime_type AS mime FROM media WHERE filename IS NOT NULL ORDER BY id DESC')
    .all() as { id: number; prefix: string | null; filename: string; mime: string | null }[]
  db.close()

  const doneFile = path.join(opts.workDir, 'sizes-done.txt')
  const failFile = path.join(opts.workDir, 'sizes-failed.tsv')
  const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean).map(Number) : [])
  const todo = rows.filter((r) => RESIZABLE.test(r.mime ?? '') && !done.has(r.id))
  const doneOut = fs.createWriteStream(doneFile, { flags: 'a' })
  const failOut = fs.createWriteStream(failFile, { flags: 'a' })
  const bucket = await openBucket(opts.local)
  console.log(`sizes → ${bucket.label}; ${todo.length} images to resize (newest first), ${done.size} already done`)

  sharp.concurrency(2)
  let n = 0
  let failed = 0
  let i = 0
  const started = Date.now()
  await Promise.all(
    Array.from({ length: opts.concurrency }, async () => {
      while (i < todo.length) {
        const m = todo[i++]
        const key = [m.prefix, m.filename].filter(Boolean).join('/')
        try {
          const res = await fetch(`${opts.mediaUrl}/${key.split('/').map(encodeURIComponent).join('/')}`)
          if (!res.ok) throw new Error(`${res.status} original`)
          const input = Buffer.from(await res.arrayBuffer())
          for (const width of Object.values(IMAGE_SIZES)) {
            const out = await sharp(input, { failOn: 'none' })
              .rotate()
              .resize({ width, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer()
            await bucket.put(sizeKey(key, width), new Uint8Array(out).buffer, 'image/webp')
          }
          doneOut.write(`${m.id}\n`)
          n++
        } catch (err) {
          failed++
          failOut.write(`${m.id}\t${key}\t${(err as Error).message}\n`)
        }
        if ((n + failed) % 500 === 0) {
          const mins = (Date.now() - started) / 60000
          console.log(`${new Date().toISOString().slice(11, 19)} sizes ${n + failed}/${todo.length}: ok ${n}, failed ${failed} — ${(n / Math.max(mins, 0.01)).toFixed(0)}/min`)
        }
      }
    }),
  )
  doneOut.end()
  failOut.end()
  console.log(`sizes done: ${n} resized, ${failed} failed`)
  // Let the CMS hand out the new URLs (media.sizesReady).
  if (!opts.local) execSync('bash scripts/mark-sizes-ready.sh', { stdio: 'inherit', cwd: path.resolve(opts.workDir, '..') })
}
