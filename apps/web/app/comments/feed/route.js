import { SITE } from "@/lib/site";
import { buildEmptyCommentsFeed, feedHeaders } from "@/lib/feed-xml";

// WordPress advertises a site-wide comment feed here and readers/crawlers
// still ask for it. The site doesn't run comments, so serve a valid empty
// channel rather than a 404.
export const dynamic = "force-static";

export async function GET() {
  const xml = buildEmptyCommentsFeed({
    title: SITE.name,
    path: "/",
    feedPath: "/comments/feed",
  });
  return new Response(xml, { headers: feedHeaders("rss") });
}
