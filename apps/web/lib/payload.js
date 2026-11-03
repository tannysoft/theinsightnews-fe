/**
 * Payload CMS data source (CMS_SOURCE=payload).
 *
 * lib/api.js talks to WordPress through two REST surfaces — core `wp/v2` and
 * the Headless Helpers plugin's `tin/v1`. This module answers the same
 * requests (same paths, same query params, same response shapes and total
 * counts) from the Payload REST API, so pages, feeds and sitemaps run
 * unchanged on either CMS and switching back is one variable.
 *
 * Only the requests the site actually makes are supported; anything else
 * returns an empty list. Every fetch is tagged so the CMS can revalidate it
 * (apps/cms/src/hooks/revalidate.ts → app/api/revalidate).
 */
import { stringify } from "qs-esm";
import { IMAGE_SIZES, RESIZABLE, sizeKey } from "@theinsightnews/shared/image-sizes";
import { SITE, absUrl } from "@/lib/site";

export const CMS_URL = (process.env.CMS_URL || "http://localhost:3001").replace(/\/+$/, "");
const MEDIA_URL = (process.env.MEDIA_URL || "").replace(/\/+$/, "");

const EDITORIAL = "กองบรรณาธิการ";

/* ------------------------------------------------------------ transport */

async function cms(path, query, { tags, revalidate }) {
  const qs = stringify(query, { addQueryPrefix: true, encode: true });
  const res = await fetch(`${CMS_URL}/api${path}${qs}`, { next: { revalidate, tags } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CMS ${res.status}: ${path}`);
  return res.json();
}

/* --------------------------------------------------------------- helpers */

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * WordPress's form of a slug: percent-encoded, lowercase hex
 * ("politic-%e0%b8%81…"). The CMS stores the readable form; URLs, sitemaps
 * and links keep exactly what WordPress published.
 */
export function wpSlug(slug) {
  if (!slug) return "";
  return encodeURIComponent(safeDecode(String(slug))).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
}

const obj = (v) => (v && typeof v === "object" ? v : null);
const idOf = (v) => (typeof v === "number" ? v : v?.id ?? 0);
const ints = (v) =>
  String(v ?? "")
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);

/** WordPress `date` is Bangkok wall time without a zone; `date_gmt` is UTC without a zone. */
const bangkok = (iso) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 19);
const utc = (iso) => new Date(iso).toISOString().slice(0, 19);

function pick(item, fields) {
  if (!fields) return item;
  const out = {};
  for (const f of fields) if (f in item) out[f] = item[f];
  return out;
}

/**
 * "Now" rounded *up* to 5 minutes: keeps fetch URLs cacheable while a story
 * published a moment ago shows up right away (the CMS revalidates on
 * publish). Scheduled stories may appear up to 5 minutes early.
 */
function publishedNow() {
  const t = Math.ceil(Date.now() / 300_000) * 300_000;
  return { publishedAt: { less_than_equal: new Date(t).toISOString() } };
}

/* ----------------------------------------------------------------- media */

function fileUrl(key) {
  if (MEDIA_URL) return `${MEDIA_URL}/${key}`;
  const parts = key.split("/");
  const filename = parts.pop();
  return `${CMS_URL}/api/media/file/${filename}?prefix=${encodeURIComponent(safeDecode(parts.join("/")))}`;
}

const abs = (url) => (!url ? "" : url.startsWith("http") ? url : `${CMS_URL}${url}`);

/**
 * WordPress size names the components ask for (lib/api.js pickImage) → the
 * CMS's WebP copies. `full` is always the original. Until the copies exist
 * (`sizes` is null) only `full` is offered, so nothing points at a missing file.
 */
const WP_SIZE_FOR = { thumbnail: "thumbnail", medium: "thumbnail", medium_large: "medium", large: "large" };

function featured(m) {
  if (!m) return null;
  const url = abs(m.url);
  const sizes = { full: { url, width: m.width ?? null, height: m.height ?? null } };
  for (const [wpName, cmsName] of Object.entries(WP_SIZE_FOR)) {
    const c = m.sizes?.[cmsName];
    if (c?.url) sizes[wpName] = { url: abs(c.url), width: c.width, height: c.height };
  }
  return { id: m.id, url, width: m.width ?? null, height: m.height ?? null, alt: m.alt || "", caption: m.caption || "", sizes };
}

/**
 * The CMS stores library images in the body as `media:{key}` with a
 * `wp-image-{id}` class. Resolve them to the media domain; when that item's
 * WebP copies exist (`sizesReady`) they become a <picture> source, with the
 * original JPG/PNG as the <img> fallback. Items without copies get the
 * original only — an `onerror` fallback wouldn't survive html-react-parser.
 */
function resolveContentImages(html, media = new Map()) {
  if (!html) return "";
  return html.replace(/<img\b[^>]*>/gi, (img) => {
    const src = img.match(/\ssrc=(["'])(.*?)\1/i)?.[2];
    if (!src?.startsWith("media:")) return img;
    const key = src.slice(6);
    const original = fileUrl(key);
    const mime = /\.png$/i.test(key) ? "image/png" : /\.jpe?g$/i.test(key) ? "image/jpeg" : /\.webp$/i.test(key) ? "image/webp" : "";
    const tag = img.replace(src, original).replace(/<img\b/i, '<img loading="lazy" decoding="async"');
    const id = Number(img.match(/wp-image-(\d+)/)?.[1]);
    if (!RESIZABLE.test(mime) || !media.get(id)?.sizesReady) return tag;
    const srcset = Object.values(IMAGE_SIZES)
      .map((w) => `${fileUrl(sizeKey(key, w))} ${w}w`)
      .join(", ");
    return `<picture><source type="image/webp" srcset="${srcset}" sizes="(max-width: 800px) 100vw, 760px" />${tag}</picture>`;
  });
}

/** Every image a post references, featured first (image sitemaps). */
function postImages(p) {
  const urls = [];
  const f = obj(p.featuredImage);
  if (f?.url) urls.push(abs(f.url));
  for (const m of (p.contentHtml || "").matchAll(/\ssrc=(["'])media:(.*?)\1/gi)) urls.push(fileUrl(m[2]));
  return [...new Set(urls)];
}

/* ------------------------------------------------------------------ SEO */

const SUFFIX = ` : ${SITE.name}`;

function robotsOf(meta) {
  return {
    index: meta?.noindex ? "noindex" : "index",
    follow: meta?.nofollow ? "nofollow" : "follow",
    "max-snippet": "max-snippet:-1",
    "max-image-preview": "max-image-preview:large",
    "max-video-preview": "max-video-preview:-1",
  };
}

const ORG_ID = `${SITE.url}/#organization`;
const WEBSITE_ID = `${SITE.url}/#website`;

function siteNodes() {
  return [
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: `${SITE.url}/`,
      name: SITE.name,
      description: SITE.tagline,
      publisher: { "@id": ORG_ID },
      potentialAction: [
        {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` },
          "query-input": { "@type": "PropertyValueSpecification", valueRequired: true, valueName: "search_term_string" },
        },
      ],
      inLanguage: "th",
    },
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: SITE.name,
      url: `${SITE.url}/`,
      logo: { "@type": "ImageObject", "@id": `${SITE.url}/#/schema/logo/image/`, url: absUrl(SITE.logo), caption: SITE.name },
      image: { "@id": `${SITE.url}/#/schema/logo/image/` },
      sameAs: SITE.socialProfiles,
    },
  ];
}

const personId = (u) => `${SITE.url}/#/schema/person/${u.id}`;

function breadcrumb(url, items) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [{ name: "Home", item: `${SITE.url}/` }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.item ? { item: it.item } : {}),
    })),
  };
}

/** The `yoast` object of a post, as Yoast would have produced it from the CMS fields. */
function postYoast(p, out) {
  const meta = p.meta || {};
  // Only a visible byline becomes a Person node (see toTinPost).
  const url = meta.canonical || `${SITE.url}/${out.slug}`;
  const title = `${meta.title || out.title}${SUFFIX}`;
  const description = meta.description || out.excerpt || undefined;
  const ogImage = obj(meta.image) || obj(p.featuredImage);
  const image = ogImage?.url
    ? [{ url: abs(ogImage.url), width: ogImage.width, height: ogImage.height, type: ogImage.mimeType || undefined }]
    : undefined;
  const published = `${out.date_gmt}+00:00`;
  const modified = `${out.modified_gmt}+00:00`;
  const author = out.author.slug ? obj(p.author) : null;
  const primary = out.categories[0];

  const graph = [
    {
      "@type": "NewsArticle",
      "@id": `${url}#article`,
      isPartOf: { "@id": url },
      ...(author ? { author: { name: out.author.name, "@id": personId(author) } } : {}),
      headline: out.title,
      datePublished: published,
      dateModified: modified,
      mainEntityOfPage: { "@id": url },
      wordCount: Math.round((out.reading || 1) * 220),
      publisher: { "@id": ORG_ID },
      ...(image ? { image: { "@id": `${url}#primaryimage` }, thumbnailUrl: image[0].url } : {}),
      keywords: out.tags.map((t) => t.name),
      articleSection: out.categories.map((c) => c.name),
      inLanguage: "th",
    },
    {
      "@type": "WebPage",
      "@id": url,
      url,
      name: title,
      isPartOf: { "@id": WEBSITE_ID },
      ...(image ? { primaryImageOfPage: { "@id": `${url}#primaryimage` }, image: { "@id": `${url}#primaryimage` }, thumbnailUrl: image[0].url } : {}),
      datePublished: published,
      dateModified: modified,
      ...(description ? { description } : {}),
      breadcrumb: { "@id": `${url}#breadcrumb` },
      inLanguage: "th",
      potentialAction: [{ "@type": "ReadAction", target: [url] }],
    },
    ...(image
      ? [{ "@type": "ImageObject", inLanguage: "th", "@id": `${url}#primaryimage`, url: image[0].url, contentUrl: image[0].url, width: image[0].width, height: image[0].height }]
      : []),
    breadcrumb(url, [
      ...(primary ? [{ name: primary.name, item: `${SITE.url}/category/${primary.slug}` }] : []),
      { name: out.title },
    ]),
    ...siteNodes(),
    ...(author
      ? [{ "@type": "Person", "@id": personId(author), name: out.author.name, url: `${SITE.url}/author/${out.author.slug}` }]
      : []),
  ];

  return {
    title,
    description,
    robots: robotsOf(meta),
    canonical: url,
    og_locale: SITE.locale,
    og_type: "article",
    og_title: title,
    og_description: description,
    og_url: url,
    og_site_name: SITE.name,
    article_publisher: SITE.socialProfiles?.[0],
    article_published_time: published,
    article_modified_time: modified,
    og_image: image,
    author: out.author.name,
    twitter_card: "summary_large_image",
    schema: { "@context": "https://schema.org", "@graph": graph },
  };
}

/** Archive pages (category / tag / author): what Yoast emitted for them. */
function archiveYoast({ path, title, meta, type = "CollectionPage", ogType = "article", extra = [] }) {
  const url = meta?.canonical || `${SITE.url}${path}`;
  const full = `${meta?.title || title}${SUFFIX}`;
  return {
    title: full,
    description: meta?.description || undefined,
    robots: robotsOf(meta),
    canonical: url,
    og_locale: SITE.locale,
    og_type: ogType,
    og_title: full,
    og_description: meta?.description || undefined,
    og_url: url,
    og_site_name: SITE.name,
    og_image: obj(meta?.image)?.url ? [{ url: abs(meta.image.url), width: meta.image.width, height: meta.image.height }] : undefined,
    twitter_card: "summary_large_image",
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": type, "@id": url, url, name: full, isPartOf: { "@id": WEBSITE_ID }, breadcrumb: { "@id": `${url}#breadcrumb` }, inLanguage: "th" },
        breadcrumb(url, [{ name: title }]),
        ...siteNodes(),
        ...extra,
      ],
    },
  };
}

/* ------------------------------------------------------------ relations */

/**
 * Related documents are looked up here, in batches, rather than with
 * Payload's `depth`/`populate`: those gather every related id of a page into
 * one `IN (…)` query, and 100 stories can carry 600 tags — far past D1's
 * 100 bound parameters per query.
 */
const BATCH = 80;
const MEDIA_SELECT = { url: true, filename: true, prefix: true, mimeType: true, alt: true, caption: true, width: true, height: true, sizes: true, sizesReady: true };

async function byIds(collection, ids, select, { tags, revalidate }) {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const out = new Map();
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH).sort((a, b) => a - b);
    const res = await cms(
      `/${collection}`,
      { where: { id: { in: chunk } }, limit: chunk.length, depth: 0, select, pagination: false },
      { tags, revalidate }
    );
    for (const d of res?.docs ?? []) out.set(d.id, d);
  }
  return out;
}

/** Every category / author: few enough to read whole (and cache for an hour). */
async function allOf(collection, select, tags) {
  const res = await cms(`/${collection}`, { limit: 500, depth: 0, select, pagination: false }, { tags, revalidate: 3600 });
  return new Map((res?.docs ?? []).map((d) => [d.id, d]));
}

const contentMediaIds = (html) => [...(html || "").matchAll(/wp-image-(\d+)/g)].map((m) => Number(m[1]));

/** Fill in categories, tags, author and images of depth-0 posts. */
async function hydrate(docs, { withTags = true, revalidate = 300 } = {}) {
  if (!docs.length) return { docs, contentMedia: new Map() };
  const [cats, users] = await Promise.all([
    allOf("categories", { name: true, slug: true }, ["categories"]),
    allOf("users", { name: true, slug: true, bio: true, avatar: true, showByline: true }, ["users"]),
  ]);
  const mediaIds = docs.flatMap((d) => [
    idOf(d.featuredImage),
    idOf(d.meta?.image),
    idOf(users.get(idOf(d.author))?.avatar),
    ...contentMediaIds(d.contentHtml),
  ]);
  const [media, tags] = await Promise.all([
    byIds("media", mediaIds, MEDIA_SELECT, { tags: ["media"], revalidate: 3600 }),
    withTags ? byIds("tags", docs.flatMap((d) => (d.tags ?? []).map(idOf)), { name: true, slug: true }, { tags: ["tags", "posts"], revalidate }) : new Map(),
  ]);
  const out = docs.map((d) => {
    const author = users.get(idOf(d.author));
    return {
      ...d,
      featuredImage: media.get(idOf(d.featuredImage)) ?? null,
      meta: d.meta ? { ...d.meta, image: media.get(idOf(d.meta.image)) ?? null } : d.meta,
      author: author ? { ...author, avatar: media.get(idOf(author.avatar)) ?? null } : null,
      categories: (d.categories ?? []).map((c) => cats.get(idOf(c))).filter(Boolean),
      tags: (d.tags ?? []).map((t) => tags.get(idOf(t))).filter(Boolean),
    };
  });
  return { docs: out, contentMedia: media };
}

/* ---------------------------------------------------------------- posts */

const POPULATE = {
  media: { url: true, filename: true, prefix: true, mimeType: true, alt: true, caption: true, width: true, height: true, sizes: true, sizesReady: true },
  categories: { name: true, slug: true },
  tags: { name: true, slug: true },
  users: { name: true, slug: true, bio: true, avatar: true, showByline: true },
};

const LIST_SELECT = {
  title: true,
  slug: true,
  excerpt: true,
  featuredImage: true,
  categories: true,
  tags: true,
  author: true,
  publishedAt: true,
  updatedAt: true,
  sticky: true,
  readingMinutes: true,
};

/** WordPress sorts a post's terms by name; the page badge uses the first. */
const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/** Payload post → the `tin/v1` post shape (see lib/api.js normalizePost). */
function toTinPost(p, { full, contentMedia }) {
  const published = p.publishedAt ?? p.updatedAt;
  const author = obj(p.author);
  const avatar = obj(author?.avatar);
  const cats = (p.categories ?? []).map(obj).filter(Boolean).sort(byName);
  const tags = (p.tags ?? []).map(obj).filter(Boolean).sort(byName);
  const slug = wpSlug(p.slug || String(p.id));
  const item = {
    id: p.id,
    slug,
    link: `${SITE.url}/${slug}`,
    date: bangkok(published),
    date_gmt: utc(published),
    modified: bangkok(p.updatedAt),
    modified_gmt: utc(p.updatedAt),
    title: p.title || "",
    excerpt: p.excerpt || "",
    reading: p.readingMinutes || 1,
    sticky: Boolean(p.sticky),
    featured: featured(obj(p.featuredImage)),
    images: postImages(p),
    // Accounts not marked "show byline" are credited to the newsroom, with
    // nothing that identifies the person (their /author page doesn't exist).
    author:
      author && author.showByline !== false
        ? {
            id: author.id,
            name: author.name,
            slug: wpSlug(author.slug),
            avatar: avatar?.sizes?.thumbnail?.url ? abs(avatar.sizes.thumbnail.url) : avatar?.url ? abs(avatar.url) : null,
            description: author.bio || "",
          }
        : { id: 0, name: EDITORIAL, slug: null, avatar: null, description: "" },
    categories: cats.map((c) => ({ id: c.id, name: c.name, slug: wpSlug(c.slug) })),
    tags: tags.map((t) => ({ id: t.id, name: t.name, slug: wpSlug(t.slug) })),
  };
  if (full) {
    item.content = resolveContentImages(p.contentHtml, contentMedia);
    item.yoast = postYoast(p, item);
  }
  return item;
}

const SORT = { date: "publishedAt", modified: "updatedAt", id: "id", title: "title" };

/**
 * One page of posts for a WordPress-style query. REST has no `offset`, so
 * an offset reads the (at most two) pages of `per_page` that cover it —
 * never one big page: D1 caps a query filtered by a relation at 100 bound
 * parameters.
 */
async function queryPosts(params, { revalidate, needContent }) {
  const and = [publishedNow()];
  const cats = ints(params.get("categories"));
  const tagIds = ints(params.get("tags"));
  const exclude = ints(params.get("exclude"));
  const include = ints(params.get("include"));
  const author = ints(params.get("author"));
  if (cats.length) and.push({ categories: { in: cats } });
  if (tagIds.length) and.push({ tags: { in: tagIds } });
  if (exclude.length) and.push({ id: { not_in: exclude } });
  if (include.length) and.push({ id: { in: include } });
  if (author.length) and.push({ author: { in: author } });
  if (params.get("slug")) and.push({ slug: { equals: safeDecode(params.get("slug")) } });
  if (params.has("sticky")) and.push({ sticky: { equals: params.get("sticky") === "true" || params.get("sticky") === "1" } });
  const search = params.get("search")?.trim();
  if (search) and.push({ or: [{ title: { like: search } }, { excerpt: { like: search } }] });

  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page")) || 10));
  const orderby = params.get("orderby") || "date";
  const sort = orderby === "include" ? "-publishedAt" : `${params.get("order") === "asc" ? "" : "-"}${SORT[orderby] ?? "publishedAt"}`;
  const tags = ["posts"];

  const fetchPage = (page) =>
    cms(
      "/posts",
      {
        where: { and },
        limit: perPage,
        page,
        sort,
        depth: 0,
        select: needContent ? { ...LIST_SELECT, contentHtml: true, meta: true } : LIST_SELECT,
      },
      { tags, revalidate }
    );

  const offset = Number(params.get("offset")) || 0;
  let first;
  let docs;
  if (offset) {
    const start = Math.floor(offset / perPage) + 1;
    const skip = offset % perPage;
    const pages = await Promise.all(skip ? [fetchPage(start), fetchPage(start + 1)] : [fetchPage(start)]);
    first = pages[0];
    docs = pages.flatMap((r) => r?.docs ?? []).slice(skip, skip + perPage);
  } else {
    first = await fetchPage(Number(params.get("page")) || 1);
    docs = first?.docs ?? [];
  }
  if (orderby === "include" && include.length) docs.sort((a, b) => include.indexOf(a.id) - include.indexOf(b.id));
  const total = first?.totalDocs ?? 0;
  return { docs, total, totalPages: Math.ceil(total / perPage) };
}

/* ----------------------------------------------------------- taxonomies */

/** Published-post count (no time filter, so the URL — and its cache — is stable). */
async function countPosts(where, revalidate = 3600) {
  const res = await cms(
    "/posts/count",
    { where: { and: [{ _status: { equals: "published" } }, where] } },
    { tags: ["posts"], revalidate }
  );
  return res?.totalDocs ?? 0;
}

const TERM_SORT = { id: "id", name: "name", slug: "slug" };

async function queryCategories(params, { revalidate }) {
  const slug = params.get("slug");
  const res = await cms(
    "/categories",
    {
      where: slug ? { slug: { equals: safeDecode(slug) } } : {},
      limit: 200,
      depth: 1,
      select: { name: true, slug: true, description: true, parent: true, noindex: true, meta: true },
      populate: { media: POPULATE.media },
    },
    { tags: ["categories"], revalidate: Math.max(revalidate, 3600) }
  );
  const docs = res?.docs ?? [];
  const counts = await Promise.all(docs.map((c) => countPosts({ categories: { in: [c.id] } })));
  let terms = docs.map((c, i) => {
    const s = wpSlug(c.slug);
    const meta = { ...(c.meta || {}), noindex: c.noindex || c.meta?.noindex };
    return {
      id: c.id,
      count: counts[i],
      description: c.description || "",
      link: `${SITE.url}/category/${s}`,
      name: c.name,
      slug: s,
      taxonomy: "category",
      parent: idOf(c.parent),
      yoast_head_json: archiveYoast({ path: `/category/${s}`, title: c.name, meta }),
    };
  });
  if (params.get("hide_empty") === "1" || params.get("hide_empty") === "true") terms = terms.filter((t) => t.count > 0);
  return sortAndPage(terms, params);
}

function sortAndPage(items, params, defaultOrderby = "name") {
  const orderby = params.get("orderby") || defaultOrderby;
  const dir = params.get("order") === "desc" ? -1 : 1;
  const key = orderby === "count" ? "count" : TERM_SORT[orderby] ?? "name";
  const sorted = [...items].sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * dir);
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page")) || 10));
  const page = Number(params.get("page")) || 1;
  return {
    data: sorted.slice((page - 1) * perPage, page * perPage),
    total: sorted.length,
    totalPages: Math.ceil(sorted.length / perPage),
  };
}

function toTag(t) {
  const s = wpSlug(t.slug);
  return {
    id: t.id,
    count: t.postCount ?? 0,
    description: t.description || "",
    link: `${SITE.url}/tag/${s}`,
    name: t.name,
    slug: s,
    taxonomy: "post_tag",
    yoast_head_json: archiveYoast({ path: `/tag/${s}`, title: `${t.name} Archives`, meta: t.meta }),
  };
}

async function queryTags(params, { revalidate }) {
  const slug = params.get("slug");
  const and = [];
  if (slug) and.push({ slug: { equals: safeDecode(slug) } });
  if (params.get("hide_empty") === "1" || params.get("hide_empty") === "true") and.push({ postCount: { greater_than: 0 } });
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page")) || 10));
  const orderby = params.get("orderby") || "name";
  const field = orderby === "count" ? "postCount" : TERM_SORT[orderby] ?? "name";
  const sort = `${params.get("order") === "desc" ? "-" : ""}${field}`;
  const res = await cms(
    "/tags",
    {
      where: and.length ? { and } : {},
      limit: perPage,
      page: Number(params.get("page")) || 1,
      // A stable tie-break so tags with equal counts don't hop between pages.
      sort: field === "id" ? sort : `${sort},id`,
      depth: 1,
      select: { name: true, slug: true, description: true, postCount: true, meta: true },
      populate: { media: POPULATE.media },
    },
    // `posts` too: publishing a story changes tag counts.
    { tags: slug ? ["tags", "posts", `tag-${safeDecode(slug)}`] : ["tags", "posts"], revalidate: Math.max(revalidate, 600) }
  );
  return { data: (res?.docs ?? []).map(toTag), total: res?.totalDocs ?? 0, totalPages: res?.totalPages ?? 0 };
}

/* --------------------------------------------------------------- authors */

/**
 * Authors, as core REST lists them: only accounts with published posts.
 * Also the source of /author pages, so it never exposes email or role.
 */
async function queryUsers(params, { revalidate }) {
  const slug = params.get("slug");
  const res = await cms(
    "/users",
    {
      where: slug ? { slug: { equals: safeDecode(slug) } } : {},
      limit: 200,
      depth: 1,
      select: { name: true, slug: true, bio: true, avatar: true, showByline: true },
      populate: { media: POPULATE.media },
    },
    { tags: ["users"], revalidate: Math.max(revalidate, 3600) }
  );
  const docs = (res?.docs ?? []).filter((u) => u.showByline !== false);
  const counts = await Promise.all(docs.map((u) => countPosts({ author: { equals: u.id } })));
  const users = docs
    .map((u, i) => ({ u, n: counts[i] }))
    .filter(({ n }) => n > 0)
    .map(({ u }) => {
      const s = wpSlug(u.slug);
      const avatar = obj(u.avatar);
      const a96 = avatar?.sizes?.thumbnail?.url ? abs(avatar.sizes.thumbnail.url) : avatar?.url ? abs(avatar.url) : null;
      const url = `${SITE.url}/author/${s}`;
      return {
        id: u.id,
        name: u.name,
        slug: s,
        description: u.bio || "",
        avatar_urls: a96 ? { 24: a96, 48: a96, 96: a96 } : {},
        yoast_head_json: archiveYoast({
          path: `/author/${s}`,
          title: u.name,
          type: "ProfilePage",
          ogType: "profile",
          extra: [{ "@type": "Person", "@id": personId(u), name: u.name, url, ...(u.bio ? { description: u.bio } : {}) }],
        }),
      };
    });
  // Yoast's author title has no " : site" suffix.
  for (const u of users) {
    u.yoast_head_json.title = u.yoast_head_json.og_title = `${u.name}, Author at ${SITE.name}`;
  }
  return sortAndPage(users, params, "id");
}

/* -------------------------------------------------------------- redirects */

async function resolveSlug(params, { revalidate }) {
  const from = safeDecode(params.get("slug") || "");
  if (!from) return null;
  const res = await cms(
    "/redirects",
    { where: { from: { equals: from } }, limit: 1, depth: 1, populate: { posts: { slug: true } } },
    { tags: ["redirects", "posts"], revalidate }
  );
  const post = obj(res?.docs?.[0]?.post);
  return post?.slug ? { slug: wpSlug(post.slug) } : null;
}

/* ----------------------------------------------------------------- entry */

/**
 * Answer a WordPress REST request from Payload.
 *
 * @param {"wp" | "tin"} api  which namespace lib/api.js was calling
 * @param {string} path       e.g. "/posts?per_page=12&categories=3094"
 * @returns {Promise<{ data: any, total: number, totalPages: number }>}
 */
export async function payloadFetch(api, path, { revalidate = 300 } = {}) {
  const url = new URL(path, "http://wp.local");
  const resource = url.pathname.replace(/^\/+|\/+$/g, "");
  const params = url.searchParams;
  const fields = params.get("_fields")?.split(",").map((f) => f.trim()).filter(Boolean);

  try {
    if (resource === "posts") {
      const full = params.get("context") === "view";
      const needContent = full || Boolean(fields?.includes("images"));
      const { docs: raw, total, totalPages } = await queryPosts(params, { revalidate, needContent });
      // Sitemap/counter queries that ask only for ids, slugs and dates skip the lookups.
      const RELATED = ["featured", "images", "author", "categories", "tags", "content", "yoast"];
      const needRelated = !fields || fields.some((f) => RELATED.includes(f));
      const { docs, contentMedia } = needRelated
        ? await hydrate(raw, { withTags: !fields || fields.includes("tags") || full, revalidate })
        : { docs: raw, contentMedia: new Map() };
      const data = docs.map((d) => {
        const item = toTinPost(d, { full, contentMedia });
        // core REST shapes `author` as an id; nothing here reads more than that.
        if (api === "wp") item.author = item.author?.id ?? 0;
        return pick(item, fields);
      });
      return { data, total, totalPages };
    }
    if (resource === "categories") return withFields(await queryCategories(params, { revalidate }), fields);
    if (resource === "tags") return withFields(await queryTags(params, { revalidate }), fields);
    if (resource === "users") return withFields(await queryUsers(params, { revalidate }), fields);
    if (resource === "resolve-slug") {
      const data = await resolveSlug(params, { revalidate });
      return data ? { data, total: 1, totalPages: 1 } : { data: null, total: 0, totalPages: 0, error: 404 };
    }
  } catch (err) {
    console.error(`[payload] ${api}/${resource}: ${err.message}`);
    return { data: null, total: 0, totalPages: 0, error: 502 };
  }
  return { data: [], total: 0, totalPages: 0 };
}

function withFields(res, fields) {
  return { ...res, data: res.data.map((d) => pick(d, fields)) };
}

/* --------------------------------------------------------------- preview */

/**
 * Latest saved version of a story, drafts included, for the CMS "Preview"
 * button. Read with the API key of a CMS user and never cached.
 */
export async function findDraftPost({ id, slug }) {
  const key = process.env.CMS_PREVIEW_API_KEY;
  if (!key) return null;
  const where = id ? { id: { equals: Number(id) } } : { slug: { equals: safeDecode(slug || "") } };
  const qs = stringify({ where, draft: true, limit: 1, depth: 0 }, { addQueryPrefix: true, encode: true });
  const res = await fetch(`${CMS_URL}/api/posts${qs}`, {
    cache: "no-store",
    headers: { authorization: `users API-Key ${key}` },
  });
  if (!res.ok) return null;
  const doc = (await res.json())?.docs?.[0];
  if (!doc) return null;
  // Drafts reference published categories/tags/media, so the public lookups do.
  const { docs, contentMedia } = await hydrate([doc], { revalidate: 0 });
  return toTinPost(docs[0], { full: true, contentMedia });
}
