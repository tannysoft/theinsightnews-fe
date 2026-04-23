// Shared helpers for Yoast-style XML sitemaps.
export const SITEMAP_CACHE_SECONDS = 1800; // 30 minutes

const XSL_HREF = ""; // Yoast ships an XSL stylesheet; we skip it for simplicity.

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(d) {
  if (!d) return new Date().toISOString();
  const v = d instanceof Date ? d : new Date(d);
  return Number.isNaN(v.getTime()) ? new Date().toISOString() : v.toISOString();
}

/** @param {{ loc: string, lastmod?: string|Date, changefreq?: string, priority?: number }[]} entries */
export function buildUrlset(entries) {
  const body = entries
    .map((e) => {
      const parts = [`    <loc>${xmlEscape(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${isoDate(e.lastmod)}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (typeof e.priority === "number")
        parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>${
    XSL_HREF ? `\n<?xml-stylesheet type="text/xsl" href="${XSL_HREF}"?>` : ""
  }
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

/** @param {{ loc: string, lastmod?: string|Date }[]} sitemaps */
export function buildIndex(sitemaps) {
  const body = sitemaps
    .map((s) => {
      const parts = [`    <loc>${xmlEscape(s.loc)}</loc>`];
      if (s.lastmod) parts.push(`    <lastmod>${isoDate(s.lastmod)}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

export const XML_RESPONSE_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=86400`,
};
