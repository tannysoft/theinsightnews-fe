import Link from "next/link";
import { notFound } from "next/navigation";
import { getPosts, decodeHtml } from "@/lib/api";
import { NewsCard, HeroCard, RowCard } from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";
import { SITE, absUrl } from "@/lib/site";

/**
 * Shared archive body used by:
 *   /category/[slug]               -> page 1
 *   /category/[slug]/page/[page]   -> page N (N >= 2)
 *   /tag/[slug]                    -> page 1
 *   /tag/[slug]/page/[page]        -> page N (N >= 2)
 *
 * props:
 *   kind: "category" | "tag"
 *   term: normalized taxonomy term (id, name, slug, count, description, yoast_head_json)
 *   page: current page number (>= 1)
 *   extra: optional node rendered after the grid (eg. tag cloud on tag page)
 */
export default async function ArchivePage({ kind, term, page, extra }) {
  const perPage = page === 1 ? 14 : 12;
  const offset = page === 1 ? undefined : 2;

  const queryKey = kind === "tag" ? "tags" : "categories";
  const { posts, totalPages } = await getPosts({
    [queryKey]: term.id,
    perPage,
    page,
    offset,
  });
  if (posts.length === 0 && page > 1) notFound();

  const [hero, ...rest] = posts;
  const top = rest.slice(0, 4);
  const grid = rest.slice(4);

  const basePath = kind === "tag" ? `/tag/${term.slug}` : `/category/${term.slug}`;
  const baseUrl = absUrl(basePath);
  const pageUrl = (n) => (n <= 1 ? basePath : `${basePath}/page/${n}`);
  const pageAbsUrl = (n) => (n <= 1 ? baseUrl : `${baseUrl}/page/${n}`);

  const displayName = decodeHtml(term.name);
  const breadcrumbName = kind === "tag" ? `#${displayName}` : displayName;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: breadcrumbName,
    url: pageAbsUrl(page),
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
      { "@type": "ListItem", position: 2, name: breadcrumbName, item: baseUrl },
    ],
  };

  const prevAbs = page > 1 ? pageAbsUrl(page - 1) : null;
  const nextAbs = page < totalPages ? pageAbsUrl(page + 1) : null;

  // Category-style hero vs tag-style hero
  const isTag = kind === "tag";

  return (
    <div className={isTag ? undefined : "pb-20"}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {prevAbs && <link rel="prev" href={prevAbs} />}
      {nextAbs && <link rel="next" href={nextAbs} />}

      {/* Header / Hero */}
      {isTag ? (
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
              <span className="headline text-5xl text-brand md:text-7xl">#</span>
              <h1 className="headline text-4xl text-white md:text-6xl">{displayName}</h1>
            </div>
            {term.description && (
              <p className="mt-4 max-w-2xl text-base text-white/75 md:text-lg">
                {decodeHtml(term.description)}
              </p>
            )}
            <div className="mt-6 flex items-center gap-4 text-sm text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                <strong className="text-white">{term.count}</strong> บทความ
              </span>
              {totalPages > 1 && (
                <>
                  <span>·</span>
                  <span>
                    หน้า {page} จาก {totalPages}
                  </span>
                </>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="border-b border-black/5 bg-paper-warm">
          <div className="container-news py-12">
            <Link
              href="/"
              className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted hover:text-brand"
            >
              ← Home
            </Link>
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-block h-8 w-1.5 bg-brand" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
                Category
              </span>
            </div>
            <h1 className="headline mt-3 text-4xl md:text-6xl">{displayName}</h1>
            <p className="mt-3 text-sm text-ink-muted">{term.count} บทความ</p>
          </div>
        </section>
      )}

      {posts.length === 0 ? (
        <section className="container-news py-20 text-center text-ink-muted">
          ยังไม่มีบทความ
        </section>
      ) : (
        <>
          {page === 1 && hero && (
            <section className="container-news pt-10">
              <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <HeroCard post={hero} />
                <aside className="flex flex-col gap-5 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                  <h3 className="section-title">
                    {isTag ? `อ่านต่อ #${displayName}` : "Top in Category"}
                  </h3>
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

          <section className="container-news mt-14">
            {page === 1 && (
              <SectionHeader
                eyebrow="More"
                title={isTag ? "ทั้งหมดในแท็กนี้" : "บทความทั้งหมด"}
              />
            )}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {(page === 1 ? grid : posts).map((p) => (
                <NewsCard key={p.id} post={p} size="md" />
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-12 flex items-center justify-center gap-2"
              >
                {page > 1 && (
                  <Link
                    href={pageUrl(page - 1)}
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
                    href={pageUrl(page + 1)}
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

      {extra}
    </div>
  );
}
