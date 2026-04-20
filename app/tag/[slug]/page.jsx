import Link from "next/link";
import { notFound } from "next/navigation";
import { getTagBySlug, getPopularTags, getPosts, decodeHtml } from "@/lib/api";
import { NewsCard, HeroCard, RowCard } from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";
import { SITE, absUrl } from "@/lib/site";
import { yoastToMetadata } from "@/lib/yoast";

export const revalidate = 300;

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp?.page || "1", 10));
  const tag = await getTagBySlug(slug);
  if (!tag) return { title: "Tag", robots: { index: false, follow: false } };
  const name = decodeHtml(tag.name);
  const canonicalPath = `/tag/${slug}${page > 1 ? `?page=${page}` : ""}`;
  const meta = yoastToMetadata(tag.yoast_head_json, {
    canonicalPath,
    fallback: {
      title: `#${name}`,
      description: decodeHtml(tag.description || `บทความที่แท็กด้วย ${name} จาก ${SITE.name}`),
    },
  });
  if (page > 1) meta.title = `#${name} — หน้า ${page}`;
  return meta;
}

export default async function TagPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp?.page || "1", 10));

  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const perPage = page === 1 ? 14 : 12;
  const offset = page === 1 ? undefined : 2;

  const [postsRes, relatedTags] = await Promise.all([
    getPosts({ tags: tag.id, perPage, page, offset }),
    getPopularTags({ perPage: 24 }),
  ]);

  const { posts, totalPages } = postsRes;
  if (posts.length === 0 && page > 1) notFound();

  const [hero, ...rest] = posts;
  const top = rest.slice(0, 4);
  const grid = rest.slice(4);

  const tagUrl = absUrl(`/tag/${slug}`);
  const tagName = decodeHtml(tag.name);
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `#${tagName}`,
    url: page > 1 ? `${tagUrl}?page=${page}` : tagUrl,
    numberOfItems: posts.length,
    itemListElement: posts.map((p, i) => ({
      "@type": "ListItem",
      position: (page - 1) * 12 + i + 1,
      url: absUrl(`/post/${p.slug}`),
      name: p.title,
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      { "@type": "ListItem", position: 2, name: `#${tagName}`, item: tagUrl },
    ],
  };
  const prevUrl =
    page > 1 ? (page === 2 ? tagUrl : `${tagUrl}?page=${page - 1}`) : null;
  const nextUrl = page < totalPages ? `${tagUrl}?page=${page + 1}` : null;

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {prevUrl && <link rel="prev" href={prevUrl} />}
      {nextUrl && <link rel="next" href={nextUrl} />}
      {/* Hero / header */}
      <section className="relative overflow-hidden border-b border-black/5 bg-ink text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="container-news relative py-14 md:py-20">
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
            <Link href="/" className="hover:text-brand-400">Home</Link>
            <span>·</span>
            <span>Tag</span>
          </div>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-brand headline text-5xl md:text-7xl">#</span>
            <h1 className="headline text-4xl text-white md:text-6xl">
              {decodeHtml(tag.name)}
            </h1>
          </div>
          {tag.description && (
            <p className="mt-4 max-w-2xl text-base text-white/75 md:text-lg">
              {decodeHtml(tag.description)}
            </p>
          )}
          <div className="mt-6 flex items-center gap-4 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
              <strong className="text-white">{tag.count}</strong> บทความ
            </span>
            {totalPages > 1 && (
              <>
                <span>·</span>
                <span>หน้า {page} จาก {totalPages}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {posts.length === 0 ? (
        <section className="container-news py-20 text-center">
          <p className="text-ink-muted">ยังไม่มีบทความในแท็กนี้</p>
          <Link href="/" className="mt-6 inline-flex rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">
            กลับหน้าแรก
          </Link>
        </section>
      ) : (
        <>
          {/* Hero row */}
          {page === 1 && hero && (
            <section className="container-news pt-10">
              <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <HeroCard post={hero} />
                <aside className="flex flex-col gap-5 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                  <h3 className="section-title">อ่านต่อ #{decodeHtml(tag.name)}</h3>
                  <div className="divide-y divide-black/5">
                    {top.map((p, i) => (
                      <div key={p.id} className="py-5 first:pt-0 last:pb-0">
                        <RowCard post={p} index={i + 1} />
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </section>
          )}

          {/* Grid */}
          <section className="container-news mt-14">
            {page === 1 && (
              <SectionHeader eyebrow="More" title="ทั้งหมดในแท็กนี้" />
            )}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {(page === 1 ? grid : posts).map((p) => (
                <NewsCard key={p.id} post={p} size="md" />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/tag/${slug}?page=${page - 1}`}
                    className="rounded-md border border-black/10 px-4 py-2 text-sm hover:border-brand hover:text-brand"
                  >
                    ← ก่อนหน้า
                  </Link>
                )}
                <span className="px-4 py-2 text-sm text-ink-muted">
                  หน้า {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/tag/${slug}?page=${page + 1}`}
                    className="rounded-md border border-black/10 px-4 py-2 text-sm hover:border-brand hover:text-brand"
                  >
                    ถัดไป →
                  </Link>
                )}
              </nav>
            )}
          </section>
        </>
      )}

      {/* Related tags cloud */}
      {relatedTags.length > 0 && (
        <section className="border-t border-black/5 bg-paper-warm py-14 mt-16">
          <div className="container-news">
            <div className="mb-6 flex items-end justify-between border-b-2 border-ink pb-3">
              <div>
                <span className="eyebrow">Tag Cloud</span>
                <h2 className="headline mt-1 text-2xl md:text-3xl">
                  สำรวจแท็กอื่นๆ
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {relatedTags.map((t) => {
                const isActive = t.slug === slug;
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
      )}
    </div>
  );
}
