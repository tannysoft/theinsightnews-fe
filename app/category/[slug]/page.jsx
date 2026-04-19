import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getPosts, decodeHtml } from "@/lib/api";
import { NewsCard, HeroCard, RowCard } from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "หมวดหมู่" };
  return { title: decodeHtml(cat.name), description: decodeHtml(cat.description || "") };
}

export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp?.page || "1", 10));
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const perPage = page === 1 ? 14 : 12;
  const offset = page === 1 ? undefined : 2;
  const { posts, totalPages } = await getPosts({ categories: cat.id, perPage, page, offset });
  if (posts.length === 0 && page > 1) notFound();

  const [hero, ...rest] = posts;
  const top = rest.slice(0, 4);
  const grid = rest.slice(4);

  return (
    <div>
      <section className="border-b border-black/5 bg-paper-warm">
        <div className="container-news py-12">
          <Link href="/" className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted hover:text-brand">← Home</Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-block h-8 w-1.5 bg-brand" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">Category</span>
          </div>
          <h1 className="headline mt-3 text-4xl md:text-6xl">{decodeHtml(cat.name)}</h1>
          <p className="mt-3 text-sm text-ink-muted">{cat.count} บทความ</p>
        </div>
      </section>

      {posts.length === 0 ? (
        <div className="container-news py-20 text-center text-ink-muted">ยังไม่มีบทความ</div>
      ) : (
        <>
          {page === 1 && hero && (
            <section className="container-news pt-10">
              <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <HeroCard post={hero} />
                <aside className="flex flex-col gap-5 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                  <h3 className="section-title">Top in Category</h3>
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
            {page === 1 && <SectionHeader eyebrow="More" title="บทความทั้งหมด" />}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {(page === 1 ? grid : posts).map((p) => (
                <NewsCard key={p.id} post={p} size="md" />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link href={`/category/${slug}?page=${page - 1}`} className="rounded-md border border-black/10 px-4 py-2 text-sm hover:border-brand hover:text-brand">
                    ← ก่อนหน้า
                  </Link>
                )}
                <span className="px-4 py-2 text-sm text-ink-muted">หน้า {page} / {totalPages}</span>
                {page < totalPages && (
                  <Link href={`/category/${slug}?page=${page + 1}`} className="rounded-md border border-black/10 px-4 py-2 text-sm hover:border-brand hover:text-brand">
                    ถัดไป →
                  </Link>
                )}
              </nav>
            )}
          </section>
        </>
      )}
    </div>
  );
}
