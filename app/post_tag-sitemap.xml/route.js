import { SITE } from "@/lib/site";
import { getPopularTags } from "@/lib/api";
import { buildUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";

export const revalidate = 1800; // 30 min

export async function GET() {
  let tags = [];
  try {
    tags = await getPopularTags({ perPage: 100 });
  } catch {
    tags = [];
  }

  const now = new Date();
  const entries = tags
    .filter((t) => (t.count || 0) > 0)
    .map((t) => ({
      loc: `${SITE.url}/tag/${t.slug}`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.5,
    }));

  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
