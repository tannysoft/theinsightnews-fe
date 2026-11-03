import { archiveFeedResponse } from "@/lib/archive-feed";

// Per-tag feed, mirroring WordPress' `/tag/<slug>/feed`.
export const revalidate = 900; // 15 min

export async function GET(_request, { params }) {
  const { slug } = await params;
  return archiveFeedResponse("tag", slug);
}
