// Data layer behind the Rank Math-style sitemaps.
//
// One module knows how to (a) count how many sub-sitemaps each content type
// needs and (b) build the entries for a given page, so the index and every
// `<type>-sitemap<N>.xml` route stay in sync automatically.
import { SITE, CDN_ORIGIN, MIN_INDEXABLE_TAG_POSTS } from "@/lib/site";
import { wpList, tinList, parseWpDate } from "@/lib/api";
import {
  SITEMAP_CACHE_SECONDS,
  SITEMAP_LINKS_PER_PAGE,
  sitemapUrl,
} from "@/lib/sitemap-xml";

/** WP REST caps `per_page` at 100, so each sitemap page is two API calls. */
const WP_PER_PAGE = 100;
const WP_PAGES_PER_SITEMAP = SITEMAP_LINKS_PER_PAGE / WP_PER_PAGE;

const FETCH_OPTS = { revalidate: SITEMAP_CACHE_SECONDS };

export const SITEMAP_TYPES = ["post", "page", "category", "post_tag", "author"];

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

/**
 * Hosts whose images are ours to list: the public site and the media CDN in
 * front of the WP origin.
 */
const OWN_IMAGE_HOSTS = new Set(
  [SITE.url, CDN_ORIGIN].map((u) => {
    try {
      return new URL(u).host.toLowerCase();
    } catch {
      return "";
    }
  })
);

/**
 * Drop images the site doesn't host.
 *
 * Years of posts embed pictures hotlinked straight from other sites —
 * news outlets, Google user content, Facebook CDN links that expire. They
 * turn up in the content scan like any other <img>, but they aren't this
 * site's images to declare, and the expiring ones are dead entries the day
 * they're published. Rank Math draws the same line: content images from
 * another host are skipped unless you explicitly opt in.
 */
function ownImages(urls) {
  if (!Array.isArray(urls)) return [];
  return urls.filter((u) => {
    try {
      return OWN_IMAGE_HOSTS.has(new URL(u).host.toLowerCase());
    } catch {
      return false;
    }
  });
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
      images: ownImages(p.images),
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

/** `hide_empty` is honoured by the REST terms controller. Categories only — tags go through indexableTags(). */
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
    // query per term (hundreds of tags). Omitting it beats stamping `now`, which
    // would tell crawlers every archive changed on every fetch.
    .map((t) => ({ loc: `${SITE.url}${prefix}${t.slug}` }));
}

/**
 * Every tag whose archive is indexable — see MIN_INDEXABLE_TAG_POSTS.
 *
 * REST can't filter terms by count, but it can sort by it: page through
 * busiest-first and stop at the first page that dips below the bar. That's a
 * handful of requests for the few hundred tags that qualify, instead of
 * walking all 8k+. Re-sorted by ID afterwards so an entry doesn't hop between
 * sitemap pages every time a tag gains a post.
 */
async function indexableTags() {
  const tags = [];
  for (let p = 1; ; p++) {
    const { items, totalPages } = await safeList("tags", {
      per_page: WP_PER_PAGE,
      page: p,
      orderby: "count",
      order: "desc",
      _fields: "id,slug,count",
    });
    const keep = items.filter((t) => t?.slug && t.count >= MIN_INDEXABLE_TAG_POSTS);
    tags.push(...keep);
    if (keep.length < items.length || p >= totalPages) break;
  }
  return tags.sort((a, b) => a.id - b.id);
}

async function tagEntries(page) {
  const tags = await indexableTags();
  const start = (page - 1) * SITEMAP_LINKS_PER_PAGE;
  return tags
    .slice(start, start + SITEMAP_LINKS_PER_PAGE)
    .map((t) => ({ loc: `${SITE.url}/tag/${t.slug}` }));
}

/* -------------------------------------------------------------- authors */

/**
 * Core REST only lists users who have published something, which is exactly
 * the set that has an /author page — the same reason `getAuthorBySlug()`
 * reads from there.
 */
const AUTHOR_PARAMS = { _fields: "id,slug", orderby: "id", order: "asc" };

/**
 * How many posts an author has, and when the newest was touched — the
 * entry's <lastmod>. Affordable here in a way it isn't for tags: a site has
 * a handful of authors, not hundreds of terms.
 */
async function authorActivity(id) {
  const { items, total } = await safeList("posts", {
    author: id,
    per_page: 1,
    orderby: "modified",
    order: "desc",
    _fields: "modified_gmt,date_gmt",
  });
  const p = items[0];
  return { total, lastmod: p ? p.modified_gmt || p.date_gmt || null : null };
}

async function authorRows(page) {
  const batches = await Promise.all(
    wpPagesFor(page).map((p) =>
      safeList("users", { per_page: WP_PER_PAGE, page: p, ...AUTHOR_PARAMS })
    )
  );

  const authors = batches.flatMap((b) => b.items).filter((a) => a?.slug);
  const activity = await Promise.all(authors.map((a) => authorActivity(a.id)));

  // Core lists anyone who has published *any* post type, so an editor who
  // only ever touched WP pages shows up here with no articles at all. Their
  // archive is empty, and the frontend 404s it — don't advertise it.
  return authors
    .map((a, i) => ({ author: a, ...activity[i] }))
    .filter((row) => row.total > 0)
    .map((row) => ({
      loc: `${SITE.url}/author/${row.author.slug}`,
      lastmod: row.lastmod,
    }));
}

async function authorPageLastmod(page) {
  const rows = await authorRows(page);
  let newest = null;
  for (const r of rows) {
    if (r.lastmod && (!newest || r.lastmod > newest)) newest = r.lastmod;
  }
  return newest;
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
    count: async () => ({ total: (await indexableTags()).length }),
    entries: tagEntries,
  },
  author: {
    count: async () => {
      const { total } = await safeList("users", { per_page: 1, _fields: "id" });
      return { total };
    },
    entries: authorRows,
    pageLastmod: authorPageLastmod,
  },
};

/* ----------------------------------------------------------------- news */

/** Google News only reads articles from the last two days. */
const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Entries for `/news-sitemap.xml`. The newest 100 posts cover two days with
 * plenty to spare at this site's pace; filtering by date here rather than
 * with `after=` keeps it to a query the plugin is known to accept.
 */
export async function getNewsSitemapEntries() {
  const { items } = await safeTinList("posts", {
    per_page: WP_PER_PAGE,
    _fields: "slug,title,date_gmt",
    orderby: "date",
    order: "desc",
  });
  const cutoff = Date.now() - NEWS_WINDOW_MS;
  return items
    .filter((p) => p?.slug && p.title)
    .map((p) => ({ loc: `${SITE.url}/${p.slug}`, title: p.title, published: parseWpDate(p.date_gmt) }))
    .filter((e) => e.published && e.published.getTime() >= cutoff);
}

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
 * (posts → pages → categories → tags → authors).
 *
 * Each entry gets its own <lastmod> where the type can supply one. Taxonomy
 * archives can't: deriving a term's real last-modified date means one query
 * per term, and there are hundreds of tags. Omitting it beats stamping `now`, which
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
