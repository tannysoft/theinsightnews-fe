import type { SerializedEditorState, SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'
import {
  convertLexicalToHTML,
  defaultHTMLConverters,
  type HTMLConverters,
} from '@payloadcms/richtext-lexical/html'

export type MediaLite = {
  id: number
  filename?: string | null
  prefix?: string | null
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const idOf = (v: unknown): number | null =>
  typeof v === 'number' ? v : v && typeof v === 'object' && 'id' in v ? Number((v as { id: unknown }).id) : null

/** Every media id an editor state refers to (images and gallery blocks). */
export function collectMediaIds(state: SerializedEditorState | null | undefined): number[] {
  const ids = new Set<number>()
  const walk = (node: SerializedLexicalNode & { children?: SerializedLexicalNode[]; [k: string]: unknown }) => {
    if (node.type === 'upload') {
      const id = idOf(node.value)
      if (id) ids.add(id)
    }
    if (node.type === 'block') {
      const fields = node.fields as { blockType?: string; images?: unknown[] }
      if (fields?.blockType === 'gallery') fields.images?.forEach((v) => idOf(v) && ids.add(idOf(v)!))
    }
    node.children?.forEach((c) => walk(c as never))
  }
  if (state?.root) walk(state.root as never)
  return [...ids]
}

/**
 * Images are stored as `media:{prefix}/{filename}` and resolved by the
 * website to the media domain at render time, so the stored HTML doesn't
 * depend on where files are served from (local CMS, R2 domain…).
 */
export const MEDIA_SCHEME = 'media:'
const srcOf = (m: MediaLite) =>
  m.filename ? `${MEDIA_SCHEME}${[m.prefix, m.filename].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/')}` : (m.url ?? '')

function imgTag(m: MediaLite, alt?: string | null) {
  const w = m.width ? ` width="${m.width}"` : ''
  const h = m.height ? ` height="${m.height}"` : ''
  return `<img src="${esc(srcOf(m))}" alt="${esc(alt ?? m.alt ?? '')}"${w}${h} class="wp-image-${m.id}" />`
}

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  return m?.[1] ?? null
}

/** HTML for an embed block: provider code if given, YouTube iframe, or a plain link. */
export function embedHTML({ url, html, caption }: { url?: string | null; html?: string | null; caption?: string | null }) {
  let inner = ''
  const yt = url ? youTubeId(url) : null
  if (html?.trim()) inner = html
  else if (yt)
    inner = `<iframe src="https://www.youtube.com/embed/${yt}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
  else if (url) inner = `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`
  if (!inner) return ''
  const cap = caption ? `<figcaption>${esc(caption)}</figcaption>` : ''
  return `<figure class="wp-block-embed${yt ? ' is-provider-youtube' : ''}"><div class="wp-block-embed__wrapper">${inner}</div>${cap}</figure>`
}

/**
 * Render an article body to HTML for the website. Media can be passed
 * populated or by id with a lookup map.
 */
export function lexicalToHTML(state: SerializedEditorState, media: Map<number, MediaLite>): string {
  const lookup = (v: unknown): MediaLite | null => {
    if (v && typeof v === 'object' && 'filename' in v) return v as MediaLite
    const id = idOf(v)
    return id ? (media.get(id) ?? null) : null
  }

  const converters: HTMLConverters = {
    ...defaultHTMLConverters,
    upload: ({ node }) => {
      const n = node as unknown as { value: unknown; fields?: { caption?: string } }
      const m = lookup(n.value)
      if (!m) return ''
      const cap = n.fields?.caption ? `<figcaption>${esc(n.fields.caption)}</figcaption>` : ''
      return `<figure class="wp-block-image">${imgTag(m)}${cap}</figure>`
    },
    blocks: {
      embed: ({ node }) => embedHTML(node.fields as never),
      html: ({ node }) => String((node.fields as { html?: string }).html ?? ''),
      gallery: ({ node }) => {
        const f = node.fields as { images?: unknown[]; caption?: string }
        const imgs = (f.images ?? [])
          .map(lookup)
          .filter((m): m is MediaLite => Boolean(m))
          .map((m) => `<figure class="wp-block-image">${imgTag(m)}</figure>`)
          .join('')
        const cap = f.caption ? `<figcaption>${esc(f.caption)}</figcaption>` : ''
        return imgs ? `<figure class="wp-block-gallery">${imgs}${cap}</figure>` : ''
      },
    },
  }

  return convertLexicalToHTML({ data: state, converters, disableContainer: true, disableIndent: true })
}
