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
  twitter: "@insightnewsth",
  facebook: "theinsightnews",
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
