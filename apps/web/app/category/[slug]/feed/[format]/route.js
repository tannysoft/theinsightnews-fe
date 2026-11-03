import { archiveFeedResponse } from "@/lib/archive-feed";

// `/category/<slug>/feed/rss2` and `/category/<slug>/feed/atom` — the same feed
// under the other two URLs WordPress publishes it at. Anything else 404s.
export const revalidate = 900; // 15 min

export async function GET(_request, { params }) {
  const { slug, format } = await params;
  return archiveFeedResponse("category", slug, format);
}
