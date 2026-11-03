import fs from "node:fs";

/**
 * `vars` from the wrangler config being built (wrangler.jsonc, or
 * wrangler.live.jsonc via WRANGLER_CONFIG for the live worker), so build-time
 * settings (SITE_NOINDEX, which ends up in the static headers and robots.txt)
 * have one source of truth.
 *
 * In a production build these win over .env.local, which points CMS_URL at
 * the local dev CMS: Next prerenders pages at build time, and fetching from a
 * CMS that isn't running bakes empty pages into the cache. Set
 * WRANGLER_VARS_OVERRIDE=0 to let the environment win instead.
 */
function wranglerVars() {
  try {
    const file = process.env.WRANGLER_CONFIG || "wrangler.jsonc";
    const raw = fs.readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    const json = raw.replace(/\/\*[\s\S]*?\*\/|(^|[^:"])\/\/.*$/gm, "$1");
    return JSON.parse(json).vars ?? {};
  } catch {
    return {};
  }
}
for (const [k, v] of Object.entries(wranglerVars())) {
  if (process.env.NODE_ENV === "development") break;
  if (process.env[k] === undefined || process.env.WRANGLER_VARS_OVERRIDE !== "0") process.env[k] = String(v);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace package shipped as TypeScript source (image sizes shared with the CMS).
  transpilePackages: ["@theinsightnews/shared"],
  // Baked in at build time: robots.txt is a static route.
  env: { SITE_NOINDEX: process.env.SITE_NOINDEX ?? "" },
  async headers() {
    // Preview hosts (SITE_NOINDEX=1) must not compete with www in search.
    if (process.env.SITE_NOINDEX !== "1") return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  // Permanent redirects for legacy URLs that people/search engines might
  // still hit. Posts used to live at /post/<slug>; they're now at /<slug>.
  async redirects() {
    return [
      {
        source: "/post/:slug",
        destination: "/:slug",
        permanent: true,
      },
      // WordPress' login entry point, as it appears on the *public* host:
      // WP builds those links from home_url(), and the CMS 301s wp-login.php
      // to its renamed /wp-backoffice. Handled here rather than being left to
      // app/[slug]'s old-slug resolver, which reached the same place only by
      // asking the CMS on every hit — and dropped the query string doing it,
      // losing the `redirect_to` that says where the visitor was going.
      {
        source: "/wp-login.php",
        destination: "/wp-backoffice",
        // 301 rather than Next's `permanent: true` (which emits 308), so the
        // whole login chain answers with the status WordPress used here.
        statusCode: 301,
      },
      // The admin lives on the CMS origin, never here. Links to it leak into
      // the wild anyway — old bookmarks, scrapers, bots probing every WP site
      // for a login form. Send them to the home page instead of a 404. The
      // catch-all covers deep links like /wp-admin/post.php?post=1.
      // WordPress served uploads from this host; they now live on the media host.
      {
        source: "/wp-content/uploads/:path*",
        destination: `${(process.env.MEDIA_URL || "https://files.theinsightnews.co").replace(/\/+$/, "")}/wp-content/uploads/:path*`,
        statusCode: 301,
      },
      {
        source: "/wp-admin",
        destination: "/",
        statusCode: 301,
      },
      {
        source: "/wp-admin/:path*",
        destination: "/",
        statusCode: 301,
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
    // No Next image optimizer on Workers: images are plain <img>/<picture>
    // pointing at files.theinsightnews.co (WordPress sizes, or the CMS's WebP
    // copies — packages/shared/src/image-sizes.ts).
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
