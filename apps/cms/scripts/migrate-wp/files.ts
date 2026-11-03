import fs from 'node:fs'
import path from 'node:path'
import type { WordPress, WPMedia } from './wp'

/**
 * Check every WordPress media file against the R2 bucket and upload the ones
 * that are missing, at the same path WordPress serves them from (wp-content/uploads/{yyyy}/{mm}/{file}).
 * The resized copies WordPress made (-300x169.jpg…) are copied too: the live
 * WordPress-backed site links to them, and files.theinsightnews.co moves to
 * this bucket before the cutover. The CMS's own WebP sizes come from the
 * `sizes` step.
 *
 * The list comes straight from the WordPress API (not the CMS database), so
 * this step can run on its own, even while other steps are importing.
 *
 * R2 access, in order of preference:
 *  - S3 API when R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET are set;
 *  - otherwise the real bucket through your `wrangler login` (the "files" env in wrangler.jsonc);
 *  - `--local-r2` writes to the local .wrangler bucket instead (testing).
 * Progress: checked ids in .migrate/files-done.txt, failures in .migrate/files-failed.tsv.
 */
export type Bucket = {
  label: string
  exists: (key: string) => Promise<boolean>
  put: (key: string, body: ArrayBuffer, contentType: string) => Promise<void>
}

const CACHE = 'public, max-age=31536000, immutable'

export async function openBucket(local: boolean): Promise<Bucket> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  if (!local && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    const { S3Client, PutObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3')
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
    return {
      label: `R2 bucket ${R2_BUCKET} (S3 API)`,
      exists: async (Key) => {
        try {
          await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key }))
          return true
        } catch {
          return false
        }
      },
      put: async (Key, body, ContentType) => {
        await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key, Body: new Uint8Array(body), ContentType, CacheControl: CACHE }))
      },
    }
  }

  const { getPlatformProxy } = await import('wrangler')
  const proxy = await getPlatformProxy<{ R2: R2Like }>({
    configPath: path.resolve(import.meta.dirname, '../../wrangler.jsonc'),
    environment: local ? undefined : 'files',
    remoteBindings: !local,
    persist: process.env.WRANGLER_PERSIST_TO ? { path: process.env.WRANGLER_PERSIST_TO } : undefined,
  })
  const r2 = proxy.env.R2
  return {
    label: local ? 'local R2 (.wrangler)' : 'R2 bucket theinsightnews-media (via wrangler login)',
    exists: async (key) => Boolean(await r2.head(key)),
    put: async (key, body, contentType) => {
      await r2.put(key, body, { httpMetadata: { contentType, cacheControl: CACHE } })
    },
  }
}

type R2Like = {
  head: (k: string) => Promise<unknown>
  put: (k: string, v: ArrayBuffer, o: object) => Promise<unknown>
}

/** Storage keys of a WordPress attachment: the original plus every size WordPress generated. */
export function mediaKeys(m: Pick<WPMedia, 'media_details' | 'source_url'>): string[] {
  const original = mediaKey(m)
  if (!original) return []
  const dir = original.slice(0, original.lastIndexOf('/'))
  // original_image: the unscaled upload WordPress keeps next to a -scaled one.
  const sizes = [...Object.values(m.media_details?.sizes ?? {}).map((s) => s?.file), m.media_details?.original_image]
    .filter((f): f is string => Boolean(f))
    .map((f) => `${dir}/${f}`)
  return [...new Set([original, ...sizes])]
}

/** Storage key of a WordPress attachment: its path under wp-content/uploads. */
export function mediaKey(m: Pick<WPMedia, 'media_details' | 'source_url'>): string | null {
  let rel: string | null | undefined = m.media_details?.file
  if (!rel) {
    try {
      rel = decodeURIComponent(new URL(m.source_url).pathname).split('/wp-content/uploads/')[1]
    } catch {
      rel = null
    }
  }
  return rel ? `${UPLOADS}/${rel}` : null
}

/** R2 keys keep WordPress's public path, so old files.theinsightnews.co URLs resolve unchanged. */
export const UPLOADS = 'wp-content/uploads'

export async function copyFiles(
  wp: WordPress,
  opts: { concurrency: number; workDir: string; local: boolean; since?: string },
) {
  const bucket = await openBucket(opts.local)
  const doneFile = path.join(opts.workDir, opts.local ? 'files-done-local.txt' : 'files-done.txt')
  const failFile = path.join(opts.workDir, 'files-failed.tsv')
  const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean).map(Number) : [])
  const doneOut = fs.createWriteStream(doneFile, { flags: 'a' })
  const failOut = fs.createWriteStream(failFile, { flags: 'a' })
  console.log(`files → ${bucket.label}; ${done.size} already checked`)

  let present = 0
  let uploaded = 0
  let failed = 0
  let bytes = 0
  const started = Date.now()
  const params = {
    _fields: 'id,source_url,mime_type,media_details',
    ...(opts.since ? { modified_after: opts.since } : {}),
  }

  for await (const { items, page, totalPages } of wp.pages<WPMedia>('/media', params)) {
    const todo = items.filter((m) => !done.has(m.id))
    let i = 0
    await Promise.all(
      Array.from({ length: Math.min(opts.concurrency, todo.length) }, async () => {
        while (i < todo.length) {
          const m = todo[i++]
          const keys = mediaKeys(m)
          const key = keys[0]
          try {
            if (!key) throw new Error('no file path')
            for (const [i, k] of keys.entries()) {
              if (await bucket.exists(k)) {
                present++
                continue
              }
              const url = `${wp.base}/${k.split('/').map(encodeURIComponent).join('/')}`
              const res = await wp.fetch(url, 4)
              // A missing generated size isn't fatal; a missing original is.
              if (!res.ok && i > 0) continue
              if (!res.ok) throw new Error(`${res.status} ${url}`)
              const body = await res.arrayBuffer()
              await bucket.put(k, body, res.headers.get('content-type') || m.mime_type || 'application/octet-stream')
              uploaded++
              bytes += body.byteLength
            }
            doneOut.write(`${m.id}\n`)
          } catch (err) {
            failed++
            failOut.write(`${m.id}\t${key ?? ''}\t${(err as Error).message}\n`)
          }
        }
      }),
    )
    if (page % 10 === 0 || page === totalPages) {
      const mins = (Date.now() - started) / 60000
      console.log(
        `${new Date().toISOString().slice(11, 19)} files page ${page}/${totalPages}: already in bucket ${present}, uploaded ${uploaded} (${(bytes / 1e9).toFixed(2)} GB), failed ${failed} — ${mins.toFixed(1)} min`,
      )
    }
  }
  doneOut.end()
  failOut.end()
  console.log(`files done: already in bucket ${present}, uploaded ${uploaded}, failed ${failed}`)
  if (failed) console.log(`failures in ${failFile} — run the step again to retry them`)
}
