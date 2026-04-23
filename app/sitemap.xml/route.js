import { SITE } from "@/lib/site";
import { buildIndex, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";

export const revalidate = 1800; // 30 min

export async function GET() {
  const now = new Date();
  const sitemaps = [
    { loc: `${SITE.url}/post-sitemap.xml`, lastmod: now },
    { loc: `${SITE.url}/category-sitemap.xml`, lastmod: now },
    { loc: `${SITE.url}/post_tag-sitemap.xml`, lastmod: now },
    { loc: `${SITE.url}/page-sitemap.xml`, lastmod: now },
  ];
  return new Response(buildIndex(sitemaps), { headers: XML_RESPONSE_HEADERS });
}
