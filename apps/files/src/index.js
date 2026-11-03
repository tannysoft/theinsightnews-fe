/**
 * files.theinsightnews.co: serves /wp-content/uploads/* from R2.
 *
 * Until cutover, editors still upload to WordPress, so a file missing from
 * R2 is fetched from WordPress (env.ORIGIN), returned, and copied into R2.
 * Anything outside /wp-content/uploads/ is passed through to WordPress.
 */
const UPLOADS = '/wp-content/uploads/'
const YEAR = 'public, max-age=31536000, immutable'
const MONTH = 'public, max-age=2592000'
// Don't copy huge files (videos) into R2 on the request path.
const MAX_COPY = 100 * 1024 * 1024

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
    }
    if (!url.pathname.startsWith(UPLOADS)) return fetch(new Request(env.ORIGIN + url.pathname + url.search, request))

    // Own cache key, separate from what the zone cached when this host proxied
    // WordPress. match() answers Range and If-None-Match itself.
    const cacheUrl = `${url.origin}${url.pathname}?src=r2`
    const hit = await caches.default.match(new Request(cacheUrl, { headers: request.headers }))
    if (hit) {
      const res = new Response(request.method === 'HEAD' ? null : hit.body, hit)
      res.headers.set('x-files-source', 'cache')
      return res
    }
    const plain = !request.headers.has('range') && !request.headers.has('if-none-match') && !request.headers.has('if-modified-since')
    const cacheKey = new Request(cacheUrl)

    let key
    try {
      key = decodeURIComponent(url.pathname.slice(1))
    } catch {
      return new Response('Bad path', { status: 400 })
    }

    const obj = await getObject(env.R2, key, request)
    if (obj) return fromR2(obj, request, plain, cacheKey, ctx)

    // Not in R2 yet: ask WordPress.
    const origin = await fetch(env.ORIGIN + url.pathname, { cf: { cacheTtl: 0 } })
    if (!origin.ok) {
      return new Response(origin.status === 404 ? 'Not found' : 'Upstream error', {
        status: origin.status === 404 ? 404 : 502,
        headers: { 'cache-control': 'public, max-age=60' },
      })
    }
    const type = origin.headers.get('content-type') || 'application/octet-stream'
    const size = Number(origin.headers.get('content-length') || 0)
    const headers = new Headers({ 'content-type': type, 'cache-control': MONTH, 'x-files-source': 'wordpress' })
    if (size) headers.set('content-length', String(size))

    if (size && size <= MAX_COPY) {
      const [toClient, toR2] = origin.body.tee()
      ctx.waitUntil(env.R2.put(key, toR2, { httpMetadata: { contentType: type } }).catch((e) => console.error('copy failed', key, e)))
      return new Response(request.method === 'HEAD' ? null : toClient, { status: 200, headers })
    }
    return new Response(request.method === 'HEAD' ? null : origin.body, { status: 200, headers })
  },
}

// WordPress sometimes stores accented names decomposed (é = e + ◌́); try both forms.
async function getObject(bucket, key, request) {
  const opts = { onlyIf: request.headers, range: request.headers }
  for (const k of new Set([key, key.normalize('NFC'), key.normalize('NFD')])) {
    const obj = await bucket.get(k, opts)
    if (obj) return obj
  }
  return null
}

function fromR2(obj, request, plain, cacheKey, ctx) {
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('last-modified', obj.uploaded.toUTCString())
  headers.set('accept-ranges', 'bytes')
  headers.set('x-files-source', 'r2')
  // Resized WebP names are derived from the original and never change.
  headers.set('cache-control', /-\d+w\.webp$/.test(obj.key) ? YEAR : MONTH)
  if (!headers.has('content-type')) headers.set('content-type', 'application/octet-stream')

  // Precondition matched (304) — R2 returns metadata without a body.
  if (!('body' in obj)) return new Response(null, { status: 304, headers })

  if (obj.range && request.headers.has('range')) {
    const { offset = 0, length = obj.size - offset } = obj.range
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`)
    headers.set('content-length', String(length))
    return new Response(request.method === 'HEAD' ? null : obj.body, { status: 206, headers })
  }

  headers.set('content-length', String(obj.size))
  if (request.method === 'HEAD') return new Response(null, { headers })
  if (!plain) return new Response(obj.body, { headers })
  const [a, b] = obj.body.tee()
  ctx.waitUntil(caches.default.put(cacheKey, new Response(b, { headers })))
  return new Response(a, { headers })
}
