import { buildUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";
import { getSitemapEntries } from "@/lib/sitemap-sources";

// Page 1 of the post sitemap. Pages 2+ are served by app/api/sitemap via the
// `/post-sitemap<N>.xml` rewrite in next.config.mjs.
export const revalidate = 1800; // 30 min

export async function GET() {
  const entries = await getSitemapEntries("post", 1);
  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
