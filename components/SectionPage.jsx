import Link from "next/link";
import { getPosts } from "@/lib/api";
import { NewsCard, RowCard, MagCard, HeroCard } from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";

export default async function SectionPage({ section }) {
  const ids = section.categoryIds.join(",");
  const { posts } = await getPosts({ perPage: 17, categories: ids });

  const [hero, ...rest] = posts;
  const top = rest.slice(0, 4);
  const mid = rest.slice(4, 10);
  const bottom = rest.slice(10, 16);

  return (
    <div className="pb-20">
      {/* Section Hero banner */}
      <section className="border-b border-black/5 bg-gradient-to-br from-paper-warm via-white to-paper">
        <div className="container-news py-12">
          <div className="flex items-center gap-3">
            <span className="inline-block h-8 w-1.5 bg-brand" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">{section.title}</span>
          </div>
          <h1 className="headline mt-4 max-w-3xl text-4xl md:text-6xl">
            {section.title}
          </h1>
          {section.subtitle && (
            <p className="mt-4 max-w-2xl text-lg text-ink-muted">{section.subtitle}</p>
          )}
          {section.subsections && (
            <div className="mt-6 flex flex-wrap gap-2">
              {section.subsections.map((s) => (
                <span key={s.label} className="inline-flex items-center rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-soft">
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {posts.length === 0 ? (
        <div className="container-news py-20 text-center text-ink-muted">ยังไม่มีบทความในหมวดนี้</div>
      ) : (
        <>
          {/* Hero row */}
          {hero && (
            <section className="container-news pt-10">
              <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <HeroCard post={hero} />
                <div className="flex flex-col gap-5 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                  <h3 className="section-title">Top in Section</h3>
                  <div className="divide-y divide-black/5">
                    {top.map((p, i) => (
                      <div key={p.id} className="py-5 first:pt-0 last:pb-0">
                        <RowCard post={p} index={i + 1} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 3-column grid */}
          {mid.length > 0 && (
            <section className="container-news mt-14">
              <SectionHeader eyebrow="⎯⎯ More stories" title="อ่านต่อในหมวดนี้" />
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {mid.map((p) => (
                  <NewsCard key={p.id} post={p} size="md" />
                ))}
              </div>
            </section>
          )}

          {/* Magazine list */}
          {bottom.length > 0 && (
            <section className="container-news mt-14">
              <SectionHeader eyebrow="✦ Featured" title="เรื่องที่คุณไม่ควรพลาด" />
              <div className="grid gap-10 md:grid-cols-2">
                {bottom.map((p) => (
                  <MagCard key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
