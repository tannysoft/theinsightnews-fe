import Link from "next/link";
import { notFound } from "next/navigation";
import { getPosts, getPostsByAuthor, decodeHtml } from "@/lib/api";
import { NewsCard, HeroCard, RowCard } from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";
import { SITE, absUrl, safeJsonLd } from "@/lib/site";

/**
 * Shared archive body used by:
 *   /category/[slug]               -> page 1
 *   /category/[slug]/page/[page]   -> page N (N >= 2)
 *   /tag/[slug]                    -> page 1
 *   /tag/[slug]/page/[page]        -> page N (N >= 2)
 *   /author/[slug]                 -> page 1
 *   /author/[slug]/page/[page]     -> page N (N >= 2)
 *
 * props:
 *   kind: "category" | "tag" | "author"
 *   term: normalized taxonomy term (id, name, slug, count, description,
 *         yoast_head_json) or, for kind="author", an author (id, name, slug,
 *         description, avatar)
 *   page: current page number (>= 1)
 *   schema: optional JSON-LD graph to emit instead of our own BreadcrumbList
 *           — used by the author page, where Yoast supplies a ProfilePage
 *           graph that already carries its own breadcrumb
 *   extra: optional node rendered after the grid (eg. tag cloud on tag page)
 */
export default async function ArchivePage({ kind, term, page, schema, extra }) {
  // Page 1 shows 14 posts (hero + top 4 + grid 9).
  // Page 2+ shows 12 posts each, with an absolute offset that skips the
  // 14 already shown on page 1 plus the posts already shown on earlier
  // paginated pages. WP REST's `offset` param overrides pagination, so
  // we calculate the offset ourselves and don't send `page`.
  const isFirst = page === 1;
  const perPage = isFirst ? 14 : 12;
  const isAuthor = kind === "author";
  const queryKey = kind === "tag" ? "tags" : "categories";

  const fetchArgs = isAuthor ? { authorId: term.id, perPage } : { [queryKey]: term.id, perPage };
  if (isFirst) {
    fetchArgs.page = 1;
  } else {
    fetchArgs.offset = 14 + (page - 2) * 12;
  }

  const { posts, total } = isAuthor
    ? await getPostsByAuthor(fetchArgs)
    : await getPosts(fetchArgs);
  if (posts.length === 0 && page > 1) notFound();

  // Correct total pages: 14 on page 1, 12 thereafter
  const totalPages =
    total <= 14 ? 1 : 1 + Math.ceil((total - 14) / 12);

  const [hero, ...rest] = posts;
  const top = rest.slice(0, 4);
  const grid = rest.slice(4);

  const basePath = `/${kind === "category" ? "category" : kind}/${term.slug}`;
  const baseUrl = absUrl(basePath);
  const pageUrl = (n) => (n <= 1 ? basePath : `${basePath}/page/${n}`);
  const pageAbsUrl = (n) => (n <= 1 ? baseUrl : `${baseUrl}/page/${n}`);

  const displayName = decodeHtml(term.name);
  const breadcrumbName = kind === "tag" ? `#${displayName}` : displayName;
  // Taxonomy terms carry their own post count; an author archive only knows
  // the total the query just reported.
  const postCount = term.count ?? total;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: breadcrumbName,
    url: pageAbsUrl(page),
    numberOfItems: posts.length,
    itemListElement: posts.map((p, i) => ({
      "@type": "ListItem",
      position: (page - 1) * 12 + i + 1,
      url: absUrl(`/${p.slug}`),
      name: p.title,
    })),
  };
  // A caller-supplied graph (Yoast's ProfilePage) already has a breadcrumb;
  // emitting ours too would put two contradictory trails on one page.
  const breadcrumbJsonLd = schema
    ? null
    : {
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
  // Only the tag INDEX page has an `extra` (tag cloud) that gives natural
  // breathing room before the footer. Every other variant (all category
  // pages + paginated tag pages) needs its own bottom padding.
  const needsBottomSpace = !extra;

  return (
    <div className={needsBottomSpace ? "pb-20" : undefined}>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
      />
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
        />
      )}
      {prevAbs && <link rel="prev" href={prevAbs} />}
      {nextAbs && <link rel="next" href={nextAbs} />}

      {/* Header / Hero */}
      {isAuthor ? (
        <section className="border-b border-black/5 bg-paper-warm">
          <div className="container-news py-12">
            <Link
              href="/"
              className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted hover:text-brand"
            >
              ← Home
            </Link>
            <div className="mt-5 flex items-start gap-5">
              {term.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={term.avatar}
                  alt={displayName}
                  className="h-20 w-20 rounded-full object-cover md:h-24 md:w-24"
                />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-full bg-brand text-2xl font-bold text-white md:h-24 md:w-24">
                  {displayName?.[0]}
                </div>
              )}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
                  Author
                </span>
                <h1 className="headline mt-1 text-3xl md:text-5xl">{displayName}</h1>
                {term.description && (
                  <p className="mt-3 max-w-2xl text-sm text-ink-muted md:text-base">
                    {decodeHtml(term.description)}
                  </p>
                )}
                <p className="mt-3 text-sm text-ink-muted">
                  {postCount} บทความ
                  {totalPages > 1 && ` · หน้า ${page} จาก ${totalPages}`}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : isTag ? (
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
                <strong className="text-white">{postCount}</strong> บทความ
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
            <p className="mt-3 text-sm text-ink-muted">{postCount} บทความ</p>
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
                    {isAuthor
                      ? `เรื่องเด่นโดย ${displayName}`
                      : isTag
                        ? `อ่านต่อ #${displayName}`
                        : "Top in Category"}
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
