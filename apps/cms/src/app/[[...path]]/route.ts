/**
 * Everything on cms.theinsightnews.co that isn't Payload (/admin, /api,
 * /_next) goes to the same path on the public site: this host was WordPress
 * until 2026-11-03, so old links, bookmarks and crawlers still ask it for
 * stories, /wp-admin and the like. Uploads go to the media host, which has
 * the same /wp-content/uploads paths.
 */
const WEB_URL = (process.env.WEB_URL || 'https://www.theinsightnews.co').replace(/\/+$/, '')
const MEDIA_URL = (process.env.MEDIA_URL || 'https://files.theinsightnews.co').replace(/\/+$/, '')

function toWeb(request: Request, status: number) {
  const { pathname, search } = new URL(request.url)
  const host = pathname.startsWith('/wp-content/uploads/') ? MEDIA_URL : WEB_URL
  return new Response(null, {
    status,
    headers: { location: `${host}${pathname}${search}`, 'cache-control': 'public, max-age=3600' },
  })
}

const permanent = (request: Request) => toWeb(request, 301)
// 308 keeps the method and body for anything that isn't a plain read.
const keepMethod = (request: Request) => toWeb(request, 308)

export const GET = permanent
export const HEAD = permanent
export const POST = keepMethod
export const PUT = keepMethod
export const PATCH = keepMethod
export const DELETE = keepMethod
export const OPTIONS = keepMethod
