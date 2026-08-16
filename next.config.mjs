/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permanent redirects for legacy URLs that people/search engines might
  // still hit. Posts used to live at /post/<slug>; they're now at /<slug>.
  async redirects() {
    return [
      {
        source: "/post/:slug",
        destination: "/:slug",
        permanent: true,
      },
    ];
  },
  // Sub-sitemaps keep Rank Math's public URL shape — `/page-sitemap.xml` for
  // a single-page type, `/post-sitemap1.xml` … `/post-sitemap7.xml` once a
  // type spans more than one — while a single handler serves them all.
  // `app/[slug]` owns the root dynamic segment, which rules out a root-level
  // catch-all route, hence the rewrite.
  async rewrites() {
    return [
      {
        source: "/:type-sitemap:page(\\d+).xml",
        destination: "/api/sitemap/:type/:page",
      },
      // Unnumbered form. Still served for multi-page types so older links
      // and Search Console submissions keep resolving to page 1.
      {
        source: "/:type-sitemap.xml",
        destination: "/api/sitemap/:type/1",
      },
    ];
  },
  images: {
    // We deploy to Cloudflare Workers without Cloudflare Images, so skip
    // Next's default image optimizer (which requires Node fs / sharp). Images
    // are served as-is from the WP origin.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "www.theinsightnews.co" },
      { protocol: "https", hostname: "theinsightnews.co" },
      { protocol: "https", hostname: "secure.gravatar.com" },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
      { protocol: "https", hostname: "cms.theinsightnews.co" },
      { protocol: "https", hostname: "files.theinsightnews.co" },
    ],
  },
};

// Wire the Cloudflare dev proxy so `next dev` can access bindings (KV, etc.)
// defined in wrangler.jsonc. Safe no-op outside dev.
if (process.env.NODE_ENV === "development") {
  try {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    await initOpenNextCloudflareForDev();
  } catch {
    // @opennextjs/cloudflare not installed yet — that's fine for plain dev.
  }
}

export default nextConfig;
