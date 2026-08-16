// XML builders that mirror Rank Math's sitemap output.
//
// Shape verified against a live Rank Math install (rankmath.com), not from
// memory — the details below are things it actually does and Yoast doesn't:
//   - `/sitemap_index.xml` is the index; `/sitemap.xml` 301s to it.
//   - A type with one page is `<type>-sitemap.xml`; a type that needs more
//     than one is numbered from 1: `post-sitemap1.xml`, `post-sitemap2.xml`.
//   - No <changefreq> / <priority> anywhere. Google ignores both.
//   - Every image a post references, as bare <image:loc> — no <image:title>,
//     which Google stopped reading in 2022.
//   - The XML declaration and the stylesheet PI share the first line, and the
//     stylesheet href is protocol-relative.
//   - urlset carries the xhtml/xsi/image namespaces plus xsi:schemaLocation.
//   - Tab-indented, served as text/xml with X-Robots-Tag: noindex.
import { SITE } from "@/lib/site";
import { parseWpDate } from "@/lib/api";

export const SITEMAP_CACHE_SECONDS = 1800; // 30 minutes
export const SITEMAP_LINKS_PER_PAGE = 200; // Rank Math's default page size

/** Stylesheet that renders a sitemap as a table in the browser. */
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
 * W3C datetime the way Rank Math emits it: `2026-08-03T05:14:42+00:00`,
 * not the `Z` suffix. Returns null for unusable input so callers can omit
 * <lastmod> instead of inventing one.
 */
export function w3cDate(d) {
  const v = parseWpDate(d);
  return v ? v.toISOString().replace(/\.\d{3}Z$/, "+00:00") : null;
}

/**
 * `/page-sitemap.xml` for a single-page type, `/post-sitemap1.xml`,
 * `/post-sitemap2.xml` … once a type spans more than one.
 */
export function sitemapPath(type, page = 1, totalPages = 1) {
  return `/${type}-sitemap${totalPages > 1 ? page : ""}.xml`;
}

export function sitemapUrl(type, page = 1, totalPages = 1) {
  return `${SITE.url}${sitemapPath(type, page, totalPages)}`;
}

/** Protocol-relative, as Rank Math writes it. */
function stylesheetHref() {
  return `${SITE.url.replace(/^https?:/, "")}${SITEMAP_XSL_PATH}`;
}

function xmlHeader() {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<?xml-stylesheet type="text/xsl" href="${stylesheetHref()}"?>\n`
  );
}

const URLSET_ATTRS = [
  'xmlns:xhtml="http://www.w3.org/1999/xhtml"',
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
  'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9' +
    " http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd" +
    " http://www.google.com/schemas/sitemap-image/1.1" +
    ' http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd"',
  'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
].join(" ");

/** @param {{ loc: string, lastmod?: string|Date, images?: string[] }[]} entries */
export function buildUrlset(entries) {
  const body = entries
    .map((e) => {
      const parts = [`\t\t<loc>${xmlEscape(e.loc)}</loc>`];
      const lastmod = w3cDate(e.lastmod);
      if (lastmod) parts.push(`\t\t<lastmod>${lastmod}</lastmod>`);
      for (const img of e.images || []) {
        if (!img) continue;
        parts.push(
          `\t\t<image:image>\n\t\t\t<image:loc>${xmlEscape(img)}</image:loc>\n\t\t</image:image>`
        );
      }
      return `\t<url>\n${parts.join("\n")}\n\t</url>`;
    })
    .join("\n");

  return `${xmlHeader()}<urlset ${URLSET_ATTRS}>
${body}
</urlset>`;
}

/** @param {{ loc: string, lastmod?: string|Date }[]} sitemaps */
export function buildIndex(sitemaps) {
  const body = sitemaps
    .map((s) => {
      const parts = [`\t\t<loc>${xmlEscape(s.loc)}</loc>`];
      const lastmod = w3cDate(s.lastmod);
      if (lastmod) parts.push(`\t\t<lastmod>${lastmod}</lastmod>`);
      return `\t<sitemap>\n${parts.join("\n")}\n\t</sitemap>`;
    })
    .join("\n");

  return `${xmlHeader()}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

export const XML_RESPONSE_HEADERS = {
  "Content-Type": "text/xml; charset=UTF-8",
  "X-Robots-Tag": "noindex",
  "Cache-Control": `public, max-age=0, s-maxage=${SITEMAP_CACHE_SECONDS}, stale-while-revalidate=86400`,
};
