import { buildUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";
import { getSitemapEntries } from "@/lib/sitemap-sources";

export const revalidate = 1800; // 30 min

export async function GET() {
  const entries = await getSitemapEntries("category", 1);
  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
