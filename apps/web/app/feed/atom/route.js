import { getPosts } from "@/lib/api";
import { SITE } from "@/lib/site";
import {
  buildAtom,
  feedItemsFromPosts,
  feedHeaders,
  FEED_ITEM_LIMIT,
} from "@/lib/feed-xml";

// Atom 1.0 counterpart of `/feed`, matching WordPress' `/feed/atom`.
export const revalidate = 900; // 15 min

export async function GET() {
  let posts = [];
  try {
    ({ posts } = await getPosts({ perPage: FEED_ITEM_LIMIT, full: true }));
  } catch {
    posts = [];
  }

  const xml = buildAtom({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    path: "/",
    feedPath: "/feed/atom",
    items: feedItemsFromPosts(posts),
  });

  return new Response(xml, { headers: feedHeaders("atom") });
}
