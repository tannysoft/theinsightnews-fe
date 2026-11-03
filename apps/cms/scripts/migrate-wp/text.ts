const NAMED: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', bull: '•',
  copy: '©', reg: '®', trade: '™',
}

export function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (m, n) => (Number.isFinite(+n) ? String.fromCodePoint(+n) : m))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => (Number.isFinite(parseInt(n, 16)) ? String.fromCodePoint(parseInt(n, 16)) : m))
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (m, name) => NAMED[name] ?? m)
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Plain-text excerpt without leaked share-button labels or the trailing "[…]". */
export function cleanExcerpt(html: string): string {
  return stripHtml(html)
    .replace(/^(?:\s*(?:Facebook|X|Twitter|LINE|Line)\s*)+/, '')
    .replace(/\s*\[\s*…\s*\]\s*$/, '')
    .replace(/\s*…\s*$/, '')
    .trim()
}

export const decodeSlug = (slug: string) => {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

/** WordPress dates without zone (date_gmt) → ISO UTC. */
export const gmt = (d?: string | null) => (d ? new Date(d.endsWith('Z') ? d : `${d}Z`).toISOString() : undefined)

/** True when a display name is a login handle rather than a real name. */
export const looksLikeRealName = (name: string) => /[฀-๿]/.test(name) || name.trim().includes(' ')

/** Undo wptexturize on a title: curly quotes, primes and spaced en/em dashes back to what was typed. */
export const untexturize = (s: string) =>
  s
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/ [–—] /g, ' - ')
    .replace(/…/g, '...')
