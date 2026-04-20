import Link from "next/link";
import { notFound } from "next/navigation";
import { getTagBySlug, getPopularTags, decodeHtml } from "@/lib/api";
import { SITE } from "@/lib/site";
import { yoastToMetadata } from "@/lib/yoast";
import ArchivePage from "@/components/ArchivePage";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return { title: "Tag", robots: { index: false, follow: false } };
  const name = decodeHtml(tag.name);
  return yoastToMetadata(tag.yoast_head_json, {
    canonicalPath: `/tag/${slug}`,
    fallback: {
      title: `#${name}`,
      description: decodeHtml(
        tag.description || `บทความที่แท็กด้วย ${name} จาก ${SITE.name}`
      ),
    },
  });
}

export default async function TagIndexPage({ params }) {
  const { slug } = await params;
  const [tag, relatedTags] = await Promise.all([
    getTagBySlug(slug),
    getPopularTags({ perPage: 24 }),
  ]);
  if (!tag) notFound();

  return (
    <ArchivePage
      kind="tag"
      term={tag}
      page={1}
      extra={<TagCloudSection currentSlug={slug} tags={relatedTags} />}
    />
  );
}

function TagCloudSection({ currentSlug, tags }) {
  if (!tags?.length) return null;
  return (
    <section className="mt-16 border-t border-black/5 bg-paper-warm py-14">
      <div className="container-news">
        <div className="mb-6 flex items-end justify-between border-b-2 border-ink pb-3">
          <div>
            <span className="eyebrow">Tag Cloud</span>
            <h2 className="headline mt-1 text-2xl md:text-3xl">สำรวจแท็กอื่นๆ</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const isActive = t.slug === currentSlug;
            return (
              <Link
                key={t.id}
                href={`/tag/${t.slug}`}
                className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  isActive
                    ? "border-transparent bg-brand text-white"
                    : "border-black/10 bg-white text-ink hover:border-brand hover:text-brand"
                }`}
              >
                <span
                  className={`text-[11px] font-bold ${
                    isActive ? "text-white/80" : "text-brand/60"
                  }`}
                >
                  #
                </span>
                {decodeHtml(t.name)}
                <span
                  className={`text-[11px] tabular-nums ${
                    isActive ? "text-white/70" : "text-ink-muted"
                  }`}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
