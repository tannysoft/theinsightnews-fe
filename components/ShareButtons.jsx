"use client";

import { useState } from "react";

const PLATFORMS = {
  x: {
    label: "X",
    build: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    path: (
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.645Z" />
    ),
  },
  facebook: {
    label: "Facebook",
    build: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    path: (
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.19 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.1 0 2.24.2 2.24.2v2.47H15.2c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33V22c4.78-.75 8.43-4.92 8.43-9.94Z" />
    ),
  },
  line: {
    label: "LINE",
    build: (url) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
    path: (
      <path d="M24 10.3C24 4.98 18.62.65 12 .65S0 4.98 0 10.3c0 4.77 4.27 8.76 10.02 9.52.39.08.93.26 1.06.6.12.3.08.77.04 1.08l-.17 1.03c-.05.3-.24 1.2 1.05.65 1.29-.54 6.94-4.09 9.47-7 1.75-1.92 2.59-3.87 2.59-5.88ZM7.75 13.05h-2.4c-.35 0-.64-.28-.64-.63V7.62c0-.35.29-.64.64-.64.35 0 .63.29.63.64v4.16h1.77c.35 0 .63.28.63.63 0 .35-.28.64-.63.64Zm2.13-.63c0 .35-.29.63-.64.63-.35 0-.63-.28-.63-.63V7.62c0-.35.28-.64.63-.64.35 0 .64.29.64.64v4.8Zm5.73 0c0 .27-.18.51-.43.6a.61.61 0 0 1-.2.03.64.64 0 0 1-.52-.26l-2.46-3.35v2.98c0 .35-.28.63-.63.63-.35 0-.64-.28-.64-.63V7.62c0-.27.18-.51.44-.6a.68.68 0 0 1 .72.23L14.35 10.6V7.62c0-.35.28-.64.63-.64.35 0 .63.29.63.64v4.8Zm3.87-3.04c.35 0 .64.29.64.64 0 .35-.29.63-.64.63h-1.76v1.13h1.76c.35 0 .64.29.64.64 0 .35-.29.63-.64.63h-2.4a.64.64 0 0 1-.63-.63V7.62c0-.35.28-.64.63-.64h2.4c.35 0 .64.29.64.64 0 .35-.29.63-.64.63h-1.76v1.13h1.76Z" />
    ),
  },
  telegram: {
    label: "Telegram",
    build: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    path: (
      <path d="M21.94 4.04 18.7 19.36c-.24 1.08-.88 1.35-1.79.84l-4.94-3.64-2.38 2.29c-.26.26-.49.49-1 .49l.36-5.07 9.22-8.33c.4-.36-.09-.56-.62-.2L6.15 13.91l-4.9-1.53c-1.07-.33-1.09-1.07.22-1.58l19.16-7.38c.89-.33 1.67.2 1.38 1.62Z" />
    ),
  },
  whatsapp: {
    label: "WhatsApp",
    build: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    path: (
      <path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.09 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.35.2 1.86.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35ZM12.04 21.5h-.02a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.25c0-5.45 4.43-9.88 9.89-9.88 2.64 0 5.12 1.03 6.98 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.87-9.86 9.87Zm8.41-18.28A11.82 11.82 0 0 0 12.04 0C5.46 0 .1 5.35.1 11.92c0 2.1.55 4.15 1.6 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.73 1.46h.01c6.58 0 11.93-5.35 11.94-11.93 0-3.19-1.24-6.18-3.5-8.43Z" />
    ),
  },
};

function Icon({ children }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function ShareButtons({
  url,
  title = "",
  platforms = ["x", "facebook", "line", "telegram"],
  variant = "solid",
  className = "",
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    url ||
    (typeof window !== "undefined" ? window.location.href : "");
  const shareTitle = title || (typeof document !== "undefined" ? document.title : "");

  const openShare = (e, href) => {
    e.preventDefault();
    if (typeof window === "undefined") return;
    const w = 600;
    const h = 520;
    const left = Math.max(0, (window.innerWidth - w) / 2);
    const top = Math.max(0, (window.innerHeight - h) / 2);
    window.open(
      href,
      "share",
      `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${w},height=${h},top=${top},left=${left}`
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const btn =
    variant === "solid"
      ? "bg-white/10 text-white border-transparent hover:bg-brand hover:text-white"
      : "border-black/10 text-ink hover:border-brand hover:bg-brand hover:text-white";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {platforms.map((p) => {
        const cfg = PLATFORMS[p];
        if (!cfg) return null;
        return (
          <a
            key={p}
            href={cfg.build(shareUrl, shareTitle)}
            aria-label={`Share on ${cfg.label}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => openShare(e, cfg.build(shareUrl, shareTitle))}
            className={`inline-grid h-9 w-9 place-items-center rounded-full border transition ${btn}`}
          >
            <Icon>{cfg.path}</Icon>
          </a>
        );
      })}
      <button
        onClick={copyLink}
        aria-label="Copy link"
        title={copied ? "Copied!" : "Copy link"}
        className={`relative inline-grid h-9 w-9 place-items-center rounded-full border transition ${btn}`}
      >
        {copied ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07L11 5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {copied && (
          <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-semibold text-white">
            Copied!
          </span>
        )}
      </button>
    </div>
  );
}
