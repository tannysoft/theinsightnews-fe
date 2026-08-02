import { buildUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";
import { getSitemapEntries } from "@/lib/sitemap-sources";

// Static frontend pages (home + section landings + about/membership/privacy).
// The list lives in lib/sitemap-sources.js.
export const revalidate = 1800; // 30 min

export async function GET() {
  const entries = await getSitemapEntries("page", 1);
  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
