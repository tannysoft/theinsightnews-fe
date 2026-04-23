import { SITE } from "@/lib/site";
import { getCategories } from "@/lib/api";
import { buildUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";

export const revalidate = 1800; // 30 min

export async function GET() {
  let categories = [];
  try {
    categories = await getCategories();
  } catch {
    categories = [];
  }

  const now = new Date();
  const entries = categories.map((c) => ({
    loc: `${SITE.url}/category/${c.slug}`,
    lastmod: now,
    changefreq: "daily",
    priority: 0.7,
  }));

  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
