import { getPosts } from "@/lib/api";
import { SITE } from "@/lib/site";
import {
  buildRss,
  feedItemsFromPosts,
  feedHeaders,
  FEED_ITEM_LIMIT,
} from "@/lib/feed-xml";

// Main site feed. Lives at `/feed` — the same path WordPress served — so the
// origin→frontend redirect in the Headless Helpers plugin lands subscribers
// on a working feed rather than a 404.
export const revalidate = 900; // 15 min

export async function GET() {
  let posts = [];
  try {
    ({ posts } = await getPosts({ perPage: FEED_ITEM_LIMIT, full: true }));
  } catch {
    posts = [];
  }

  const xml = buildRss({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    path: "/",
    feedPath: "/feed",
    items: feedItemsFromPosts(posts),
  });

  return new Response(xml, { headers: feedHeaders("rss") });
}
