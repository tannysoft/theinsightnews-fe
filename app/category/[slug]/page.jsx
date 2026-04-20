import { notFound } from "next/navigation";
import { getCategoryBySlug, decodeHtml } from "@/lib/api";
import { SITE } from "@/lib/site";
import { yoastToMetadata } from "@/lib/yoast";
import ArchivePage from "@/components/ArchivePage";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "หมวดหมู่", robots: { index: false, follow: false } };
  const name = decodeHtml(cat.name);
  return yoastToMetadata(cat.yoast_head_json, {
    canonicalPath: `/category/${slug}`,
    fallback: {
      title: name,
      description: decodeHtml(
        cat.description || `รวมบทความในหมวด ${name} จาก ${SITE.name}`
      ),
    },
  });
}

export default async function CategoryIndexPage({ params }) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();
  return <ArchivePage kind="category" term={cat} page={1} />;
}
