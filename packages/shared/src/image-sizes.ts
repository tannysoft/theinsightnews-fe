/**
 * Resized copies of every library image, matching what the website renders.
 * Shared by the CMS (generates them) and the website (requests them):
 *   thumbnail  list thumbnails (72–208 px wide on screen)
 *   medium     cards and the homepage grid (≈30–55% of the viewport)
 *   large      lead story, article hero and body images (≈880 px column)
 * Stored as WebP next to the original:
 *   {prefix}/{name}.jpg → {prefix}/{name}-{width}w.webp
 * The CMS makes them on upload (Cloudflare Images binding); imported files
 * are backfilled by `pnpm migrate:wp --steps=sizes`.
 */
export const IMAGE_SIZES = {
  thumbnail: 320,
  medium: 768,
  large: 1280,
} as const

export type ImageSizeName = keyof typeof IMAGE_SIZES

/** Formats we resize; anything else (GIF, SVG, PDF…) is served as the original. */
export const RESIZABLE = /^image\/(jpeg|png|webp|avif)$/

export function sizeKey(key: string, width: number) {
  return `${key.replace(/\.[^./]+$/, '')}-${width}w.webp`
}
