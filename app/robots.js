import { SITE } from "@/lib/site";

// robots.txt — controls how search-engine crawlers access the site.
// Blocked paths:
//   /search           — query-based pages produce low-value duplicates
//   /_next/           — Next.js build artefacts, not user content
//   /api/             — server-only endpoints, should never be indexed
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/search", "/search?*", "/_next/", "/api/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
