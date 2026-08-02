// Map Yoast SEO plugin data (from WP REST `yoast_head_json`) into Next.js
// metadata + JSON-LD graph, rewriting every URL onto our own domain.
import { SITE, absUrl } from "@/lib/site";
import { scrubCmsUrls, scrubDeep } from "@/lib/urls";

/** Swap a CMS/legacy URL for its public equivalent. */
export function rewriteUrl(url, ourPath) {
  if (!url) return ourPath ? absUrl(ourPath) : SITE.url;
  if (typeof ourPath === "string") return absUrl(ourPath);
  return scrubCmsUrls(url);
}

/**
 * Rewrite Yoast's schema graph onto the public domain.
 *
 * Yoast builds the graph from WordPress' own home_url(), so on a headless
 * install every node carries the CMS host. Scrubbing has to be
 * key-agnostic: the host turns up not just in `@id` and `url` but in
 * breadcrumb `item`, `potentialAction.target`, `urlTemplate`, `contentUrl`,
 * `sameAs` and the publisher/author references. Walking a whitelist of keys
 * left most of them behind.
 */
export function rewriteSchema(schema, urlMap = new Map()) {
  if (!schema) return null;
  const replace = (s) => {
    for (const [from, to] of urlMap) {
      if (s.startsWith(from)) return to + s.slice(from.length);
    }
    return scrubCmsUrls(s);
  };
  const walk = (v) => {
    if (typeof v === "string") return replace(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
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
  // Taxonomy terms come straight from /wp/v2 and haven't been through the
  // post normaliser, so their og:image / og:url still carry the CMS host.
  const y = scrubDeep(yoast || {});
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

/* -------------------------------------------------------------- branding */

const ORG_TYPES = new Set([
  "Organization",
  "NewsMediaOrganization",
  "Corporation",
  "LocalBusiness",
  "OnlineBusiness",
]);

function isOrganization(node) {
  const t = node?.["@type"];
  return Array.isArray(t) ? t.some((x) => ORG_TYPES.has(x)) : ORG_TYPES.has(t);
}

/** Every `@id` the Organization points at for its logo/image. */
function logoRefs(node) {
  const ids = [];
  for (const key of ["logo", "image"]) {
    const ref = node[key];
    if (typeof ref === "string") ids.push(ref);
    else if (ref && typeof ref === "object" && ref["@id"]) ids.push(ref["@id"]);
  }
  return ids;
}

/** True when Yoast's Organization node already describes this publisher. */
function identifiesThisSite(node) {
  const name = String(node?.name || "").trim().toLowerCase();
  return name === SITE.name.toLowerCase() || name === SITE.shortName.toLowerCase();
}

/**
 * Make sure the publisher in Yoast's graph is this site.
 *
 * Yoast fills the Organization node from WordPress' Site Representation
 * settings. When those are right we leave the node's own data alone — its
 * logo is a real raster with dimensions, which is what Google wants for
 * Organization results and better than anything we'd substitute. We only
 * normalise `@type`, since "NewsMediaOrganization" is the accurate type for
 * this site and Yoast always emits the generic "Organization".
 *
 * When the node describes someone else — as it did while WordPress still
 * carried the previous brand — we overwrite it from lib/site.js, including
 * the logo ImageObject it points at. Otherwise an article page ships two
 * contradictory Organizations: ours from the layout and a stale one here.
 * `@id` is left untouched either way, because the WebPage/Article nodes
 * reference it as their publisher.
 */
export function applySiteBranding(schema) {
  if (!schema) return schema;

  const graph = Array.isArray(schema?.["@graph"]) ? schema["@graph"] : null;
  const nodes = graph || (Array.isArray(schema) ? schema : [schema]);

  const staleLogoIds = new Set();
  const branded = nodes.map((node) => {
    if (!node || typeof node !== "object" || !isOrganization(node)) return node;

    if (identifiesThisSite(node)) {
      return { ...node, "@type": SITE.organizationType };
    }

    logoRefs(node).forEach((id) => staleLogoIds.add(id));
    return {
      ...node,
      "@type": SITE.organizationType,
      name: SITE.name,
      alternateName: SITE.shortName,
      url: SITE.url,
      description: SITE.description,
      sameAs: SITE.socialProfiles,
    };
  });

  if (!staleLogoIds.size) {
    return graph ? { ...schema, "@graph": branded } : Array.isArray(schema) ? branded : branded[0];
  }

  // Yoast nests the logo inside the Organization *and* repeats it as its own
  // graph node, so replace it in both places.
  const logoUrl = absUrl(SITE.logo);
  const replaceLogo = (node) => {
    const { width, height, ...rest } = node;
    return {
      ...rest,
      "@type": "ImageObject",
      url: logoUrl,
      contentUrl: logoUrl,
      caption: SITE.name,
    };
  };

  const withLogo = branded.map((node) => {
    if (!node || typeof node !== "object") return node;
    if (isOrganization(node) && node.logo && typeof node.logo === "object" && node.logo.url) {
      node = { ...node, logo: replaceLogo(node.logo) };
    }
    const id = node["@id"];
    if (typeof id === "string" && staleLogoIds.has(id)) return replaceLogo(node);
    return node;
  });

  if (graph) return { ...schema, "@graph": withLogo };
  if (Array.isArray(schema)) return withLogo;
  return withLogo[0];
}

/** Extract the JSON-LD schema graph from Yoast, rewrite URLs, apply branding. */
export function yoastSchema(yoast, canonicalPath) {
  if (!yoast?.schema) return null;
  const urlMap = new Map();
  if (yoast.canonical && canonicalPath) urlMap.set(yoast.canonical, absUrl(canonicalPath));
  if (yoast.og_url && canonicalPath) urlMap.set(yoast.og_url, absUrl(canonicalPath));
  return applySiteBranding(rewriteSchema(yoast.schema, urlMap));
}
