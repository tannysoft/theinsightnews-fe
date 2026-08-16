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
 * Newest first, matching Rank Math — its post-sitemap1.xml holds the most
 * recent content, and the index's lastmod for that page is the newest entry
 * in it. Ordering by ID rather than date keeps the sequence deterministic
 * when several posts share a timestamp.
 */
const POST_ORDER = { orderby: "id", order: "desc" };

/** Terms have no natural recency, so keep their order stable by ID. */
const TERM_ORDER = { orderby: "id", order: "asc" };

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

/** Everything the sitemap needs and nothing else. */
const POST_FIELDS = "slug,date_gmt,modified_gmt,images";

async function postBatches(page, fields = POST_FIELDS) {
  const batches = await Promise.all(
    wpPagesFor(page).map((p) =>
      safeTinList("posts", {
        per_page: WP_PER_PAGE,
        page: p,
        _fields: fields,
        ...POST_ORDER,
      })
    )
  );
  return batches.flatMap((b) => b.items);
}

async function postEntries(page) {
  const items = await postBatches(page);

  return items
    .filter((p) => p?.slug)
    .map((p) => ({
      loc: `${SITE.url}/${p.slug}`,
      lastmod: p.modified_gmt || p.date_gmt,
      // The featured image plus every image the content embeds, which is
      // what Rank Math lists.
      images: Array.isArray(p.images) ? p.images : [],
    }));
}

/**
 * Newest `modified` inside one post sitemap page, for the index's <lastmod>.
 * One cheap request per page — `_fields=modified_gmt` returns a single short
 * string per post, so 200 of them is a few kilobytes.
 */
async function postPageLastmod(page) {
  const items = await postBatches(page, "modified_gmt,date_gmt");
  let newest = null;
  for (const p of items) {
    const v = p?.modified_gmt || p?.date_gmt;
    if (v && (!newest || v > newest)) newest = v;
  }
  return newest;
}

/* ---------------------------------------------------------------- terms */

/** `hide_empty` is honoured by the REST terms controller — 8.5k tags → 5.3k. */
const TERM_PARAMS = { hide_empty: 1, _fields: "slug", ...TERM_ORDER };

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
      const { total } = await safeTinList("posts", { per_page: 1, _fields: "id" });
      return { total };
    },
    entries: postEntries,
    pageLastmod: postPageLastmod,
  },
  page: {
    count: async () => ({ total: STATIC_PAGES.length }),
    entries: async () => STATIC_PAGES.map((p) => ({ loc: `${SITE.url}${p}` })),
  },
  category: {
    count: async () => {
      const { total } = await safeList("categories", { per_page: 1, hide_empty: 1, _fields: "id" });
      return { total };
    },
    entries: (page) => termEntries("categories", "/category/", page),
  },
  post_tag: {
    count: async () => {
      const { total } = await safeList("tags", { per_page: 1, hide_empty: 1, _fields: "id" });
      return { total };
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
 *
 * Each entry gets its own <lastmod> where the type can supply one. Taxonomy
 * archives can't: deriving a term's real last-modified date means one query
 * per term, and there are 5k+ tags. Omitting it beats stamping `now`, which
 * would tell crawlers every archive changed on every fetch.
 */
export async function getSitemapIndexEntries() {
  const sections = await Promise.all(
    SITEMAP_TYPES.map(async (type) => {
      const { total } = await SOURCES[type].count();
      return { type, pages: pageCount(total) };
    })
  );

  const entries = await Promise.all(
    sections.flatMap(({ type, pages }) =>
      Array.from({ length: pages }, async (_, i) => ({
        loc: sitemapUrl(type, i + 1, pages),
        lastmod: SOURCES[type].pageLastmod
          ? await SOURCES[type].pageLastmod(i + 1)
          : null,
      }))
    )
  );

  return entries;
}
