import { SITE } from "@/lib/site";
import { getPosts } from "@/lib/api";
import { buildUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";

export const revalidate = 1800; // 30 min

export async function GET() {
  // Fetch the most recent ~200 posts across two pages.
  // (Yoast splits into post-sitemap1.xml when > 1000; for our size this is fine.)
  let posts = [];
  try {
    const pages = await Promise.all([
      getPosts({ perPage: 100, page: 1 }),
      getPosts({ perPage: 100, page: 2 }),
    ]);
    posts = pages.flatMap((r) => r.posts || []);
  } catch {
    posts = [];
  }

  const entries = posts.map((p) => ({
    loc: `${SITE.url}/${p.slug}`,
    lastmod: p.modified || p.date,
    changefreq: "weekly",
    priority: 0.8,
  }));

  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
