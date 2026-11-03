// The feed behind /category/<slug>/feed and /tag/<slug>/feed, in every
// flavour WordPress served them.
//
// WP gives each archive the same feed at three URLs — `/feed` (RSS 2.0),
// `/feed/rss2` and `/feed/atom` — and subscribers are holding whichever one
// their reader picked up years ago. One builder serves all of them so the
// two archive kinds can't drift apart the way the two route files were
// already starting to.
import { getCategoryBySlug, getTagBySlug, getPosts, decodeHtml, stripHtml } from "@/lib/api";
import { SITE } from "@/lib/site";
import {
  buildRss,
  buildAtom,
  feedItemsFromPosts,
  feedHeaders,
  FEED_ITEM_LIMIT,
} from "@/lib/feed-xml";

/** Formats reachable as `/…/feed/<format>`. `/feed` on its own is rss2. */
export const FEED_FORMATS = ["rss2", "atom"];

export function isFeedFormat(format) {
  return FEED_FORMATS.includes(format);
}

const KINDS = {
  category: {
    lookup: getCategoryBySlug,
    basePath: (slug) => `/category/${slug}`,
    title: (name) => `${name} · ${SITE.name}`,
    fallbackDescription: (name) => `รวมบทความในหมวด ${name} จาก ${SITE.name}`,
    query: (term) => ({ categories: term.id }),
  },
  tag: {
    lookup: getTagBySlug,
    basePath: (slug) => `/tag/${slug}`,
    title: (name) => `#${name} · ${SITE.name}`,
    fallbackDescription: (name) => `บทความที่แท็กด้วย ${name} จาก ${SITE.name}`,
    query: (term) => ({ tags: term.id }),
  },
};

/**
 * @param {"category"|"tag"} kind
 * @param {string} slug
 * @param {"rss2"|"atom"} format
 * @returns {Promise<Response>} 404 when the term doesn't exist — better than
 *   inventing a feed for a URL that isn't an archive.
 */
export async function archiveFeedResponse(kind, slug, format = "rss2") {
  const spec = KINDS[kind];
  if (!spec || !isFeedFormat(format)) {
    return new Response("Not found", { status: 404 });
  }

  const term = await spec.lookup(slug);
  if (!term) return new Response("Not found", { status: 404 });

  const name = decodeHtml(term.name || slug);
  let posts = [];
  try {
    ({ posts } = await getPosts({
      ...spec.query(term),
      perPage: FEED_ITEM_LIMIT,
      full: true,
    }));
  } catch {
    // A feed that lost its items is still a valid feed; a 500 loses the
    // subscriber.
    posts = [];
  }

  const base = spec.basePath(slug);
  const payload = {
    title: spec.title(name),
    description: stripHtml(term.description || "") || spec.fallbackDescription(name),
    path: base,
    // Self-link points at the URL actually requested, as WordPress does.
    feedPath: format === "rss2" ? `${base}/feed` : `${base}/feed/${format}`,
    items: feedItemsFromPosts(posts),
  };

  const xml = format === "atom" ? buildAtom(payload) : buildRss(payload);
  return new Response(xml, { headers: feedHeaders(format === "atom" ? "atom" : "rss") });
}
