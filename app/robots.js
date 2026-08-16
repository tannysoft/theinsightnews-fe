import { SITE } from "@/lib/site";

// robots.txt — controls how search-engine crawlers access the site.
// Blocked paths:
//   /search           — query-based pages produce low-value duplicates
//   /api/             — server-only endpoints, should never be indexed
//
// `/_next/` is deliberately NOT blocked: it holds the JS and CSS Googlebot
// needs to render the page. Blocking it makes the crawler render the site
// unstyled and half-built, which it then judges on.
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/search", "/search?*", "/api/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap_index.xml`,
    host: SITE.url,
  };
}
