import { buildIndex, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";
import { getSitemapIndexEntries } from "@/lib/sitemap-sources";

// The canonical sitemap entry point, Rank Math style: `/sitemap.xml` 301s
// here and robots.txt advertises this URL. Sub-sitemaps are enumerated from
// live content counts, so new pages appear without touching this file.
export const revalidate = 1800; // 30 min

export async function GET() {
  const entries = await getSitemapIndexEntries();
  return new Response(buildIndex(entries), { headers: XML_RESPONSE_HEADERS });
}
