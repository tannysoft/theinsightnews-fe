// Canonical site config — edit here to change globally
export const SITE = {
  name: "The Insight News",
  shortName: "Insight News",
  url: "https://theinsightnews.co",
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
