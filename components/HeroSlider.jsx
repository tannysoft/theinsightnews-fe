"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { relativeTime } from "@/lib/api";

const AUTOPLAY_MS = 6500;

export default function HeroSlider({ posts = [] }) {
  const slides = posts.filter(Boolean).slice(0, 6);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const go = useCallback(
    (n) => setIdx((i) => (n + slides.length) % slides.length),
    [slides.length]
  );
  const next = useCallback(() => go(idx + 1), [go, idx]);
  const prev = useCallback(() => go(idx - 1), [go, idx]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    timerRef.current = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [idx, paused, next, slides.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (!slides.length) return null;

  return (
    <section
      className="group relative h-[62vh] min-h-[460px] overflow-hidden rounded-2xl bg-ink text-white lg:h-full lg:min-h-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Top stories"
    >
      {/* Slides */}
      {slides.map((post, i) => {
        const active = i === idx;
        return (
          <div
            key={post.id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              active ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!active}
          >
            {post.featuredImage && (
              <Image
                src={post.featuredImage}
                alt={post.featuredAlt || post.title}
                fill
                sizes="100vw"
                priority={i === 0}
                className={`object-cover transition-transform duration-[7000ms] ease-out ${
                  active ? "scale-105" : "scale-100"
                }`}
              />
            )}
            <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 pb-14 md:p-8 md:pb-16">
              <div className="flex items-center gap-3">
                <span className="rounded-sm bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em]">
                  {i === 0 ? "Top Story" : "Featured"}
                </span>
                {post.categories?.[0] && (
                  <Link
                    href={`/category/${post.categories[0].slug}`}
                    className="relative z-20 text-[11px] font-bold uppercase tracking-[0.18em] text-white/90 hover:text-brand-400"
                  >
                    {post.categories[0].name}
                  </Link>
                )}
              </div>
              <h2 className="headline mt-3 max-w-3xl text-xl leading-[1.6] text-white line-clamp-2 md:text-3xl md:leading-[1.5] lg:text-[36px] lg:leading-[1.4]">
                <Link
                  href={`/${post.slug}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:text-white/95"
                >
                  {post.title}
                </Link>
              </h2>
              <div className="relative z-20 mt-3 flex items-center gap-3 text-xs text-white/80">
                <span>{post.author?.name}</span>
                <span className="opacity-60">·</span>
                <time>{relativeTime(post.date)}</time>
                <span className="opacity-60">·</span>
                <span>{post.reading} min read</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Controls */}
      {slides.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 md:px-6">
            <button
              onClick={prev}
              aria-label="Previous slide"
              className="pointer-events-auto relative z-30 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur transition hover:border-brand hover:bg-brand md:h-12 md:w-12"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={next}
              aria-label="Next slide"
              className="pointer-events-auto relative z-30 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur transition hover:border-brand hover:bg-brand md:h-12 md:w-12"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Bottom bar: dots + counter + progress */}
          <div className="absolute inset-x-0 bottom-0 z-30">
            <div className="flex items-center justify-between gap-4 px-5 py-3 md:px-8 md:py-4">
              <div className="flex items-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => go(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`relative h-[3px] overflow-hidden rounded-full transition-all ${
                      i === idx ? "w-10 bg-white/35" : "w-5 bg-white/30 hover:bg-white/55"
                    }`}
                  >
                    {i === idx && !paused && (
                      <span
                        key={idx}
                        className="absolute inset-y-0 left-0 block bg-brand"
                        style={{
                          animation: `heroProgress ${AUTOPLAY_MS}ms linear forwards`,
                        }}
                      />
                    )}
                    {i === idx && paused && (
                      <span className="absolute inset-0 bg-brand" />
                    )}
                  </button>
                ))}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 tabular-nums">
                {String(idx + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes heroProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
