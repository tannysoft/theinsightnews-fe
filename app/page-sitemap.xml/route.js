import { SITE } from "@/lib/site";
import { buildUrlset, XML_RESPONSE_HEADERS } from "@/lib/sitemap-xml";

export const revalidate = 1800; // 30 min

const STATIC_PAGES = [
  { path: "/", priority: 1.0, changefreq: "hourly" },
  { path: "/insight-analysis", priority: 0.9, changefreq: "daily" },
  { path: "/special-reports", priority: 0.9, changefreq: "daily" },
  { path: "/opinion", priority: 0.9, changefreq: "daily" },
  { path: "/about", priority: 0.6, changefreq: "monthly" },
  { path: "/membership", priority: 0.7, changefreq: "monthly" },
  { path: "/privacy", priority: 0.3, changefreq: "yearly" },
];

export async function GET() {
  const now = new Date();
  const entries = STATIC_PAGES.map((p) => ({
    loc: `${SITE.url}${p.path}`,
    lastmod: now,
    changefreq: p.changefreq,
    priority: p.priority,
  }));
  return new Response(buildUrlset(entries), { headers: XML_RESPONSE_HEADERS });
}
