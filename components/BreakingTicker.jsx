import { getPosts } from "@/lib/api";

export default async function BreakingTicker() {
  const { posts } = await getPosts({ perPage: 8 });
  if (!posts?.length) return null;
  const items = [...posts, ...posts];

  return (
    <div className="relative border-b border-black/5 bg-white">
      <div className="container-news flex items-center gap-4 py-2">
        <span className="flex shrink-0 items-center gap-2 rounded-sm bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live · Breaking
        </span>
        <div className="scroll-fade-mask relative flex-1 overflow-hidden">
          <div className="flex min-w-max animate-marquee gap-10 whitespace-nowrap text-sm text-ink/80">
            {items.map((p, i) => (
              <a
                key={`${p.id}-${i}`}
                href={`/${p.slug}`}
                className="flex items-center gap-3 hover:text-brand"
              >
                <span className="inline-block h-1 w-1 rounded-full bg-brand" />
                <span className="font-medium">{p.title}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
