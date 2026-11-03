import fs from 'node:fs'
const posts = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const norm = (src) => {
  let u = src.replace(/^https?:\/\/i\d\.wp\.com\//, 'http://')
  u = u.split('?')[0]
  return u.replace(/^https?:\/\/(www\.)?/, '')
}
const cdx = async (path) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(path)}&output=json&filter=statuscode:200&fl=timestamp,original,mimetype,length`)
      if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 3000 * (i + 1))); continue }
      const j = await r.json().catch(() => [])
      return j.slice(1).filter((x) => x[2].startsWith('image/'))
    } catch { await new Promise((s) => setTimeout(s, 3000)) }
  }
  return []
}
const out = []
for (const p of posts) {
  for (const m of p.content_html.matchAll(/<img[^>]*?src="([^"]*songsue[^"]*)"[^>]*>/g)) {
    const path = norm(m[1])
    const full = path.replace(/-\d+x\d+(\.\w+)$/, '$1')
    const tries = [...new Set([full, path])]
    let best = null
    for (const t of tries) {
      const hits = await cdx(t)
      if (hits.length) { const h = hits.sort((a, b) => Number(b[3]) - Number(a[3]))[0]; best = { path: t, ts: h[0], original: h[1], mime: h[2], bytes: Number(h[3]) }; break }
    }
    out.push({ post: p.id, src: m[1], found: best })
    process.stdout.write(best ? '+' : '.')
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1))
console.log('\nfound', out.filter((x) => x.found).length, 'of', out.length, '| full-size', out.filter((x) => x.found && x.found.path !== norm(x.src)).length)
