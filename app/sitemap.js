import { SITE } from "@/lib/site";
import { getPosts, getCategories, getPopularTags } from "@/lib/api";

export const revalidate = 3600;

const STATIC = [
  { path: "/", priority: 1.0, changeFrequency: "hourly" },
  { path: "/insight-analysis", priority: 0.9, changeFrequency: "daily" },
  { path: "/special-reports", priority: 0.9, changeFrequency: "daily" },
  { path: "/opinion", priority: 0.9, changeFrequency: "daily" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/membership", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap() {
  const now = new Date();

  // Fetch most recent posts across the site (max 200)
  let posts = [];
  try {
    const results = await Promise.all([
      getPosts({ perPage: 100, page: 1 }),
      getPosts({ perPage: 100, page: 2 }),
    ]);
    posts = results.flatMap((r) => r.posts || []);
  } catch {
    posts = [];
  }

  let categories = [];
  try {
    categories = await getCategories();
  } catch {
    categories = [];
  }

  let tags = [];
  try {
    tags = await getPopularTags({ perPage: 50 });
  } catch {
    tags = [];
  }

  const staticEntries = STATIC.map((s) => ({
    url: `${SITE.url}${s.path}`,
    lastModified: now,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  const postEntries = posts.map((p) => ({
    url: `${SITE.url}/${p.slug}`,
    lastModified: new Date(p.modified || p.date),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryEntries = categories.map((c) => ({
    url: `${SITE.url}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const tagEntries = tags.map((t) => ({
    url: `${SITE.url}/tag/${t.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...postEntries, ...categoryEntries, ...tagEntries];
}
