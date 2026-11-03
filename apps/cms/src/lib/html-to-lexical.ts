import { convertHTMLToLexical, type SanitizedServerEditorConfig } from '@payloadcms/richtext-lexical'
import type { MediaLite } from './lexical-html'

/**
 * A DOM implementation with JSDOM's constructor shape: jsdom in the import
 * scripts (Node), linkedom in the CMS itself (Workers have no jsdom).
 */
export type DomClass = new (html: string) => { window: { document: Document } }

/**
 * Post HTML (WordPress, or anything sent to POST /api/posts/drafts) → Lexical editor state.
 *
 * Payload's HTML importer covers text, headings, lists, links and quotes.
 * Everything it can't map (images from the media library, galleries,
 * YouTube/social embeds, tables, code) is swapped for a placeholder
 * paragraph first, then replaced with the matching Lexical node:
 *   image   → upload node (media relation + caption)
 *   gallery → `gallery` block
 *   embed   → `embed` block (URL, or the provider's embed code)
 *   other   → `html` block with the original markup
 */

export type MediaIndex = {
  byId: Map<number, MediaLite>
  /** "wp-content/uploads/2026/11/file.jpg" → media id (prefix/filename). */
  byPath: Map<string, number>
}

type Special =
  | { kind: 'image'; id: number; caption: string }
  | { kind: 'gallery'; ids: number[]; caption: string }
  | { kind: 'embed'; url: string; html: string; caption: string }
  | { kind: 'html'; html: string }

const objectId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('')
const MARK = (n: number) => `@@WPSPECIAL${n}@@`
const MARK_RE = /^@@WPSPECIAL(\d+)@@$/

const UPLOADS_RE = /\/wp-content\/uploads\/(.+)$/

/** Find a library item from an <img>: wp-image-{id} class, data-id, or its file path. */
export function resolveMediaId(img: Element, media: MediaIndex): number | null {
  const cls = img.getAttribute('class') ?? ''
  const m = cls.match(/wp-image-(\d+)/)
  if (m && media.byId.has(+m[1])) return +m[1]
  const dataId = Number(img.getAttribute('data-id') || img.getAttribute('data-attachment-id'))
  if (dataId && media.byId.has(dataId)) return dataId
  const src = img.getAttribute('data-orig-file') || img.getAttribute('src') || ''
  return resolveMediaUrl(src, media)
}

export function resolveMediaUrl(src: string, media: MediaIndex): number | null {
  let path: string
  try {
    path = decodeURIComponent(new URL(src, 'https://www.theinsightnews.co').pathname)
  } catch {
    return null
  }
  const rel = path.match(UPLOADS_RE)?.[1]
  if (!rel) return null
  const candidates = [
    rel,
    rel.replace(/-\d+x\d+(\.\w+)$/, '$1'), // resized copy → original
    rel.replace(/(-\d+x\d+)?(\.\w+)$/, '-scaled$2'), // WP ≥5.3 keeps big originals as -scaled
    rel.replace(/-scaled(\.\w+)$/, '$1'),
  ]
  for (const c of candidates) {
    const id = media.byPath.get(`wp-content/uploads/${c}`)
    if (id) return id
  }
  return null
}

function embedUrlFrom(el: Element): string {
  const iframe = el.querySelector('iframe') ?? (el.tagName === 'IFRAME' ? el : null)
  const wrapperText = el.querySelector('.wp-block-embed__wrapper')?.textContent?.trim() ?? ''
  if (/^https?:\/\/\S+$/.test(wrapperText)) return wrapperText
  const src = iframe?.getAttribute('src') ?? ''
  const yt = src.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/)
  if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`
  return src || el.querySelector('a[href]')?.getAttribute('href') || ''
}

const isYouTube = (url: string) => /youtube\.com|youtu\.be/.test(url)

export function htmlToLexical(
  html: string,
  { editorConfig, media, DOM }: { editorConfig: SanitizedServerEditorConfig; media: MediaIndex; DOM: DomClass },
) {
  const warnings: string[] = []
  const specials: Special[] = []
  const dom = new DOM(`<!doctype html><html><body>${html}</body></html>`)
  const doc = dom.window.document
  const body = doc.body

  const placeholder = (s: Special) => {
    specials.push(s)
    const p = doc.createElement('p')
    p.textContent = MARK(specials.length - 1)
    return p
  }

  // 1. Junk: share buttons, related-post widgets, scripts and styles.
  body
    .querySelectorAll(
      'style, noscript, .sharedaddy, .jp-relatedposts, .addtoany_share_save_container, [class*="heateor"], .wpcnt, .wp-block-buttons',
    )
    .forEach((el) => el.remove())

  // Links: trim stray spaces in href; drop links the editor would reject.
  body.querySelectorAll('a').forEach((a) => {
    const href = (a.getAttribute('href') ?? '').trim().replace(/\s/g, '%20')
    if (!href || href.startsWith('javascript:')) return a.replaceWith(...a.childNodes)
    if (/^www\./i.test(href)) a.setAttribute('href', `https://${href}`)
    else if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) return a.replaceWith(...a.childNodes)
    else a.setAttribute('href', href)
  })

  // 2. Galleries.
  body.querySelectorAll('figure.wp-block-gallery, .tiled-gallery, div.gallery').forEach((g) => {
    const ids = [...g.querySelectorAll('img')].map((img) => resolveMediaId(img, media)).filter((id): id is number => Boolean(id))
    const caption = g.querySelector(':scope > figcaption, .blocks-gallery-caption')?.textContent?.trim() ?? ''
    if (ids.length) g.replaceWith(placeholder({ kind: 'gallery', ids, caption }))
    else g.replaceWith(placeholder({ kind: 'html', html: g.outerHTML }))
  })

  // 3. Embeds: YouTube and other oEmbeds, raw iframes, social widgets.
  body.querySelectorAll('figure.wp-block-embed, .jetpack-video-wrapper, .embed-youtube').forEach((e) => {
    if (!e.isConnected) return
    const url = embedUrlFrom(e)
    const caption = e.querySelector('figcaption')?.textContent?.trim() ?? ''
    const iframe = e.querySelector('iframe')
    const keepHtml = !isYouTube(url) && (iframe || e.querySelector('blockquote, script'))
    e.replaceWith(placeholder({ kind: 'embed', url, html: keepHtml ? e.innerHTML : '', caption }))
  })
  body
    .querySelectorAll('iframe, blockquote.twitter-tweet, blockquote.instagram-media, blockquote.tiktok-embed, .fb-post, .fb-video')
    .forEach((e) => {
      if (!e.isConnected) return
      const url = e.tagName === 'IFRAME' ? embedUrlFrom(e) : (e.querySelector('a[href]')?.getAttribute('href') ?? '')
      e.replaceWith(placeholder({ kind: 'embed', url, html: isYouTube(url) ? '' : e.outerHTML, caption: '' }))
    })
  body.querySelectorAll('script').forEach((s) => s.remove())

  // 4. Markup the editor has no node for → raw HTML blocks.
  body.querySelectorAll('figure.wp-block-table, table, pre, .wp-block-code, video, audio, object, form').forEach((e) => {
    if (!e.isConnected) return
    e.replaceWith(placeholder({ kind: 'html', html: e.outerHTML }))
  })

  // 5. Unwrap layout containers so content sits at the top level.
  let wrappers = body.querySelectorAll('div, section, article, main, center, font')
  while (wrappers.length) {
    wrappers.forEach((w) => w.replaceWith(...w.childNodes))
    wrappers = body.querySelectorAll('div, section, article, main, center, font')
  }

  // 6. Images.
  body.querySelectorAll('img').forEach((img) => {
    if (!img.isConnected) return
    const figure = img.closest('figure')
    const container: Element = figure ?? (img.parentElement?.tagName === 'A' && img.parentElement.textContent?.trim() === '' ? img.parentElement : img)
    const caption = figure?.querySelector('figcaption')?.textContent?.trim() ?? ''
    const id = resolveMediaId(img, media)
    const node = id
      ? placeholder({ kind: 'image', id, caption })
      : placeholder({ kind: 'html', html: figure ? figure.outerHTML : `<figure>${img.outerHTML}</figure>` })
    if (!id) warnings.push(`image not in media library: ${img.getAttribute('src')}`)

    const para = container.parentElement?.closest('p, li, h1, h2, h3, h4, h5, h6, blockquote')
    if (para && para !== container) {
      container.remove()
      const rest = para.textContent?.replace(/ /g, ' ').trim()
      if (!rest && !para.querySelector('img')) para.replaceWith(node)
      else para.after(node)
    } else {
      container.replaceWith(node)
    }
  })

  // 7. Tidy: one H1 per page (the headline), alignment classes → style, empty paragraphs.
  body.querySelectorAll('h1').forEach((h) => {
    const h2 = doc.createElement('h2')
    h2.innerHTML = h.innerHTML
    h.replaceWith(h2)
  })
  body.querySelectorAll('[class*="has-text-align-"]').forEach((el) => {
    const align = (el.getAttribute('class') ?? '').match(/has-text-align-(left|center|right|justify)/)?.[1]
    if (align) el.setAttribute('style', `text-align: ${align};`)
  })
  body.querySelectorAll('p').forEach((p) => {
    if (!p.textContent?.replace(/ /g, ' ').trim() && !p.querySelector('img')) p.remove()
  })

  // 8. Placeholders must be top-level paragraphs.
  body.querySelectorAll('p').forEach((p) => {
    if (!MARK_RE.test(p.textContent?.trim() ?? '')) return
    let top: Element = p
    while (top.parentElement && top.parentElement !== body) top = top.parentElement
    if (top !== p) top.after(p)
  })

  const state = convertHTMLToLexical({ editorConfig, html: body.innerHTML, JSDOM: DOM as never })

  // 9. Swap placeholders for real nodes.
  type N = { type: string; children?: N[]; text?: string; [k: string]: unknown }
  const textOf = (n: N): string => (n.text ?? '') + (n.children ?? []).map(textOf).join('')
  const mediaIds = new Set<number>()
  const replaced: N[] = []
  for (const node of state.root.children as unknown as N[]) {
    const m = node.type === 'paragraph' ? textOf(node).trim().match(MARK_RE) : null
    if (!m) {
      replaced.push(node)
      continue
    }
    const s = specials[+m[1]]
    if (s.kind === 'image') {
      mediaIds.add(s.id)
      replaced.push({
        type: 'upload',
        version: 3,
        format: '',
        id: objectId(),
        fields: s.caption ? { caption: s.caption } : {},
        relationTo: 'media',
        value: s.id,
      })
    } else {
      if (s.kind === 'gallery') s.ids.forEach((id) => mediaIds.add(id))
      const fields =
        s.kind === 'gallery'
          ? { blockType: 'gallery', images: s.ids, caption: s.caption || undefined }
          : s.kind === 'embed'
            ? { blockType: 'embed', url: s.url || undefined, html: s.html || undefined, caption: s.caption || undefined }
            : { blockType: 'html', html: s.html }
      replaced.push({ type: 'block', version: 2, format: '', fields: { id: objectId(), blockName: '', ...fields } })
    }
  }
  const leftovers = JSON.stringify(replaced).match(/@@WPSPECIAL\d+@@/g)
  if (leftovers) warnings.push(`${leftovers.length} nested placeholder(s) left as text`)
  ;(state.root as unknown as { children: N[] }).children = replaced

  return { state, mediaIds: [...mediaIds], warnings }
}
