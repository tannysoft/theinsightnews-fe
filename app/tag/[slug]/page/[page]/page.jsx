import { notFound } from "next/navigation";
import { getTagBySlug, decodeHtml } from "@/lib/api";
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
  if (!page) return { title: "Tag", robots: { index: false, follow: false } };

  const tag = await getTagBySlug(slug);
  if (!tag) return { title: "Tag", robots: { index: false, follow: false } };

  const name = decodeHtml(tag.name);
  const meta = yoastToMetadata(tag.yoast_head_json, {
    canonicalPath: `/tag/${slug}/page/${page}`,
    fallback: {
      title: `#${name} — หน้า ${page}`,
      description: decodeHtml(
        tag.description || `บทความที่แท็กด้วย ${name} จาก ${SITE.name}`
      ),
    },
  });
  meta.title = `#${name} — หน้า ${page}`;
  return meta;
}

export default async function TagPaginatedPage({ params }) {
  const { slug, page: rawPage } = await params;
  const page = parsePage(rawPage);
  if (!page) notFound();

  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  return <ArchivePage kind="tag" term={tag} page={page} />;
}
