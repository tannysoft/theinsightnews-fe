/** Public base URL of the website (used for previews and cache revalidation). */
export const WEB_URL = (process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '')

/**
 * Public base URL of the R2 media bucket (custom domain:
 * https://files.theinsightnews.co). When unset, files are served through
 * Payload's own /api/media/file route.
 */
export const MEDIA_URL = (process.env.MEDIA_URL || '').replace(/\/$/, '')

export const mediaFileURL = (prefix: string | null | undefined, filename: string) => {
  const key = [prefix, filename].filter(Boolean).join('/')
  const path = key.split('/').map(encodeURIComponent).join('/')
  if (MEDIA_URL) return `${MEDIA_URL}/${path}`
  // Payload's file route tells same-named files apart by their folder.
  return `/api/media/file/${encodeURIComponent(filename)}${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''}`
}
