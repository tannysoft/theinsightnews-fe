import { notFound } from "next/navigation";
import { getAuthorBySlug, countPostsByAuthor } from "@/lib/api";
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
  if (!page) return { title: "ผู้เขียน", robots: { index: false, follow: false } };

  const author = await getAuthorBySlug(slug);
  if (!author) return { title: "ผู้เขียน", robots: { index: false, follow: false } };

  const meta = yoastToMetadata(author.yoast, {
    canonicalPath: `/author/${author.slug}/page/${page}`,
    fallback: {
      title: `${author.name} — หน้า ${page}`,
      description:
        author.description || `บทความทั้งหมดโดย ${author.name} จาก ${SITE.name}`,
    },
  });
  meta.title = `${author.name} — หน้า ${page}`;
  return meta;
}

export default async function AuthorPaginatedPage({ params }) {
  const { slug, page: rawPage } = await params;
  const page = parsePage(rawPage);
  if (!page) notFound();

  const author = await getAuthorBySlug(slug);
  if (!author) notFound();
  if ((await countPostsByAuthor(author.id)) === 0) notFound();

  // Page 2+ carries no ProfilePage schema: the profile itself lives on page 1,
  // and repeating the graph would claim several canonical pages for one Person.
  return <ArchivePage kind="author" term={author} page={page} />;
}
