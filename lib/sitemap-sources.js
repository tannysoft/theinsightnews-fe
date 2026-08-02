// Data layer behind the Rank Math-style sitemaps.
//
// One module knows how to (a) count how many sub-sitemaps each content type
// needs and (b) build the entries for a given page, so the index and every
// `<type>-sitemap<N>.xml` route stay in sync automatically.
import { SITE } from "@/lib/site";
import { wpList, tinList } from "@/lib/api";
import {
  SITEMAP_CACHE_SECONDS,
  SITEMAP_LINKS_PER_PAGE,
  sitemapUrl,
} from "@/lib/sitemap-xml";

/** WP REST caps `per_page` at 100, so each sitemap page is two API calls. */
const WP_PER_PAGE = 100;
const WP_PAGES_PER_SITEMAP = SITEMAP_LINKS_PER_PAGE / WP_PER_PAGE;

const FETCH_OPTS = { revalidate: SITEMAP_CACHE_SECONDS };

export const SITEMAP_TYPES = ["post", "page", "category", "post_tag"];

export function isSitemapType(type) {
  return SITEMAP_TYPES.includes(type);
}

/**
 * Hand-built frontend pages. These aren't WP pages — the FE renders them from
 * its own routes — so they're listed explicitly rather than fetched.
 */
const STATIC_PAGES = [
  "/",
  "/insight-analysis",
  "/special-reports",
  "/opinion",
  "/about",
  "/membership",
  "/privacy",
];

/**
 * Ordering is by ascending ID everywhere, which makes pagination stable: new
 * content always lands on the last sitemap page instead of shifting every
 * entry down (and invalidating every cached sub-sitemap) on each publish.
 */
const ID_ORDER = { orderby: "id", order: "asc" };

/** WP pages backing sitemap page N (1-based). */
function wpPagesFor(page) {
  const first = (page - 1) * WP_PAGES_PER_SITEMAP + 1;
  return Array.from({ length: WP_PAGES_PER_SITEMAP }, (_, i) => first + i);
}

function pageCount(total) {
  return Math.max(1, Math.ceil((total || 0) / SITEMAP_LINKS_PER_PAGE));
}

/** Terms still come from core REST; posts come from the plugin's tin/v1. */
async function safeList(resource, params, list = wpList) {
  try {
    return await list(resource, params, FETCH_OPTS);
  } catch {
    return { items: [], total: 0, totalPages: 0 };
  }
}

const safeTinList = (resource, params) => safeList(resource, params, tinList);

/* ---------------------------------------------------------------- posts */

function featuredImages(post) {
  const loc = post?.featured?.url;
  if (!loc) return [];
  return [{ loc, title: post.title || "" }];
}

async function postEntries(page) {
  const batches = await Promise.all(
    wpPagesFor(page).map((p) =>
      safeTinList("posts", {
        per_page: WP_PER_PAGE,
        page: p,
        // Everything the sitemap needs and nothing else — no excerpt, no
        // terms, no author.
        _fields: "slug,title,date_gmt,modified_gmt,featured",
        ...ID_ORDER,
      })
    )
  );

  return batches
    .flatMap((b) => b.items)
    .filter((p) => p?.slug)
    .map((p) => ({
      loc: `${SITE.url}/${p.slug}`,
      lastmod: p.modified_gmt || p.date_gmt,
      images: featuredImages(p),
    }));
}

/* ---------------------------------------------------------------- terms */

/** `hide_empty` is honoured by the REST terms controller — 8.5k tags → 5.3k. */
const TERM_PARAMS = { hide_empty: 1, _fields: "slug", ...ID_ORDER };

async function termEntries(resource, prefix, page) {
  const batches = await Promise.all(
    wpPagesFor(page).map((p) =>
      safeList(resource, { per_page: WP_PER_PAGE, page: p, ...TERM_PARAMS })
    )
  );

  return batches
    .flatMap((b) => b.items)
    .filter((t) => t?.slug)
    // No <lastmod>: deriving a term's real last-modified date would cost one
    // query per term (5k+ for tags). Omitting it beats stamping `now`, which
    // would tell crawlers every archive changed on every fetch.
    .map((t) => ({ loc: `${SITE.url}${prefix}${t.slug}` }));
}

/* -------------------------------------------------------------- sources */

const SOURCES = {
  post: {
    count: async () => {
      // One call gives us both the total and the newest `modified` stamp.
      const { items, total } = await safeTinList("posts", {
        per_page: 1,
        orderby: "modified",
        order: "desc",
        _fields: "modified_gmt",
      });
      return { total, lastmod: items[0]?.modified_gmt || null };
    },
    entries: postEntries,
  },
  page: {
    count: async () => ({ total: STATIC_PAGES.length, lastmod: null }),
    entries: async () => STATIC_PAGES.map((p) => ({ loc: `${SITE.url}${p}` })),
  },
  category: {
    count: async () => {
      const { total } = await safeList("categories", { per_page: 1, hide_empty: 1, _fields: "id" });
      return { total, lastmod: null };
    },
    entries: (page) => termEntries("categories", "/category/", page),
  },
  post_tag: {
    count: async () => {
      const { total } = await safeList("tags", { per_page: 1, hide_empty: 1, _fields: "id" });
      return { total, lastmod: null };
    },
    entries: (page) => termEntries("tags", "/tag/", page),
  },
};

/** Entries for one `<type>-sitemap<N>.xml`. Unknown type / page → []. */
export async function getSitemapEntries(type, page = 1) {
  const source = SOURCES[type];
  if (!source) return [];
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1) return [];
  return source.entries(n);
}

/**
 * Every sub-sitemap the index should list, in Rank Math's order
 * (posts → pages → categories → tags).
 */
export async function getSitemapIndexEntries() {
  const counts = await Promise.all(
    SITEMAP_TYPES.map(async (type) => ({ type, ...(await SOURCES[type].count()) }))
  );

  return counts.flatMap(({ type, total, lastmod }) => {
    const pages = pageCount(total);
    return Array.from({ length: pages }, (_, i) => ({
      loc: sitemapUrl(type, i + 1),
      // Only the final page can contain the most recently touched item —
      // claiming that lastmod for the older pages would be wrong.
      lastmod: i + 1 === pages ? lastmod : null,
    }));
  });
}
