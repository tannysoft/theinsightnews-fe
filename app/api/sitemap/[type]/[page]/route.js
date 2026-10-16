import { buildUrlset, buildNewsUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";
import { getSitemapEntries, getNewsSitemapEntries, isSitemapType } from "@/lib/sitemap-sources";

/**
 * Paginated sub-sitemaps.
 *
 * Crawlers never see this path: next.config.mjs rewrites
 * `/<type>-sitemap<N>.xml` here, so the public URLs stay Rank Math-shaped
 * (`/post-sitemap2.xml`, `/post_tag-sitemap12.xml`, …). A root-level dynamic
 * route can't be used for those because `app/[slug]` already owns that
 * segment for articles.
 */
export const revalidate = 1800; // 30 min

export async function GET(_request, { params }) {
  const { type, page } = await params;

  // `/news-sitemap.xml` arrives through the same rewrite. Unlike the others
  // it's served even when empty: a quiet two days is normal, not an error.
  if (type === "news" && page === "1") {
    const entries = await getNewsSitemapEntries();
    return new Response(buildNewsUrlset(entries), { headers: XML_RESPONSE_HEADERS });
  }

  if (!isSitemapType(type)) {
    return new Response("Not found", { status: 404 });
  }

  const n = Number(page);
  if (!Number.isInteger(n) || n < 1) {
    return new Response("Not found", { status: 404 });
  }

  const entries = await getSitemapEntries(type, n);
  // Past the last page there's nothing to serve — 404 rather than hand back
  // an empty <urlset>, which Search Console reports as an error.
  if (!entries.length) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
