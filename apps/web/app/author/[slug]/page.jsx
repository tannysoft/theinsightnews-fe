import { notFound } from "next/navigation";
import { getAuthorBySlug, countPostsByAuthor } from "@/lib/api";
import { SITE } from "@/lib/site";
import { yoastToMetadata, yoastSchema } from "@/lib/yoast";
import ArchivePage from "@/components/ArchivePage";

export const revalidate = 300;

function fallbackMeta(author) {
  return {
    title: author.name,
    description:
      author.description || `บทความทั้งหมดโดย ${author.name} จาก ${SITE.name}`,
  };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return { title: "ผู้เขียน", robots: { index: false, follow: false } };

  const meta = yoastToMetadata(author.yoast, {
    canonicalPath: `/author/${author.slug}`,
    fallback: fallbackMeta(author),
  });
  // Yoast titles author archives "<name>, Author at <site>", and the layout's
  // title template appends the site name again on top of that.
  meta.title = author.name;
  return meta;
}

export default async function AuthorPage({ params }) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  // An account that has only ever published WP pages still resolves as an
  // author. An empty archive is nothing to index.
  if ((await countPostsByAuthor(author.id)) === 0) notFound();

  // Yoast's ProfilePage graph (ProfilePage + Person + breadcrumb), rewritten
  // onto our domain. Null when Yoast has author archives switched off.
  const schema = yoastSchema(author.yoast, `/author/${author.slug}`);

  return <ArchivePage kind="author" term={author} page={1} schema={schema} />;
}
