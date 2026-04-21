import Link from "next/link";
import { getPosts, SECTION_MAP, formatDate, getPopularTags, decodeHtml } from "@/lib/api";
import { NewsCard, RowCard, MagCard } from "@/components/NewsCard";
import HeroSlider from "@/components/HeroSlider";
import SectionHeader from "@/components/SectionHeader";

export const revalidate = 300;

export default async function HomePage() {
  const [latestRes, analysisRes, reportsRes, opinionRes, trendingRes, popularTags] = await Promise.all([
    getPosts({ perPage: 22 }),
    getPosts({ perPage: 5, categories: SECTION_MAP["insight-analysis"].categoryIds.join(",") }),
    getPosts({ perPage: 3, categories: SECTION_MAP["special-reports"].categoryIds.join(",") }),
    getPosts({ perPage: 4, categories: SECTION_MAP.opinion.categoryIds.join(",") }),
    getPosts({ perPage: 5 }),
    getPopularTags({ perPage: 30 }),
  ]);

  const sliderPosts = latestRes.posts.slice(0, 5);
  const rest = latestRes.posts.slice(5);
  const sideTop = rest.slice(0, 4);
  const belowHero = rest.slice(4, 8);
  const editorsPick = rest.slice(8, 14);

  return (
    <div>
      <h1 className="sr-only">The Insight News — ศูนย์รวมข่าวสารเชิงลึก วิเคราะห์เจาะประเด็น ที่ยึดมั่นในความจริง</h1>
      {/* HERO SLIDER */}
      <section className="container-news pt-6">
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <HeroSlider posts={sliderPosts} />
          <aside className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Highlight Story</h3>
              <Link href="/insight-analysis" className="text-[11px] font-bold uppercase tracking-wider text-ink-muted hover:text-brand">All →</Link>
            </div>
            <div className="divide-y divide-black/5">
              {sideTop.map((p, i) => (
                <div key={p.id} className="py-5 first:pt-0 last:pb-0">
                  <RowCard post={p} index={i + 1} />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {/* Latest strip */}
      <section className="container-news mt-14">
        <SectionHeader
          eyebrow="● Latest Analysis"
          title="ข่าวล่าสุด"
          description="อัปเดตสถานการณ์ประจำวัน พร้อมบริบทที่คุณต้องรู้"
          href="/category/insight"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {belowHero.map((p) => (
            <NewsCard key={p.id} post={p} size="md" />
          ))}
        </div>
      </section>

      {/* Insight Analysis block */}
      <section className="mt-16 bg-ink py-16 text-white">
        <div className="container-news">
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="eyebrow text-brand-400">■ Insight Analysis</span>
              <h2 className="headline mt-1 text-3xl text-white md:text-4xl">
                วิเคราะห์เจาะลึก <span className="text-brand-400">เบื้องหลังทุกประเด็น</span>
              </h2>
              <p className="mt-2 max-w-xl text-sm text-white/70">
                Political Analysis · Economic Trends · Data Stories · Fact-Check · Investigative Reports
              </p>
            </div>
            <Link href="/insight-analysis" className="shrink-0 text-[12px] font-bold uppercase tracking-[0.18em] text-white/70 hover:text-brand-400">
              ดูทั้งหมด →
            </Link>
          </div>
          <div className="grid items-start gap-8 lg:grid-cols-[1.3fr,1fr]">
            {analysisRes.posts[0] && (
              <DarkFeature post={analysisRes.posts[0]} />
            )}
            <div className="divide-y divide-white/10">
              {analysisRes.posts.slice(1, 5).map((p) => (
                <div key={p.id} className="py-5 lg:first:pt-0">
                  <DarkRow post={p} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trending + Editor's Pick */}
      <section className="container-news mt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr,360px]">
          {/* Editor's Pick */}
          <div>
            <SectionHeader
              eyebrow="★ Editor's Pick"
              title="คัดสรรโดยกองบรรณาธิการ"
              description="เรื่องที่บรรณาธิการแนะนำให้อ่านประจำสัปดาห์"
              href="/category/editor"
            />
            <div className="grid gap-8 sm:grid-cols-2">
              {editorsPick.map((p) => (
                <MagCard key={p.id} post={p} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6">
            {/* Trending */}
            <div className="rounded-2xl border border-black/5 bg-paper-warm p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 bg-brand" />
                  <h3 className="headline text-lg">Trending Topics</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">Weekly</span>
              </div>
              <ol className="divide-y divide-black/5">
                {trendingRes.posts.map((p, i) => (
                  <li key={p.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <span className="headline shrink-0 text-3xl font-black leading-none text-brand/30">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/${p.slug}`}>
                        <h4 className="headline text-sm transition hover:text-brand line-clamp-3">{p.title}</h4>
                      </Link>
                      <p className="mt-1.5 text-[11px] text-ink-muted">{formatDate(p.date, { short: true })}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Membership CTA */}
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-700 p-6 text-white">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Membership</span>
              <h3 className="headline mt-2 text-xl text-white">
                ร่วมสนับสนุนงานวารสารศาสตร์คุณภาพ
              </h3>
              <p className="mt-2 text-sm text-white/85">
                สมัครสมาชิกเพื่อเข้าถึงบทวิเคราะห์พิเศษ รายงานเชิงลึก และร่วมเป็นส่วนหนึ่งของการปฏิรูปสื่อ
              </p>
              <Link href="/membership" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-white/90">
                Support Us →
              </Link>
            </div>

          </aside>
        </div>
      </section>

      {/* Special Reports row */}
      <section className="container-news mt-16">
        <SectionHeader
          eyebrow="⎯⎯ Special Reports"
          title="รายงานพิเศษ"
          description="สารคดีข่าว · บทสัมภาษณ์เอ็กซ์คลูซีฟ · ซีรีส์เชิงหัวข้อ"
          href="/special-reports"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {reportsRes.posts.map((p) => (
            <NewsCard key={p.id} post={p} size="lg" />
          ))}
        </div>
      </section>

      {/* Opinion */}
      <section className="container-news mt-16">
        <SectionHeader
          eyebrow="✎ Opinion"
          title="ทัศนะ & มุมมอง"
          description="บทความ · พ็อดแคสต์ Inside Insight · Photo Essays"
          href="/opinion"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {opinionRes.posts.map((p) => (
            <NewsCard key={p.id} post={p} size="md" variant="compact" />
          ))}
        </div>
      </section>

      {/* Tag Cloud */}
      {popularTags.length > 0 && (
        <section className="container-news mt-16">
          <SectionHeader
            eyebrow="# Tag Cloud"
            title="สำรวจตามแท็ก"
            description="หัวข้อที่คนอ่านมากที่สุดในช่วงนี้"
          />
          <TagCloud tags={popularTags.slice(0, 24)} />
        </section>
      )}

      {/* Values strip */}
      <section className="mt-16 border-y border-black/5 bg-paper-warm py-12">
        <div className="container-news">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Our Commitment</span>
            <h2 className="headline mt-3 text-2xl md:text-4xl">
              "เรายึดมั่นในความจริง สร้างมาตรฐานใหม่ของการนำเสนอข่าวสาร
              <br />เพื่อประโยชน์สูงสุดของสังคม"
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              { t: "Truth First", d: "ตรวจสอบข้อเท็จจริงทุกข่าว ก่อนเผยแพร่" },
              { t: "In-Depth", d: "วิเคราะห์เชิงลึก ให้บริบทครบถ้วน" },
              { t: "Independent", d: "อิสระจากอิทธิพลทางการเมือง-ธุรกิจ" },
              { t: "For Society", d: "เพื่อประโยชน์สูงสุดของสาธารณะ" },
            ].map((v, i) => (
              <div key={v.t} className="rounded-xl border border-black/10 bg-white p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">{i + 1}</span>
                  <h3 className="headline text-lg">{v.t}</h3>
                </div>
                <p className="mt-3 text-sm text-ink-muted">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function DarkFeature({ post }) {
  return (
    <article className="group">
      <Link href={`/${post.slug}`} className="relative block aspect-[16/9] overflow-hidden rounded-xl bg-white/5">
        {post.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredImage} alt={post.featuredAlt || post.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </Link>
      <div className="mt-4">
        <span className="eyebrow text-brand-400">{post.categories?.[0]?.name || "Analysis"}</span>
        <Link href={`/${post.slug}`}>
          <h3 className="headline mt-2 text-2xl text-white transition hover:text-brand-400 md:text-3xl line-clamp-3">
            {post.title}
          </h3>
        </Link>
        {post.excerpt && (
          <p className="mt-3 text-sm text-white/70 line-clamp-2">{post.excerpt}</p>
        )}
        <p className="mt-3 text-xs text-white/60">
          {post.author?.name} · {formatDate(post.date)}
        </p>
      </div>
    </article>
  );
}

/**
 * Tag cloud with weight-based sizing:
 * tags with more posts render larger & warmer; least-used ones stay small.
 */
function TagCloud({ tags }) {
  if (!tags?.length) return null;
  const counts = tags.map((t) => t.count || 0);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const span = Math.max(1, max - min);

  const tierFor = (c) => {
    const ratio = (c - min) / span; // 0..1
    if (ratio >= 0.8) return 4;
    if (ratio >= 0.55) return 3;
    if (ratio >= 0.3) return 2;
    if (ratio >= 0.1) return 1;
    return 0;
  };

  const CLASSES = [
    "text-sm py-1.5 px-3.5 text-ink-muted",
    "text-[15px] py-1.5 px-4 text-ink-soft",
    "text-base py-2 px-4 text-ink font-medium",
    "text-lg py-2 px-5 text-ink font-semibold",
    "text-xl py-2.5 px-5 text-brand font-bold",
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-paper-warm p-6 md:p-10">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-brand/5 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-2.5 md:gap-3">
        {tags.map((t) => {
          const tier = tierFor(t.count || 0);
          return (
            <Link
              key={t.id}
              href={`/tag/${t.slug}`}
              title={`${t.count || 0} บทความ`}
              className={`group inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white transition hover:-translate-y-0.5 hover:border-transparent hover:bg-brand hover:text-white hover:shadow-md ${CLASSES[tier]}`}
            >
              <span className="text-brand/50 group-hover:text-white/80">#</span>
              <span>{decodeHtml(t.name)}</span>
              <span className="ml-1 text-[10px] font-semibold tabular-nums opacity-50 group-hover:opacity-80">
                {t.count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DarkRow({ post }) {
  return (
    <article className="group grid grid-cols-[140px,1fr] gap-4">
      <Link href={`/${post.slug}`} className="relative aspect-[10/9] overflow-hidden rounded-md bg-white/5">
        {post.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredImage} alt={post.featuredAlt || post.title} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]" />
        )}
      </Link>
      <div>
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-400">{post.categories?.[0]?.name || "Insight"}</span>
        <Link href={`/${post.slug}`}>
          <h4 className="headline mt-1 text-base text-white transition hover:text-brand-400 line-clamp-3">{post.title}</h4>
        </Link>
        <p className="mt-2 text-[11px] text-white/60">{formatDate(post.date, { short: true })} · {post.reading} min</p>
      </div>
    </article>
  );
}
