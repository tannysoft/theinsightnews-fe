import { archiveFeedResponse } from "@/lib/archive-feed";

// Per-category feed, mirroring WordPress' `/category/<slug>/feed`.
export const revalidate = 900; // 15 min

export async function GET(_request, { params }) {
  const { slug } = await params;
  return archiveFeedResponse("category", slug);
}
