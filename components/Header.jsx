"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import SocialIcons from "./SocialIcons";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/insight-analysis", label: "Insight Analysis" },
  { href: "/special-reports", label: "Special Reports" },
  { href: "/opinion", label: "Opinion" },
  { href: "/about", label: "About Us" },
  { href: "/membership", label: "Membership", highlight: true },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
      const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
      setNow(`วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`);
    };
    fmt();
    const id = setInterval(fmt, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {/* meta row */}
      <div className="hidden border-b border-black/5 bg-ink text-white md:block">
        <div className="container-news flex h-9 items-center justify-between text-[12px]">
          <div className="flex items-center gap-4">
            <span className="tabular-nums opacity-80">{now}</span>
            <span className="h-3 w-px bg-white/20" />
            <span className="opacity-80">Bangkok, Thailand</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/membership" className="link-underline opacity-90 hover:opacity-100">Become a Member</Link>
            <span className="h-3 w-px bg-white/20" />
            <Link href="/about" className="link-underline opacity-90 hover:opacity-100">Newsroom</Link>
          </div>
        </div>
      </div>

      {/* masthead */}
      <div className="container-news flex items-center justify-between gap-4 py-3 md:py-4">
        <button
          aria-label="Open menu"
          className="grid h-10 w-10 place-items-center rounded-md border border-black/10 md:hidden"
          onClick={() => setOpen(true)}
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>

        <Logo priority height={scrolled ? 40 : 56} className="transition-all" />

        <div className="hidden items-center gap-3 md:flex">
          <form action="/search" className="relative">
            <input
              name="q"
              placeholder="ค้นหาข่าว บทวิเคราะห์..."
              className="h-10 w-64 rounded-full border border-black/10 bg-paper-warm pl-4 pr-10 text-sm outline-none transition focus:w-80 focus:border-brand focus:bg-white"
            />
            <button className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-brand text-white" aria-label="Search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </form>
          <Link
            href="/membership"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <span>Support Us</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* primary nav */}
      <nav className="hidden border-t border-black/5 md:block">
        <div className="container-news flex items-center justify-between">
          <ul className="-ml-4 flex items-center">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`relative inline-flex h-12 items-center px-4 text-[13px] font-semibold uppercase tracking-[0.12em] transition hover:text-brand ${
                    item.highlight ? "text-brand" : "text-ink"
                  }`}
                >
                  {item.label}
                  {item.highlight && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            <span>Follow</span>
            <SocialIcons size={28} iconSize={13} />
          </div>
        </div>
      </nav>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <Logo height={40} />
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-md border border-black/10">✕</button>
            </div>
            <form action="/search" className="mt-6">
              <input name="q" placeholder="ค้นหา..." className="h-11 w-full rounded-md border border-black/10 bg-paper-warm px-4 text-sm outline-none focus:border-brand" />
            </form>
            <ul className="mt-6 space-y-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    onClick={() => setOpen(false)}
                    href={item.href}
                    className="block rounded-md px-3 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-paper-warm"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}
