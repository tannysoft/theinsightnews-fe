// Map Yoast SEO plugin data (from WP REST `yoast_head_json`) into Next.js
// metadata + JSON-LD graph, rewriting canonical/og_url to our own domain.
import { SITE, absUrl } from "@/lib/site";

const LEGACY_HOSTS = [
  "https://www.theinsightnews.co",
  "https://theinsightnews.co",
];

/** Swap legacy URLs to the new front-end URL. */
export function rewriteUrl(url, ourPath) {
  if (!url) return ourPath ? absUrl(ourPath) : SITE.url;
  if (typeof ourPath === "string") return absUrl(ourPath);
  // Strip legacy host if present
  for (const h of LEGACY_HOSTS) {
    if (url.startsWith(h)) return url.replace(h, SITE.url);
  }
  return url;
}

/** Recursively rewrite @id / url strings in Yoast's schema graph. */
export function rewriteSchema(schema, urlMap = new Map()) {
  if (!schema) return null;
  const replace = (s) => {
    if (typeof s !== "string") return s;
    for (const [from, to] of urlMap) {
      if (s.startsWith(from)) return to + s.slice(from.length);
    }
    for (const h of LEGACY_HOSTS) {
      if (s.startsWith(h)) return SITE.url + s.slice(h.length);
    }
    return s;
  };
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, val] of Object.entries(v)) {
        if ((k === "@id" || k === "url" || k === "mainEntityOfPage") && typeof val === "string") {
          out[k] = replace(val);
        } else {
          out[k] = walk(val);
        }
      }
      return out;
    }
    return v;
  };
  return walk(schema);
}

/**
 * Build Next.js `metadata` from a Yoast `yoast_head_json` object.
 *
 * @param {object} yoast  The `yoast_head_json` field.
 * @param {object} opts
 *   - fallback: { title, description, image }
 *   - canonicalPath: local path to point canonical/og:url to, eg. "/post/foo"
 *   - feedPath: local path of this page's RSS feed, for <link rel="alternate">
 *   - noindex: bool
 */
export function yoastToMetadata(yoast, opts = {}) {
  const y = yoast || {};
  const fb = opts.fallback || {};
  const canonical = opts.canonicalPath ? absUrl(opts.canonicalPath) : rewriteUrl(y.canonical);

  // Strip trailing " : The Insight News" from titles since Next applies the template automatically
  const rawTitle = y.title || fb.title || "";
  const cleanTitle = rawTitle
    .replace(/\s*[:|–\-]\s*The Insight News\s*$/i, "")
    .trim() || fb.title;

  const ogImages =
    (y.og_image && y.og_image.length > 0
      ? y.og_image.map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
          alt: cleanTitle,
        }))
      : null) ||
    (fb.image ? [{ url: fb.image, alt: cleanTitle }] : [{ url: absUrl(SITE.defaultOgImage) }]);

  const robots = y.robots || {};
  const indexable = !(opts.noindex || /noindex/i.test(robots.index || ""));

  // Feed autodiscovery, the way WordPress emits it on archive pages.
  const alternates = { canonical };
  if (opts.feedPath) {
    alternates.types = {
      "application/rss+xml": [
        { url: absUrl(opts.feedPath), title: `${cleanTitle} · ${SITE.name}` },
      ],
    };
  }

  return {
    title: cleanTitle,
    description: y.description || y.og_description || fb.description,
    alternates,
    robots: {
      index: indexable,
      follow: !/nofollow/i.test(robots.follow || "") && indexable,
      googleBot: {
        index: indexable,
        follow: indexable,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: y.og_type || "article",
      title: y.og_title || cleanTitle,
      description: y.og_description || fb.description,
      url: canonical,
      siteName: y.og_site_name || SITE.name,
      locale: y.og_locale || SITE.locale,
      publishedTime: y.article_published_time,
      modifiedTime: y.article_modified_time,
      authors: y.author ? [y.author] : undefined,
      images: ogImages,
    },
    twitter: {
      card: y.twitter_card || "summary_large_image",
      title: y.twitter_title || y.og_title || cleanTitle,
      description: y.twitter_description || y.og_description || fb.description,
      creator: y.twitter_creator || SITE.twitter,
      site: y.twitter_site || SITE.twitter,
      images: ogImages.map((i) => i.url),
    },
  };
}

/** Extract the JSON-LD schema graph from Yoast and rewrite its URLs. */
export function yoastSchema(yoast, canonicalPath) {
  if (!yoast?.schema) return null;
  const urlMap = new Map();
  if (yoast.canonical && canonicalPath) urlMap.set(yoast.canonical, absUrl(canonicalPath));
  if (yoast.og_url && canonicalPath) urlMap.set(yoast.og_url, absUrl(canonicalPath));
  return rewriteSchema(yoast.schema, urlMap);
}
