/**
 * Minimal WordPress REST client for the import: retries, paging, and
 * optional Application Password auth (needed for drafts, private posts and
 * user emails — the public API only returns published content).
 */
export type WPRendered = { rendered: string; raw?: string }

export type WPUser = { id: number; name: string; slug: string; description?: string; email?: string; roles?: string[] }
export type YoastHead = {
  title?: string
  description?: string
  canonical?: string
  robots?: { index?: string; follow?: string }
  og_image?: { url: string }[]
}
export type WPTerm = { id: number; name: string; slug: string; description: string; parent?: number; count: number; link?: string; yoast_head_json?: YoastHead }
export type WPMedia = {
  id: number
  date_gmt: string
  modified_gmt: string
  title: WPRendered
  caption: WPRendered
  alt_text: string
  mime_type: string
  source_url: string
  media_details?: { width?: number; height?: number; file?: string; filesize?: number; sizes?: Record<string, { file?: string }>; original_image?: string }
  author: number
}
export type WPPost = {
  id: number
  date_gmt: string
  modified_gmt: string
  slug: string
  status: string
  link: string
  title: WPRendered
  content: WPRendered
  excerpt: WPRendered
  author: number
  featured_media: number
  categories?: number[]
  tags?: number[]
  sticky?: boolean
  format?: string
  yoast_head_json?: YoastHead
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class WordPress {
  readonly api: string
  private headers: Record<string, string> = { 'user-agent': 'theinsightnews-migrate/1.0' }

  constructor(
    readonly base: string,
    auth?: { user: string; password: string },
  ) {
    this.base = base.replace(/\/$/, '')
    this.api = `${this.base}/wp-json/wp/v2`
    if (auth?.user && auth.password)
      this.headers.authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString('base64')}`
  }

  get authenticated() {
    return Boolean(this.headers.authorization)
  }

  async fetch(url: string, tries = 6): Promise<Response> {
    let lastErr: unknown
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url, { headers: this.headers })
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) return res
        lastErr = new Error(`${res.status} ${url}`)
      } catch (err) {
        lastErr = err
      }
      await sleep(Math.min(30_000, 1000 * 2 ** i))
    }
    throw lastErr
  }

  async json<T>(path: string, params: Record<string, string | number | undefined> = {}) {
    const url = new URL(path.startsWith('http') ? path : `${this.api}${path}`)
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    const res = await this.fetch(url.toString())
    if (!res.ok) throw new Error(`WordPress ${res.status}: ${url}`)
    return {
      data: (await res.json()) as T,
      total: Number(res.headers.get('x-wp-total') ?? 0),
      totalPages: Number(res.headers.get('x-wp-totalpages') ?? 1),
    }
  }

  /** Every item of a collection, page by page (oldest id first, so a re-run resumes cleanly). */
  async *pages<T>(path: string, params: Record<string, string | number | undefined> = {}, startPage = 1) {
    let page = startPage
    for (;;) {
      const { data, total, totalPages } = await this.json<T[]>(path, {
        per_page: 100,
        orderby: 'id',
        order: 'asc',
        ...params,
        page,
      })
      yield { items: data, page, totalPages, total }
      if (page >= totalPages || data.length === 0) return
      page++
    }
  }
}
