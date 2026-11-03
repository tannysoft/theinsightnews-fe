import fs from 'node:fs'
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const norm = (src) => src.replace(/^https?:\/\/i\d\.wp\.com\//, 'http://').split('?')[0].replace(/^https?:\/\/(www\.)?/, '')
const dirs = {}
for (const r of rows.filter((r) => !r.found)) { const p = norm(r.src); const d = p.slice(0, p.lastIndexOf('/') + 1); (dirs[d] ??= []).push(r) }
const sleep = (ms) => new Promise((s) => setTimeout(s, ms))
async function list(prefix) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(prefix)}&matchType=prefix&output=json&filter=statuscode:200&fl=timestamp,original,mimetype,length&collapse=urlkey&limit=20000`)
      if (r.status === 429 || r.status >= 500) { await sleep(4000 * (i + 1)); continue }
      return ((await r.json().catch(() => [])) || []).slice(1)
    } catch { await sleep(4000) }
  }
  return []
}
const stem = (f) => decodeURIComponent(f).toLowerCase().replace(/\.\w+$/, '').replace(/-\d+x\d+$/, '').replace(/-scaled$/, '')
for (const [d, rs] of Object.entries(dirs)) {
  const all = [...(await list(d)), ...(await list('songsue.co/' + d.split('/').slice(1).join('/')))]
  for (const r of rs) {
    const want = stem(norm(r.src).split('/').pop())
    const hits = all.filter((h) => h[2]?.startsWith('image/') && stem(h[1].split('?')[0].split('/').pop()) === want)
    if (hits.length) {
      const h = hits.sort((a, b) => Number(b[3]) - Number(a[3]))[0]
      r.found = { path: h[1].replace(/^https?:\/\/(www\.)?/, ''), ts: h[0], original: h[1], mime: h[2], bytes: Number(h[3]), via: 'other-size' }
    }
  }
  process.stdout.write(`${d} ${all.length} archived; `)
}
fs.writeFileSync(process.argv[2], JSON.stringify(rows, null, 1))
console.log('\nfound now', rows.filter((r) => r.found).length, 'of', rows.length)
