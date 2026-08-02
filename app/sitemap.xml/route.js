import { SITE } from "@/lib/site";

// Rank Math treats `/sitemap_index.xml` as the one true index and permanently
// redirects `/sitemap.xml` to it, so older Search Console submissions and any
// stale links keep resolving. We do the same.
export const dynamic = "force-static";

export async function GET() {
  return Response.redirect(`${SITE.url}/sitemap_index.xml`, 301);
}
