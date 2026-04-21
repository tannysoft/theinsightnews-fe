import Link from "next/link";
import Image from "next/image";
import { formatDate, relativeTime } from "@/lib/api";

function Category({ cats, className = "" }) {
  if (!cats?.length) return null;
  const c = cats[0];
  return (
    <Link
      href={`/category/${c.slug}`}
      className={`relative z-20 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-brand hover:underline ${className}`}
    >
      <span className="inline-block h-[6px] w-[6px] bg-brand" />
      {c.name}
    </Link>
  );
}

function Meta({ post, light = false }) {
  return (
    <div className={`flex items-center gap-2 text-[12px] ${light ? "text-white/70" : "text-ink-muted"}`}>
      <span>{post.author?.name}</span>
      <span className="opacity-60">·</span>
      <time dateTime={post.date}>{relativeTime(post.date)}</time>
      <span className="opacity-60">·</span>
      <span>{post.reading} min read</span>
    </div>
  );
}

/**
 * Pattern: image is wrapped in its own <Link>, title has its own <Link>.
 * Both navigate to the same post but are siblings (no nested <a>).
 */

/** Featured hero card — massive, immersive */
export function HeroCard({ post }) {
  if (!post) return null;
  const href = `/${post.slug}`;
  return (
    <article className="group relative block h-[70vh] min-h-[520px] overflow-hidden rounded-2xl bg-ink">
      <Link href={href} aria-label={post.title} className="absolute inset-0 z-0">
        {post.featuredImage && (
          <Image
            src={post.featuredImage}
            alt={post.featuredAlt || post.title}
            fill
            sizes="(max-width: 1024px) 100vw, 70vw"
            className="object-cover transition duration-700 group-hover:scale-105"
            priority
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
      </Link>
      <div className="pointer-events-none absolute left-0 top-0 m-6 flex items-center gap-2">
        <span className="rounded-sm bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
          Top Story
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-10">
        <Category cats={post.categories} />
        <h2 className="headline mt-3 max-w-4xl text-white text-2xl md:text-3xl lg:text-[32px] line-clamp-2">
          <Link href={href} className="hover:text-white/90">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className="mt-4 max-w-2xl text-base text-white/80 md:text-lg line-clamp-2">
            {post.excerpt}
          </p>
        )}
        <div className="relative z-20 mt-5">
          <Meta post={post} light />
        </div>
      </div>
    </article>
  );
}

/** Standard card — image top, text bottom */
export function NewsCard({ post, size = "md", variant = "default" }) {
  if (!post) return null;

  const sizes = {
    sm: { title: "text-base", imgH: "aspect-[16/10]" },
    md: { title: "text-lg md:text-xl", imgH: "aspect-[16/10]" },
    lg: { title: "text-xl md:text-2xl", imgH: "aspect-[16/9]" },
  };
  const s = sizes[size] || sizes.md;
  const href = `/${post.slug}`;

  return (
    <article className="group">
      <div className="relative">
        <Link
          href={href}
          aria-label={post.title}
          className={`relative block ${s.imgH} overflow-hidden rounded-lg bg-paper-warm`}
        >
          {post.featuredImage ? (
            <Image
              src={post.featuredImage}
              alt={post.featuredAlt || post.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-ink-muted">No image</div>
          )}
        </Link>
        {post.categories?.length > 0 && (
          <div className="absolute left-3 top-3 z-10">
            <Category cats={post.categories} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className={`headline ${s.title} line-clamp-3`}>
          <Link href={href} className="transition group-hover:text-brand">
            {post.title}
          </Link>
        </h3>
        {variant !== "compact" && post.excerpt && (
          <p className="mt-2 text-sm text-ink-muted line-clamp-2">{post.excerpt}</p>
        )}
        <div className="mt-2">
          <Meta post={post} />
        </div>
      </div>
    </article>
  );
}

/** Horizontal small row — for sidebars & lists */
export function RowCard({ post, index }) {
  if (!post) return null;
  const href = `/${post.slug}`;
  return (
    <article className="group flex items-start gap-4">
      {typeof index === "number" && (
        <span className="headline shrink-0 text-3xl font-black leading-none text-brand/30 group-hover:text-brand">
          {String(index).padStart(2, "0")}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h4 className="headline text-base line-clamp-3">
          <Link href={href} className="transition group-hover:text-brand">
            {post.title}
          </Link>
        </h4>
        <div className="mt-1.5">
          <Meta post={post} />
        </div>
      </div>
      {post.featuredImage && (
        <Link
          href={href}
          aria-label={post.title}
          className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-md bg-paper-warm"
        >
          <Image
            src={post.featuredImage}
            alt={post.featuredAlt || post.title}
            fill
            sizes="96px"
            className="object-cover transition duration-500 group-hover:scale-[1.06]"
          />
        </Link>
      )}
    </article>
  );
}

/** Magazine-style horizontal card — image left, text right */
export function MagCard({ post }) {
  if (!post) return null;
  const href = `/${post.slug}`;
  return (
    <article className="group grid grid-cols-[1.1fr,1fr] gap-5">
      <div className="relative">
        <Link
          href={href}
          aria-label={post.title}
          className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-paper-warm"
        >
          {post.featuredImage && (
            <Image
              src={post.featuredImage}
              alt={post.featuredAlt || post.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          )}
        </Link>
        {post.categories?.length > 0 && (
          <div className="absolute left-3 top-3 z-10">
            <Category cats={post.categories} />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <h3 className="headline text-xl line-clamp-3 md:text-2xl">
          <Link href={href} className="transition group-hover:text-brand">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && (
          <p className="mt-2 text-sm text-ink-muted line-clamp-2">{post.excerpt}</p>
        )}
        <div className="mt-3">
          <Meta post={post} />
        </div>
      </div>
    </article>
  );
}

export function DateLabel({ date }) {
  return <time className="text-xs text-ink-muted">{formatDate(date)}</time>;
}
