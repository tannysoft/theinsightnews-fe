import { getPost } from "@/lib/api";
import { buildEmptyCommentsFeed, feedHeaders } from "@/lib/feed-xml";

// Per-post comment feed (`/<slug>/feed` in WordPress). Comments are off, so
// this is an empty-but-valid channel — and a 404 for unknown slugs, so we
// don't invent feeds for URLs that don't exist.
export const revalidate = 900; // 15 min

export async function GET(_request, { params }) {
  const { slug } = await params;

  const post = await getPost(slug);
  if (!post) return new Response("Not found", { status: 404 });

  const xml = buildEmptyCommentsFeed({
    title: post.title,
    path: `/${slug}`,
    feedPath: `/${slug}/feed`,
  });
  return new Response(xml, { headers: feedHeaders("rss") });
}
