// Keeps the WordPress origin out of everything the frontend serves.
//
// WordPress builds absolute URLs from its own home_url(), so anything that
// originates there — Yoast's JSON-LD graph (@id, breadcrumb items, search
// action targets, author URLs), links inside post content, permalinks —
// arrives pointing at the CMS host. Those must be rewritten to the public
// site before they reach a page, an RSS item or a sitemap.
import { SITE, CMS_ORIGIN, CDN_ORIGIN } from "@/lib/site";

// Hosts that must never appear in frontend output.
//
// The production CMS host is listed literally as well as via CMS_ORIGIN:
// absolute cms.* links are baked into post content in the database, so they
// have to be scrubbed even when the app is pointed at a staging origin or a
// local mock. The bare apex is included because it's where the site used to
// live.
const FOREIGN_ORIGINS = [
  CMS_ORIGIN,
  CMS_ORIGIN.replace(/^https:/, "http:"),
  "https://cms.theinsightnews.co",
  "http://cms.theinsightnews.co",
  "https://theinsightnews.co",
  "http://theinsightnews.co",
];

/**
 * Paths WordPress serves as static files. Rewriting these onto the public
 * site would 404 — the Next app doesn't serve /wp-content — so they go to the
 * CDN instead, which proxies the same origin.
 */
const ASSET_PREFIXES = ["/wp-content", "/wp-includes"];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Match a foreign origin plus whatever path follows, stopping at characters
// that can't appear in a URL inside JSON, HTML attributes or prose.
const FOREIGN_URL_RE = new RegExp(
  `(?:${[...new Set(FOREIGN_ORIGINS)].map(escapeRegExp).join("|")})` +
    `(\\/[^\\s"'<>)\\]}\\\\]*)?`,
  "g"
);

function mapPath(path) {
  if (!path) return SITE.url;
  return ASSET_PREFIXES.some((p) => path.startsWith(p))
    ? CDN_ORIGIN + path
    : SITE.url + path;
}

/**
 * Rewrite every CMS/legacy URL in a string to its public equivalent.
 * Safe on arbitrary text — HTML, JSON values, plain prose.
 */
export function scrubCmsUrls(value) {
  if (typeof value !== "string" || value === "") return value;
  return value.replace(FOREIGN_URL_RE, (_match, path) => mapPath(path || ""));
}

/** Same, applied to every string inside an arbitrarily nested structure. */
export function scrubDeep(data) {
  if (typeof data === "string") return scrubCmsUrls(data);
  if (Array.isArray(data)) return data.map(scrubDeep);
  if (data && typeof data === "object") {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = scrubDeep(v);
    return out;
  }
  return data;
}
