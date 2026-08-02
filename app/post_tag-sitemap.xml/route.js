import { buildUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";
import { getSitemapEntries } from "@/lib/sitemap-sources";

// Page 1 of the tag sitemap; pages 2+ come through the `/post_tag-sitemap<N>.xml`
// rewrite. Empty tags are filtered out server-side via `hide_empty`.
export const revalidate = 1800; // 30 min

export async function GET() {
  const entries = await getSitemapEntries("post_tag", 1);
  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
