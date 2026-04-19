import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import parse from "html-react-parser";
import { getPost, getPosts, formatDate } from "@/lib/api";
import { NewsCard, RowCard } from "@/components/NewsCard";
import SocialIcons from "@/components/SocialIcons";
import ArticleEnhancer from "@/components/ArticleEnhancer";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "ไม่พบบทความ" };
  return {
    title: post.title,
    description: post.excerpt?.slice(0, 160),
    openGraph: {
      title: post.title,
      description: post.excerpt?.slice(0, 160),
      images: post.featuredImage ? [post.featuredImage] : [],
    },
  };
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const catIds = post.categories.map((c) => c.id).join(",");
  const relatedRes = catIds
    ? await getPosts({ perPage: 5, categories: catIds, exclude: post.id })
    : { posts: [] };

  const trendingRes = await getPosts({ perPage: 5, exclude: post.id });

  return (
    <article>
      {/* Hero */}
      <header className="relative overflow-hidden bg-ink text-white">
        {post.featuredImage && (
          <Image
            src={post.featuredImage}
            alt={post.featuredAlt || post.title}
            fill
            sizes="100vw"
            priority
            className="absolute inset-0 object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/30" />
        <div className="container-news relative py-20 md:py-28">
          <div className="max-w-4xl">
            {post.categories?.[0] && (
              <Link href={`/category/${post.categories[0].slug}`} className="inline-flex items-center gap-2 rounded-sm bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                {post.categories[0].name}
              </Link>
            )}
            <h1 className="headline mt-5 text-4xl leading-[1.55] text-white md:text-6xl md:leading-[1.35]">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mt-5 max-w-3xl text-lg text-white/80">{post.excerpt}</p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                {post.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author.avatar} alt={post.author.name} className="h-11 w-11 rounded-full border-2 border-white/20 object-cover" />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-brand font-bold">{post.author.name?.[0]}</div>
                )}
                <div>
                  <div className="text-sm font-semibold">{post.author.name}</div>
                  <div className="text-xs text-white/60">กองบรรณาธิการ</div>
                </div>
              </div>
              <span className="h-6 w-px bg-white/20" />
              <time className="text-sm text-white/70">{formatDate(post.date)}</time>
              <span className="h-6 w-px bg-white/20" />
              <span className="text-sm text-white/70">{post.reading} min read</span>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="container-news py-12">
        <div className="mx-auto grid max-w-[1160px] gap-14 lg:grid-cols-[minmax(0,1fr),360px]">
          <div className="min-w-0">
            <div className="prose-news">
              {parse(post.content)}
            </div>
            <ArticleEnhancer />

            {post.tags?.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-2 border-t border-black/10 pt-8">
                <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Tags:</span>
                {post.tags.map((t) => (
                  <span key={t.id} className="rounded-full border border-black/10 px-3 py-1 text-xs text-ink-soft hover:border-brand hover:text-brand">
                    #{t.name}
                  </span>
                ))}
              </div>
            )}

            {/* Author box */}
            <div className="mt-10 rounded-2xl border border-black/10 bg-paper-warm p-6 md:p-8">
              <div className="flex items-start gap-5">
                {post.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author.avatar} alt={post.author.name} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-brand text-xl font-bold text-white">
                    {post.author.name?.[0]}
                  </div>
                )}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Author</span>
                  <h3 className="headline mt-1 text-lg">{post.author.name}</h3>
                  {post.author.description && (
                    <p className="mt-2 text-sm text-ink-muted">{post.author.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Share */}
            <div className="mt-8 flex items-center justify-between rounded-xl bg-ink p-5 text-white">
              <span className="text-sm font-semibold">แชร์บทความนี้</span>
              <SocialIcons
                platforms={["x", "facebook", "line", "telegram"]}
                variant="solid"
                size={36}
                iconSize={15}
              />
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-8 lg:sticky lg:top-[180px] lg:self-start">
            <div>
              <h3 className="section-title mb-5">Related</h3>
              <div className="divide-y divide-black/5">
                {relatedRes.posts.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-5 first:pt-0 last:pb-0">
                    <RowCard post={p} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-700 p-6 text-white">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Premium</span>
              <h3 className="headline mt-2 text-lg text-white">อ่านมากขึ้น ด้วย Insider</h3>
              <p className="mt-2 text-sm text-white/85">สมัครสมาชิก เข้าถึงบทวิเคราะห์พิเศษเฉพาะสมาชิกเท่านั้น</p>
              <Link href="/membership" className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand">
                สมัครเลย →
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* More from section */}
      {relatedRes.posts.length > 0 && (
        <section className="border-t border-black/5 bg-paper-warm py-16">
          <div className="container-news">
            <div className="mb-8 flex items-end justify-between border-b-2 border-ink pb-3">
              <h2 className="headline text-2xl">เรื่องที่เกี่ยวข้อง</h2>
              {post.categories?.[0] && (
                <Link href={`/category/${post.categories[0].slug}`} className="text-[12px] font-bold uppercase tracking-[0.18em] text-ink-muted hover:text-brand">
                  ดูในหมวด {post.categories[0].name} →
                </Link>
              )}
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {relatedRes.posts.slice(0, 4).map((p) => (
                <NewsCard key={p.id} post={p} size="md" />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
