const WP_BASE = "https://www.theinsightnews.co/wp-json/wp/v2";
const REVALIDATE = 300; // 5 min ISR

async function wpFetch(path, { revalidate = REVALIDATE } = {}) {
  const url = path.startsWith("http") ? path : `${WP_BASE}${path}`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    return { data: null, total: 0, totalPages: 0, error: res.status };
  }
  const data = await res.json();
  return {
    data,
    total: Number(res.headers.get("x-wp-total") || 0),
    totalPages: Number(res.headers.get("x-wp-totalpages") || 0),
  };
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

export async function getPosts({ perPage = 12, page = 1, categories, tags, search, exclude, sticky, offset } = {}) {
  const { data, total, totalPages } = await wpFetch(
    `/posts${qs({
      per_page: perPage,
      page,
      categories,
      tags,
      search,
      exclude,
      sticky,
      offset,
      _embed: 1,
    })}`
  );
  return { posts: (data || []).map(normalizePost), total, totalPages };
}

export async function getPost(slug) {
  const { data } = await wpFetch(`/posts${qs({ slug, _embed: 1 })}`);
  if (!data || !data.length) return null;
  return normalizePost(data[0]);
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

function normalizePost(p) {
  const emb = p._embedded || {};
  const media = emb["wp:featuredmedia"]?.[0];
  const author = emb.author?.[0];
  const termGroups = emb["wp:term"] || [];
  const cats = (termGroups[0] || []).map((t) => ({
    id: t.id,
    name: decodeHtml(t.name || ""),
    slug: t.slug,
  }));
  const tags = (termGroups[1] || []).map((t) => ({
    id: t.id,
    name: decodeHtml(t.name || ""),
    slug: t.slug,
  }));

  return {
    id: p.id,
    slug: p.slug,
    date: p.date,
    modified: p.modified,
    title: decodeHtml(p.title?.rendered || ""),
    excerpt: stripHtml(p.excerpt?.rendered || ""),
    content: p.content?.rendered || "",
    link: p.link,
    featuredImage:
      media?.source_url ||
      p.jetpack_featured_media_url ||
      null,
    featuredCaption: stripHtml(media?.caption?.rendered || ""),
    featuredAlt: media?.alt_text || "",
    author: {
      id: author?.id,
      name: author?.name || "กองบรรณาธิการ",
      avatar: author?.avatar_urls?.["96"] || author?.avatar_urls?.["48"],
      description: stripHtml(author?.description || ""),
    },
    categories: cats,
    tags,
    reading: estimateReading(p.content?.rendered || ""),
    yoast: p.yoast_head_json || null,
  };
}

function estimateReading(html) {
  const text = stripHtml(html);
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
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
