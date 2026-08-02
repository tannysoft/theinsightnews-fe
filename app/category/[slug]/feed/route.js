import { getCategoryBySlug, getPosts, decodeHtml, stripHtml } from "@/lib/api";
import { SITE } from "@/lib/site";
import {
  buildRss,
  feedItemsFromPosts,
  feedHeaders,
  FEED_ITEM_LIMIT,
} from "@/lib/feed-xml";

// Per-category feed, mirroring WordPress' `/category/<slug>/feed`.
export const revalidate = 900; // 15 min

export async function GET(_request, { params }) {
  const { slug } = await params;

  const cat = await getCategoryBySlug(slug);
  if (!cat) return new Response("Not found", { status: 404 });

  const name = decodeHtml(cat.name || slug);
  let posts = [];
  try {
    ({ posts } = await getPosts({ categories: cat.id, perPage: FEED_ITEM_LIMIT, full: true }));
  } catch {
    posts = [];
  }

  const xml = buildRss({
    title: `${name} · ${SITE.name}`,
    description:
      stripHtml(cat.description || "") || `รวมบทความในหมวด ${name} จาก ${SITE.name}`,
    path: `/category/${slug}`,
    feedPath: `/category/${slug}/feed`,
    items: feedItemsFromPosts(posts),
  });

  return new Response(xml, { headers: feedHeaders("rss") });
}
