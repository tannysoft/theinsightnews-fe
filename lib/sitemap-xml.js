// XML builders for Rank Math-style sitemaps.
//
// Rank Math's output differs from Yoast's in a few deliberate ways, which we
// mirror here:
//   - `/sitemap_index.xml` is the canonical index (`/sitemap.xml` 301s to it).
//   - Sub-sitemaps are `<type>-sitemap.xml`, then `<type>-sitemap2.xml`,
//     `<type>-sitemap3.xml`… once a type exceeds SITEMAP_LINKS_PER_PAGE.
//   - No <changefreq> / <priority>: Google ignores both, so Rank Math omits
//     them rather than shipping noise.
//   - Featured images are exposed via the sitemap-image namespace.
//   - Everything is rendered in the browser through an XSL stylesheet.
import { SITE } from "@/lib/site";
import { parseWpDate } from "@/lib/api";

export const SITEMAP_CACHE_SECONDS = 1800; // 30 minutes
export const SITEMAP_LINKS_PER_PAGE = 200; // Rank Math's default page size

/** Stylesheet that turns the raw XML into the familiar Rank Math table. */
export const SITEMAP_XSL_PATH = "/main-sitemap.xsl";

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * W3C datetime, the flavour Rank Math emits: `2026-08-03T10:20:30+00:00`
 * rather than the `Z` suffix. Returns null for unusable input so callers can
 * simply omit <lastmod> instead of lying with `now`.
 */
export function w3cDate(d) {
  const v = parseWpDate(d);
  return v ? v.toISOString().replace(/\.\d{3}Z$/, "+00:00") : null;
}

/** `/post-sitemap.xml`, `/post-sitemap2.xml`, `/post-sitemap3.xml`, … */
export function sitemapPath(type, page = 1) {
  return `/${type}-sitemap${page > 1 ? page : ""}.xml`;
}

export function sitemapUrl(type, page = 1) {
  return `${SITE.url}${sitemapPath(type, page)}`;
}

function xmlHeader() {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?xml-stylesheet type="text/xsl" href="${SITE.url}${SITEMAP_XSL_PATH}"?>\n`
  );
}

function imageBlock(image) {
  const loc = typeof image === "string" ? image : image?.loc;
  if (!loc) return "";
  const title = typeof image === "string" ? "" : image.title;
  const parts = [`      <image:loc>${xmlEscape(loc)}</image:loc>`];
  if (title) parts.push(`      <image:title>${xmlEscape(title)}</image:title>`);
  return `    <image:image>\n${parts.join("\n")}\n    </image:image>`;
}

/**
 * @param {{ loc: string, lastmod?: string|Date,
 *           images?: (string|{loc: string, title?: string})[] }[]} entries
 */
export function buildUrlset(entries) {
  const body = entries
    .map((e) => {
      const parts = [`    <loc>${xmlEscape(e.loc)}</loc>`];
      const lastmod = w3cDate(e.lastmod);
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      for (const img of e.images || []) {
        const block = imageBlock(img);
        if (block) parts.push(block);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `${xmlHeader()}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>`;
}

/** @param {{ loc: string, lastmod?: string|Date }[]} sitemaps */
export function buildIndex(sitemaps) {
  const body = sitemaps
    .map((s) => {
      const parts = [`    <loc>${xmlEscape(s.loc)}</loc>`];
      const lastmod = w3cDate(s.lastmod);
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");

  return `${xmlHeader()}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

export const XML_RESPONSE_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "X-Robots-Tag": "noindex, follow",
  "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=86400`,
};
