import { CMS_ORIGIN } from "@/lib/site";
import { scrubDeep } from "@/lib/urls";

// Overridable via `WP_ORIGIN=… npm run build` — see lib/site.js.
const WP_ORIGIN = CMS_ORIGIN;
const WP_JSON = `${WP_ORIGIN}/wp-json`;

/** Core REST — still the source for taxonomy terms. */
const WP_BASE = `${WP_JSON}/wp/v2`;

/**
 * Posts come from the Headless Helpers plugin instead of `/wp/v2/posts`.
 * It returns the same query surface but inlines the featured image (all
 * sizes), author, terms and reading time, so we don't need `_embed` — which
 * on this site meant ~4MB for 100 posts, over the ISR data-cache ceiling.
 */
const TIN_BASE = `${WP_JSON}/tin/v1`;

const REVALIDATE = 300; // 5 min ISR

/**
 * Every read from WordPress goes through here, and every response is scrubbed
 * on the way out — WordPress writes its own host into permalinks, content
 * links, Yoast's schema graph and image URLs, and none of that may reach the
 * public site. Doing it at the single choke point means a new caller can't
 * forget: the raw CMS host simply never escapes this module.
 */
async function apiFetch(path, { revalidate = REVALIDATE, base = WP_BASE } = {}) {
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    return { data: null, total: 0, totalPages: 0, error: res.status };
  }
  const data = await res.json();
  return {
    data: scrubDeep(data),
    total: Number(res.headers.get("x-wp-total") || 0),
    totalPages: Number(res.headers.get("x-wp-totalpages") || 0),
  };
}

const wpFetch = (path, opts = {}) => apiFetch(path, { ...opts, base: WP_BASE });
const tinFetch = (path, opts = {}) => apiFetch(path, { ...opts, base: TIN_BASE });

/**
 * Parse a WordPress REST timestamp into a Date.
 *
 * The `*_gmt` fields are naive UTC strings ("2026-08-01T11:45:44") with no
 * offset, so `new Date()` would interpret them in whatever timezone the
 * runtime happens to be in. Pin them to UTC explicitly — sitemaps and feeds
 * publish absolute timestamps, and a 7-hour drift there is visible to
 * crawlers. Returns null for anything unparseable.
 */
export function parseWpDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value}Z`
      : value;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

/**
 * Lean, generic collection fetch against core REST — used by the sitemaps for
 * taxonomy terms, which need arbitrary query params (`hide_empty`, `_fields`,
 * `orderby`, …) and the total-count headers.
 *
 * @returns {Promise<{ items: any[], total: number, totalPages: number }>}
 */
export async function wpList(resource, params = {}, { revalidate = REVALIDATE } = {}) {
  const { data, total, totalPages } = await wpFetch(`/${resource}${qs(params)}`, {
    revalidate,
  });
  return { items: Array.isArray(data) ? data : [], total, totalPages };
}

/** Same, against the plugin's `tin/v1` namespace. */
export async function tinList(resource, params = {}, { revalidate = REVALIDATE } = {}) {
  const { data, total, totalPages } = await tinFetch(`/${resource}${qs(params)}`, {
    revalidate,
  });
  return { items: Array.isArray(data) ? data : [], total, totalPages };
}

/**
 * @param {object} opts
 *   - full: request `context=view`, i.e. include the rendered article body.
 *     Off by default — cards, archives and related-post rails only need the
 *     excerpt, and shipping content for 20 posts dwarfs everything else.
 */
export async function getPosts({
  perPage = 12,
  page = 1,
  categories,
  tags,
  search,
  exclude,
  sticky,
  offset,
  full = false,
} = {}) {
  const { data, total, totalPages } = await tinFetch(
    `/posts${qs({
      per_page: perPage,
      page,
      categories,
      tags,
      search,
      exclude,
      sticky,
      offset,
      context: full ? "view" : undefined,
    })}`
  );
  return { posts: (data || []).map(normalizePost), total, totalPages };
}

export async function getPost(slug) {
  const { data } = await tinFetch(`/posts${qs({ slug, per_page: 1, context: "view" })}`);
  if (!data || !data.length) return null;
  return normalizePost(data[0]);
}

/**
 * An old slug -> the post's current slug, or null.
 *
 * WordPress keeps a renamed post's previous slug in `_wp_old_slug` so that
 * `wp_old_slug_redirect()` can 301 stale links. This used to piggyback on
 * that hook by requesting `/?name=<slug>` on the origin and reading the
 * Location header, which stopped working the moment the CMS started
 * redirecting public requests to the frontend: WP now answers `?name=` with
 * a 301 to the public site before it ever resolves the query, so the
 * resolver saw a cross-origin Location and gave up every time. Worse, the
 * one path that *did* stay on the CMS was the hidden-login decoy, so
 * /wp-login.php resolved to a "post" called wp-backoffice.
 *
 * The plugin exposes the meta directly instead (1.10.0+). Older plugin
 * versions 404 the endpoint, which lands here as null — the same as an
 * unknown slug, so the page just 404s as it does today.
 */
export async function resolveOldSlug(slug) {
  if (!slug) return null;
  // Retired slugs don't change; cache hits and misses for an hour so a burst
  // of 404s doesn't hammer the origin.
  const { data } = await tinFetch(`/resolve-slug${qs({ slug })}`, { revalidate: 3600 });
  const current = data?.slug;
  if (!current || current === slug) return null;
  return current;
}

/**
 * A published author, by their WordPress `user_nicename` (the slug in
 * /author/<slug>). Core REST only exposes users who have published posts,
 * which is exactly the set that should have an author page.
 */
export async function getAuthorBySlug(slug) {
  const { data } = await wpFetch(
    `/users${qs({ slug, _fields: "id,name,slug,description,avatar_urls,yoast_head_json" })}`
  );
  const user = data && data[0];
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    slug: user.slug,
    description: user.description || "",
    avatar: user.avatar_urls?.["96"] || user.avatar_urls?.["48"] || null,
    yoast: user.yoast_head_json || null,
  };
}

/**
 * How many published posts an author has.
 *
 * Core lists every user who has published anything, pages included, so an
 * account that only ever edited WP pages still resolves as an "author" —
 * with an empty archive. Callers use this to 404 those rather than serve a
 * thin, indexable page.
 */
export async function countPostsByAuthor(authorId) {
  if (!authorId) return 0;
  const { total } = await wpList("posts", {
    author: authorId,
    per_page: 1,
    _fields: "id",
  });
  return total;
}

/**
 * Posts by a given author.
 *
 * `tin/v1/posts` has no author filter, and adding one would only work once
 * the plugin is updated on the CMS — until then an unknown param is ignored
 * and the endpoint would happily return *every* post under someone's name.
 * So the author filter runs against core REST, which we ask for nothing but
 * IDs, and those IDs are then hydrated through `tin/v1` for the inlined
 * image/terms payload the cards need. `orderby=include` preserves core's
 * date ordering through the second request.
 */
export async function getPostsByAuthor({ authorId, perPage = 12, page = 1, offset } = {}) {
  if (!authorId) return { posts: [], total: 0, totalPages: 0 };

  const { items, total, totalPages } = await wpList("posts", {
    author: authorId,
    per_page: perPage,
    // WP REST ignores `page` when `offset` is set, the same way the archive
    // pages already rely on for taxonomy listings.
    page: offset === undefined ? page : undefined,
    offset,
    orderby: "date",
    order: "desc",
    _fields: "id",
  });

  const ids = items.map((p) => p.id).filter(Boolean);
  if (!ids.length) return { posts: [], total, totalPages };

  const { items: full } = await tinList("posts", {
    include: ids.join(","),
    orderby: "include",
    per_page: ids.length,
  });

  return { posts: full.map(normalizePost), total, totalPages };
}

export async function getCategories() {
  const { data } = await wpFetch(`/categories?per_page=50&orderby=count&order=desc`);
  return data || [];
}

export async function getCategoryBySlug(slug) {
  const { data } = await wpFetch(`/categories${qs({ slug })}`);
  return data && data[0] ? data[0] : null;
}

export async function getTagBySlug(slug) {
  const { data } = await wpFetch(`/tags${qs({ slug })}`);
  return data && data[0] ? data[0] : null;
}

export async function getPopularTags({ perPage = 30 } = {}) {
  const { data } = await wpFetch(`/tags?per_page=${perPage}&orderby=count&order=desc`);
  return data || [];
}

// The WP site's taxonomy doesn't match the design IA 1:1. We map the
// requested sections onto the most relevant actual categories.
export const SECTION_MAP = {
  "insight-analysis": {
    title: "Insight Analysis",
    subtitle: "วิเคราะห์ข่าวเชิงลึก เจาะประเด็นร้อน",
    categoryIds: [3094, 7440, 1728, 5161, 5178],
    subsections: [
      { label: "Political Analysis", ids: [1728, 5161] },
      { label: "Economic Trends", ids: [5178, 5179] },
      { label: "Data Stories", ids: [3094] },
      { label: "Fact-Check & Debunk", ids: [4229, 4753] },
      { label: "Investigative Reports", ids: [4231] },
    ],
  },
  "special-reports": {
    title: "Special Reports",
    subtitle: "รายงานพิเศษ สารคดีข่าว และบทสัมภาษณ์",
    categoryIds: [4231, 2105, 3809, 3973, 5102],
    subsections: [
      { label: "Exclusive Interviews", ids: [5157, 5102] },
      { label: "Long-form Articles", ids: [4231, 2105] },
      { label: "Thematic Series", ids: [3809] },
      { label: "White Papers & Research", ids: [3094] },
    ],
  },
  opinion: {
    title: "Opinion",
    subtitle: "ทัศนะและบทวิเคราะห์จากผู้เชี่ยวชาญ",
    categoryIds: [5157, 4110, 4108, 1719, 3113],
    subsections: [
      { label: "Video Analysis", ids: [3113] },
      { label: "Podcast — Inside Insight", ids: [1719] },
      { label: "Infographics & Data Visualization", ids: [3094] },
      { label: "Photo Essays", ids: [1745] },
    ],
  },
  about: {
    title: "About Us",
    subtitle: "รู้จักกับ The Insight News",
  },
  membership: {
    title: "Membership / Support Us",
    subtitle: "ร่วมสนับสนุนวารสารศาสตร์คุณภาพ",
  },
};

/**
 * Named-entity table. Covers common HTML/WP entities.
 * (Numeric entities &#NNNN; and &#xHHHH; are decoded generically below.)
 */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
  prime: "′",
  Prime: "″",
  sbquo: "‚",
  bdquo: "„",
  dagger: "†",
  Dagger: "‡",
  permil: "‰",
  lsaquo: "‹",
  rsaquo: "›",
  euro: "€",
  cent: "¢",
  pound: "£",
  yen: "¥",
  sect: "§",
  para: "¶",
  brvbar: "¦",
  iexcl: "¡",
  iquest: "¿",
  shy: "\u00AD",
  zwj: "\u200D",
  zwnj: "\u200C",
  thinsp: "\u2009",
  ensp: "\u2002",
  emsp: "\u2003",
};

/** Decode HTML entities robustly — numeric (dec/hex) and named. */
export function decodeEntities(str = "") {
  if (!str) return "";
  return String(str).replace(
    /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (_, ent) => {
      if (ent[0] === "#") {
        const code =
          ent[1] === "x" || ent[1] === "X"
            ? parseInt(ent.slice(2), 16)
            : parseInt(ent.slice(1), 10);
        if (!Number.isFinite(code)) return _;
        try {
          return String.fromCodePoint(code);
        } catch {
          return _;
        }
      }
      const named = NAMED_ENTITIES[ent];
      return named !== undefined ? named : _;
    }
  );
}

export function stripHtml(html = "") {
  const text = String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return decodeEntities(text);
}

export function decodeHtml(html = "") {
  return decodeEntities(String(html));
}

/**
 * Pick the best WP-generated image URL for a given preset.
 *
 * Presets correspond to WP core sizes (`thumbnail`, `medium`, `medium_large`,
 * `large`, `full`). If the requested size isn't present we fall back through
 * progressively larger sizes, so we never ship a broken URL.
 *
 * We do this because the app runs on Cloudflare Workers without Cloudflare
 * Images: the browser fetches the original URL directly, so picking the right
 * WP-pre-rendered size is the main image-bandwidth lever we have.
 */
export function pickImage(post, size = "medium_large") {
  if (!post) return null;
  const sizes = post.featuredSizes;
  if (!sizes) return post.featuredImage || null;
  const FALLBACKS = {
    thumbnail: ["thumbnail", "medium", "medium_large", "large", "full"],
    medium: ["medium", "medium_large", "large", "thumbnail", "full"],
    medium_large: ["medium_large", "large", "1536x1536", "medium", "full"],
    large: ["large", "1536x1536", "2048x2048", "medium_large", "full"],
    full: ["full", "2048x2048", "1536x1536", "large", "medium_large"],
  };
  const tryList = FALLBACKS[size] || FALLBACKS.medium_large;
  for (const k of tryList) if (sizes[k]?.url) return sizes[k].url;
  return post.featuredImage || null;
}

/**
 * `tin/v1` post → the shape the components expect.
 *
 * Mostly a rename: the endpoint already delivers decoded plain-text titles
 * and excerpts, flattened terms/author, and a `featured` object holding every
 * generated size — so there's nothing left to strip, decode or dig out of
 * `_embedded` here. `content` and `yoast` are only present on `context=view`
 * responses.
 */
function normalizePost(p) {
  // Already scrubbed of CMS URLs by apiFetch().
  const featured = p.featured || null;

  return {
    id: p.id,
    slug: p.slug,
    date: p.date,
    modified: p.modified,
    // UTC counterparts — used by the feeds and sitemaps, which must emit
    // unambiguous timestamps. See parseWpDate().
    dateGmt: p.date_gmt || null,
    modifiedGmt: p.modified_gmt || null,
    title: p.title || "",
    excerpt: p.excerpt || "",
    content: p.content || "",
    link: p.link,
    featuredImage: featured?.url || null,
    featuredSizes: featured?.sizes || null,
    featuredCaption: featured?.caption || "",
    featuredAlt: featured?.alt || "",
    author: {
      id: p.author?.id,
      name: p.author?.name || "กองบรรณาธิการ",
      slug: p.author?.slug || null,
      avatar: p.author?.avatar || null,
      description: p.author?.description || "",
    },
    categories: p.categories || [],
    tags: p.tags || [],
    reading: p.reading || 1,
    yoast: p.yoast || null,
  };
}

export function formatDate(iso, { short = false } = {}) {
  if (!iso) return "";
  const d = new Date(iso);
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543;
  if (short) return `${day} ${month} ${String(year).slice(-2)}`;
  return `${day} ${month} ${year}`;
}

export function relativeTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "เมื่อสักครู่";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  return formatDate(iso, { short: true });
}
