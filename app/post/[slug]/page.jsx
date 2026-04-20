import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import parse from "html-react-parser";
import { getPost, getPosts, formatDate, stripHtml } from "@/lib/api";
import { NewsCard, RowCard } from "@/components/NewsCard";
import ShareButtons from "@/components/ShareButtons";
import ArticleEnhancer from "@/components/ArticleEnhancer";
import { SITE, absUrl, cleanText } from "@/lib/site";
import { yoastToMetadata, yoastSchema } from "@/lib/yoast";

const SITE_URL = SITE.url;

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    return { title: "ไม่พบบทความ", robots: { index: false, follow: false } };
  }
  const canonicalPath = `/post/${post.slug}`;
  return yoastToMetadata(post.yoast, {
    canonicalPath,
    fallback: {
      title: post.title,
      description: cleanText(post.excerpt || post.content, 160),
      image: post.featuredImage,
    },
  });
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

  const articleUrl = `${SITE_URL}/post/${post.slug}`;

  // Prefer Yoast's schema graph if available, otherwise fall back to our own
  const yoastGraph = yoastSchema(post.yoast, `/post/${post.slug}`);
  const articleJsonLd = yoastGraph || {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    headline: post.title,
    description: cleanText(post.excerpt || post.content, 200),
    image: post.featuredImage ? [post.featuredImage] : [absUrl(SITE.defaultOgImage)],
    datePublished: post.date,
    dateModified: post.modified || post.date,
    author: [
      {
        "@type": "Person",
        name: post.author?.name || SITE.name,
      },
    ],
    publisher: {
      "@type": SITE.organizationType,
      name: SITE.name,
      logo: {
        "@type": "ImageObject",
        url: absUrl(SITE.logo),
      },
    },
    articleSection: post.categories?.[0]?.name,
    keywords: post.tags?.map((t) => t.name).join(", "),
    inLanguage: "th-TH",
    wordCount: stripHtml(post.content).split(/\s+/).filter(Boolean).length,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ...(post.categories?.[0]
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: post.categories[0].name,
              item: `${SITE_URL}/category/${post.categories[0].slug}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: post.categories?.[0] ? 3 : 2,
        name: post.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Hero — image-forward */}
      <header className="relative overflow-hidden bg-ink text-white">
        {/* Image area */}
        <div className="relative h-[60vh] min-h-[420px] w-full md:h-[70vh] md:min-h-[560px]">
          {post.featuredImage && (
            <Image
              src={post.featuredImage}
              alt={post.featuredAlt || post.title}
              fill
              sizes="100vw"
              priority
              className="absolute inset-0 object-cover"
            />
          )}
          {/* Subtle gradient — image stays vivid; darken only enough for title contrast */}
          <div className="absolute inset-x-0 top-0 h-[20%] bg-gradient-to-b from-black/25 via-black/5 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

          {/* Floating category badge — aligned with container-news edges */}
          {post.categories?.[0] && (
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <div className="container-news pt-6 md:pt-8">
                <Link
                  href={`/category/${post.categories[0].slug}`}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-sm bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg"
                >
                  {post.categories[0].name}
                </Link>
              </div>
            </div>
          )}

          {/* Overlay content anchored to the image bottom */}
          <div className="absolute inset-x-0 bottom-0">
            <div className="container-news pb-8 md:pb-6">
              <div className="max-w-6xl">
                <h1 className="headline text-3xl leading-[1.55] text-white md:text-5xl md:leading-[1.35] lg:text-6xl lg:leading-[1.35]">
                  {post.title}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-header strip with meta — compact, keeps image prominent above */}
        <div className="border-b border-white/10 bg-ink">
          <div className="container-news py-5">
            <div className="flex max-w-4xl flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                {post.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author.avatar} alt={post.author.name} className="h-10 w-10 rounded-full border-2 border-white/20 object-cover" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-brand font-bold">
                    {post.author.name?.[0]}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold">{post.author.name}</div>
                  <div className="text-xs text-white/60">กองบรรณาธิการ</div>
                </div>
              </div>
              <span className="h-6 w-px bg-white/15" />
              <time className="text-sm text-white/70">{formatDate(post.date)}</time>
              <span className="h-6 w-px bg-white/15" />
              <span className="text-sm text-white/70">{post.reading} min read</span>
              {post.excerpt && (
                <p className="ml-auto hidden max-w-md text-sm text-white/60 line-clamp-2 lg:block">
                  {post.excerpt}
                </p>
              )}
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
                <span className="mr-2 self-center text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">
                  Tags:
                </span>
                {post.tags.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tag/${t.slug}`}
                    className="rounded-full border border-black/10 px-3 py-1 text-xs text-ink-soft transition hover:border-brand hover:bg-brand hover:text-white"
                  >
                    #{t.name}
                  </Link>
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
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-ink p-5 text-white">
              <div>
                <span className="text-sm font-semibold">แชร์บทความนี้</span>
                <p className="mt-0.5 text-xs text-white/60">ช่วยกระจายข่าวเชิงลึกให้คนมากขึ้น</p>
              </div>
              <ShareButtons
                url={`${SITE_URL}/post/${post.slug}`}
                title={post.title}
                platforms={["x", "facebook", "line", "telegram", "whatsapp"]}
                variant="solid"
              />
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-8 lg:sticky lg:top-[100px] lg:self-start">
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
