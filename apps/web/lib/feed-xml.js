// RSS 2.0 / Atom 1.0 builders, shaped like the feeds WordPress serves so
// existing subscribers, readers and aggregators see no difference after the
// switch to the headless frontend.
import { SITE, absUrl } from "@/lib/site";
import { parseWpDate, pickImage } from "@/lib/api";

export const FEED_CACHE_SECONDS = 900; // 15 min
export const FEED_ITEM_LIMIT = 20;

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** CDATA that survives content containing a literal `]]>`. */
function cdata(s) {
  return `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** RFC-822 date, the format RSS <pubDate> requires. */
function rfc822(d) {
  const v = parseWpDate(d);
  return v ? v.toUTCString().replace("GMT", "+0000") : null;
}

/** RFC-3339 date for Atom. */
function rfc3339(d) {
  const v = parseWpDate(d);
  return v ? v.toISOString().replace(/\.\d{3}Z$/, "+00:00") : null;
}

/**
 * Normalised posts (from lib/api) → feed items.
 * Uses `*_gmt` timestamps so pubDate is unambiguous.
 */
export function feedItemsFromPosts(posts = []) {
  return posts.filter(Boolean).map((p) => ({
    id: p.id,
    title: p.title,
    link: `${SITE.url}/${p.slug}`,
    date: p.dateGmt || p.date,
    modified: p.modifiedGmt || p.modified || p.dateGmt || p.date,
    author: p.author?.name || SITE.name,
    categories: [
      ...(p.categories || []).map((c) => c.name),
      ...(p.tags || []).map((t) => t.name),
    ].filter(Boolean),
    summary: p.excerpt || "",
    content: p.content || "",
    image: pickImage(p, "large"),
  }));
}

function newestDate(items) {
  for (const it of items) {
    const d = parseWpDate(it.date);
    if (d) return d;
  }
  return new Date();
}

/**
 * @param {{ title: string, description: string, path: string,
 *           feedPath: string, items: ReturnType<typeof feedItemsFromPosts> }} opts
 */
export function buildRss({ title, description, path = "/", feedPath, items = [] }) {
  const link = absUrl(path);
  const self = absUrl(feedPath);

  const body = items
    .map((it) => {
      const parts = [
        `    <title>${cdata(it.title)}</title>`,
        `    <link>${xmlEscape(it.link)}</link>`,
        `    <dc:creator>${cdata(it.author)}</dc:creator>`,
      ];
      const pub = rfc822(it.date);
      if (pub) parts.push(`    <pubDate>${pub}</pubDate>`);
      for (const c of it.categories) {
        parts.push(`    <category>${cdata(c)}</category>`);
      }
      // Same GUID scheme WordPress uses — tied to the post ID, so a slug
      // change doesn't resurface the article as "new" in readers.
      parts.push(
        `    <guid isPermaLink="false">${xmlEscape(`${SITE.url}/?p=${it.id}`)}</guid>`
      );
      parts.push(`    <description>${cdata(it.summary)}</description>`);
      parts.push(`    <content:encoded>${cdata(it.content)}</content:encoded>`);
      if (it.image) {
        parts.push(
          `    <media:content url="${xmlEscape(it.image)}" medium="image" />`
        );
      }
      return `  <item>\n${parts.join("\n")}\n  </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
  xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${cdata(title)}</title>
  <atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml" />
  <link>${xmlEscape(link)}</link>
  <description>${cdata(description)}</description>
  <lastBuildDate>${newestDate(items).toUTCString().replace("GMT", "+0000")}</lastBuildDate>
  <language>th</language>
  <sy:updatePeriod>hourly</sy:updatePeriod>
  <sy:updateFrequency>1</sy:updateFrequency>
  <image>
    <url>${xmlEscape(absUrl(SITE.logo))}</url>
    <title>${cdata(SITE.name)}</title>
    <link>${xmlEscape(SITE.url)}</link>
  </image>
${body}
</channel>
</rss>`;
}

export function buildAtom({ title, description, path = "/", feedPath, items = [] }) {
  const link = absUrl(path);
  const self = absUrl(feedPath);

  const body = items
    .map((it) => {
      const parts = [
        `    <author><name>${xmlEscape(it.author)}</name></author>`,
        `    <title type="html">${cdata(it.title)}</title>`,
        `    <link rel="alternate" type="text/html" href="${xmlEscape(it.link)}" />`,
        `    <id>${xmlEscape(`${SITE.url}/?p=${it.id}`)}</id>`,
      ];
      const updated = rfc3339(it.modified);
      const published = rfc3339(it.date);
      if (updated) parts.push(`    <updated>${updated}</updated>`);
      if (published) parts.push(`    <published>${published}</published>`);
      for (const c of it.categories) {
        parts.push(`    <category term="${xmlEscape(c)}" />`);
      }
      parts.push(`    <summary type="html">${cdata(it.summary)}</summary>`);
      parts.push(
        `    <content type="html" xml:base="${xmlEscape(it.link)}">${cdata(it.content)}</content>`
      );
      return `  <entry>\n${parts.join("\n")}\n  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="th">
  <title type="text">${cdata(title)}</title>
  <subtitle type="text">${cdata(description)}</subtitle>
  <updated>${newestDate(items).toISOString().replace(/\.\d{3}Z$/, "+00:00")}</updated>
  <link rel="alternate" type="text/html" href="${xmlEscape(link)}" />
  <id>${xmlEscape(self)}</id>
  <link rel="self" type="application/atom+xml" href="${xmlEscape(self)}" />
  <generator uri="${xmlEscape(SITE.url)}">${cdata(SITE.name)}</generator>
${body}
</feed>`;
}

/**
 * An empty RSS channel. WordPress exposes comment feeds at `/comments/feed`
 * and `/<slug>/feed`; this site has no comments, but those URLs are known to
 * readers and crawlers, so serve a valid empty feed instead of a 404.
 */
export function buildEmptyCommentsFeed({ title, path, feedPath }) {
  return buildRss({
    title,
    description: `ความคิดเห็นสำหรับ ${title}`,
    path,
    feedPath,
    items: [],
  });
}

export function feedHeaders(kind = "rss") {
  const type = kind === "atom" ? "application/atom+xml" : "application/rss+xml";
  return {
    "Content-Type": `${type}; charset=utf-8`,
    "X-Robots-Tag": "noindex, follow",
    "Cache-Control": `public, max-age=0, s-maxage=${FEED_CACHE_SECONDS}, stale-while-revalidate=86400`,
  };
}
