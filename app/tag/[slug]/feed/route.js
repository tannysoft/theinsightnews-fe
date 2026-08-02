import { getTagBySlug, getPosts, decodeHtml, stripHtml } from "@/lib/api";
import { SITE } from "@/lib/site";
import {
  buildRss,
  feedItemsFromPosts,
  feedHeaders,
  FEED_ITEM_LIMIT,
} from "@/lib/feed-xml";

// Per-tag feed, mirroring WordPress' `/tag/<slug>/feed`.
export const revalidate = 900; // 15 min

export async function GET(_request, { params }) {
  const { slug } = await params;

  const tag = await getTagBySlug(slug);
  if (!tag) return new Response("Not found", { status: 404 });

  const name = decodeHtml(tag.name || slug);
  let posts = [];
  try {
    ({ posts } = await getPosts({ tags: tag.id, perPage: FEED_ITEM_LIMIT, full: true }));
  } catch {
    posts = [];
  }

  const xml = buildRss({
    title: `#${name} · ${SITE.name}`,
    description:
      stripHtml(tag.description || "") || `บทความที่แท็กด้วย ${name} จาก ${SITE.name}`,
    path: `/tag/${slug}`,
    feedPath: `/tag/${slug}/feed`,
    items: feedItemsFromPosts(posts),
  });

  return new Response(xml, { headers: feedHeaders("rss") });
}
