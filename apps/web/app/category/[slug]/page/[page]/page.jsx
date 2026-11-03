import { notFound } from "next/navigation";
import { getCategoryBySlug, decodeHtml } from "@/lib/api";
import { SITE } from "@/lib/site";
import { yoastToMetadata } from "@/lib/yoast";
import ArchivePage from "@/components/ArchivePage";

export const revalidate = 300;

function parsePage(raw) {
  const n = parseInt(raw || "", 10);
  if (!Number.isFinite(n) || n < 2) return null;
  return n;
}

export async function generateMetadata({ params }) {
  const { slug, page: rawPage } = await params;
  const page = parsePage(rawPage);
  if (!page) return { title: "หมวดหมู่", robots: { index: false, follow: false } };

  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "หมวดหมู่", robots: { index: false, follow: false } };

  const name = decodeHtml(cat.name);
  const meta = yoastToMetadata(cat.yoast_head_json, {
    canonicalPath: `/category/${slug}/page/${page}`,
    fallback: {
      title: `${name} — หน้า ${page}`,
      description: decodeHtml(
        cat.description || `รวมบทความในหมวด ${name} จาก ${SITE.name}`
      ),
    },
  });
  meta.title = `${name} — หน้า ${page}`;
  return meta;
}

export default async function CategoryPaginatedPage({ params }) {
  const { slug, page: rawPage } = await params;
  const page = parsePage(rawPage);
  if (!page) notFound();

  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  return <ArchivePage kind="category" term={cat} page={page} />;
}
