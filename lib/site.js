/**
 * The WordPress origin. Only ever contacted server-side — it must never
 * appear in anything the frontend serves; see lib/urls.js.
 * Overridable so the app can be pointed at a staging CMS or a local mock.
 */
export const CMS_ORIGIN = (
  process.env.WP_ORIGIN || "https://cms.theinsightnews.co"
).replace(/\/+$/, "");

/**
 * Pull-through CDN in front of the CMS. Serves the whole origin, so any
 * `/wp-content` or `/wp-includes` URL can be pointed here — unlike the public
 * site, which is the Next app and doesn't serve WordPress paths at all.
 */
export const CDN_ORIGIN = (
  process.env.WP_CDN_ORIGIN || "https://files.theinsightnews.co"
).replace(/\/+$/, "");

// Canonical site config — edit here to change globally
export const SITE = {
  name: "The Insight News",
  shortName: "Insight News",
  url: "https://www.theinsightnews.co",
  locale: "th_TH",
  tagline: "ศูนย์รวมข่าวสารเชิงลึก ที่ยึดมั่นในความจริง",
  // Keep under ~155 chars for search snippet truncation
  description:
    "The Insight News สำนักข่าวเชิงลึก วิเคราะห์เจาะประเด็น ด้วยความเป็นกลาง ยึดมั่นในความจริง เพื่อประโยชน์สูงสุดของสังคม",
  logo: "/logo.svg",
  logoLight: "/logo-light.svg",
  // Only used for the twitter: card meta tags. Yoast has no twitter_site /
  // twitter_creator configured, so there's nothing on the CMS to defer to.
  twitter: "@insightnewsth",
  facebook: "theinsighnewstth",
  /**
   * schema.org `sameAs` for the publisher. Mirrors the Organization sameAs
   * Yoast serves from the CMS, which is the source of truth for who this
   * publisher is — the frontend must not claim profiles the CMS doesn't.
   * Keep in sync with WP Admin → Yoast SEO → Settings → Site representation.
   */
  socialProfiles: ["https://www.facebook.com/theinsighnewstth"],
  organizationType: "NewsMediaOrganization",
  founder: "The Insight News",
  foundingDate: "2022",
  defaultOgImage: "/logo.svg",
  gaId: "G-DN592YR28X",
};

export function absUrl(path = "") {
  if (!path) return SITE.url;
  if (path.startsWith("http")) return path;
  return `${SITE.url}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function cleanText(html = "", max = 160) {
  const t = html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/**
 * Serialize a value for safe embedding inside a <script type="application/ld+json"> tag.
 * Escapes `<` and `&` so a malicious title containing `</script>` or entity refs
 * can't break out of the script block or run HTML.
 */
export function safeJsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
