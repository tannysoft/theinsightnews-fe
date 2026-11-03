import type { CollectionAfterChangeHook, FieldHook } from 'payload'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { IMAGE_SIZES, RESIZABLE, sizeKey } from '@theinsightnews/shared/image-sizes'
import { mediaFileURL } from '../lib/env'

type MediaDoc = {
  filename?: string | null
  prefix?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
  sizesReady?: boolean | null
}

const storageKey = (doc: MediaDoc) => [doc.prefix, doc.filename].filter(Boolean).join('/')

/** The file type, from mimeType or (when a query didn't select it) the extension. */
const mimeOf = (doc: MediaDoc) =>
  doc.mimeType ??
  ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' } as Record<string, string>)[
    (doc.filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  ] ??
  ''

/** Virtual `sizes`: URLs of the resized copies (null for GIF/SVG/PDF…). */
export const sizesAfterRead: FieldHook = ({ data }) => {
  const doc = data as MediaDoc | undefined
  if (!doc?.filename || !doc.sizesReady || !RESIZABLE.test(mimeOf(doc))) return null
  const key = storageKey(doc)
  return Object.fromEntries(
    Object.entries(IMAGE_SIZES).map(([name, width]) => {
      const w = doc.width ? Math.min(width, doc.width) : width
      const h = doc.width && doc.height ? Math.round((doc.height * w) / doc.width) : null
      const file = sizeKey(key, width)
      const slash = file.lastIndexOf('/')
      return [name, { url: mediaFileURL(slash > 0 ? file.slice(0, slash) : null, file.slice(slash + 1)), width: w, height: h }]
    }),
  )
}

type ImagesBinding = {
  input: (s: ReadableStream) => {
    transform: (o: object) => { output: (o: object) => Promise<{ response: () => Response }> }
  }
}
type R2Like = {
  get: (k: string) => Promise<{ body: ReadableStream } | null>
  put: (k: string, v: ArrayBuffer, o: object) => Promise<unknown>
}

/**
 * After an upload, write the resized WebP copies next to the original in R2
 * using the Cloudflare Images binding (Workers have no sharp).
 */
export const generateSizes: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req, context }) => {
  if (context.skipSizes) return doc
  const d = doc as MediaDoc
  if (d.sizesReady && operation !== 'create' && previousDoc?.filename === d.filename) return doc
  const changedFile = operation === 'create' || previousDoc?.filename !== d.filename || previousDoc?.prefix !== d.prefix
  if (!changedFile || !d.filename || !RESIZABLE.test(mimeOf(d))) return doc
  try {
    const { env } = await getCloudflareContext({ async: true })
    const images = (env as unknown as { IMAGES?: ImagesBinding }).IMAGES
    const r2 = (env as unknown as { R2: R2Like }).R2
    if (!images) return doc
    const key = storageKey(d)
    const original = await r2.get(key)
    if (!original) return doc
    // Read the original once, then resize to every width in parallel.
    const bytes = new Uint8Array(await new Response(original.body).arrayBuffer())
    await Promise.all(
      Object.values(IMAGE_SIZES).map(async (width) => {
        const out = await images
          .input(new Blob([bytes]).stream())
          .transform({ width, fit: 'scale-down' })
          .output({ format: 'image/webp', quality: 80 })
        const body = await out.response().arrayBuffer()
        await r2.put(sizeKey(key, width), body, {
          httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
        })
      }),
    )
    await req.payload.update({
      collection: 'media',
      id: doc.id,
      data: { sizesReady: true },
      context: { skipSizes: true },
      req,
    })
  } catch (err) {
    req.payload.logger.warn(`image sizes for media ${doc.id}: ${(err as Error).message}`)
  }
  return doc
}
