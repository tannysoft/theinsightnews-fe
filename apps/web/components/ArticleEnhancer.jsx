"use client";

import { useEffect } from "react";

/**
 * Runs after the article body renders:
 *  1. Pairs each WordPress EZ-TOC plugin link to its heading (matching by text),
 *     assigns a stable id to the heading, and smooth-scrolls on click.
 *  2. Makes bare oEmbed iframes responsive and loads social-widget SDKs.
 */
export default function ArticleEnhancer({ rootSelector = ".prose-news" } = {}) {
  useEffect(() => {
    const prose = document.querySelector(rootSelector);
    if (!prose) return;

    // -- 1. Wire up TOC ------------------------------------------------------
    // EZ-TOC renders anchors like
    //   <a href="https://site.com/slug/#<url-encoded-thai-heading>">ก้าวแรก...</a>
    // The hash is a URL-encoded version of the heading's text, not a predictable
    // "ez-toc-heading-N" id. Match by text content instead, and assign our own id.
    const slug = (s) =>
      "toc-" +
      encodeURIComponent(
        (s || "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 80)
      );

    const headings = Array.from(prose.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(
      (h) => !h.closest(".ez-toc-container") && !h.closest("#ez-toc-container")
    );

    // Also keep an index-based id for users who linked with the pattern
    // "#ez-toc-heading-N".
    headings.forEach((h, i) => {
      if (!h.id) h.id = slug(h.textContent);
      h.style.scrollMarginTop = "120px";
      // Attach a secondary index-based id via a hidden anchor before the heading
      if (!document.getElementById(`ez-toc-heading-${i + 1}`)) {
        const anchor = document.createElement("span");
        anchor.id = `ez-toc-heading-${i + 1}`;
        anchor.style.cssText = "display:block;height:0;scroll-margin-top:180px;";
        h.parentNode.insertBefore(anchor, h);
      }
    });

    const byText = new Map();
    headings.forEach((h) => byText.set(h.textContent.trim(), h));

    const tocLinks = Array.from(
      prose.querySelectorAll(
        '.ez-toc-container a, #ez-toc-container a, a[href*="#ez-toc-heading-"]'
      )
    );

    const findTarget = (a) => {
      const href = a.getAttribute("href") || "";
      // Case A: explicit #ez-toc-heading-N
      const byIdx = href.match(/#(ez-toc-heading-\d+)/);
      if (byIdx) {
        const el = document.getElementById(byIdx[1]);
        if (el) return el;
      }
      // Case B: hash in URL — decode and match against heading text
      const hashIdx = href.indexOf("#");
      if (hashIdx >= 0) {
        try {
          const decoded = decodeURIComponent(href.slice(hashIdx + 1));
          const match = byText.get(decoded.trim());
          if (match) return match;
        } catch {}
      }
      // Case C: match by link's visible text
      const linkText = a.textContent.trim();
      if (byText.has(linkText)) return byText.get(linkText);
      // Loose match: first heading that starts with the link text
      const loose = headings.find(
        (h) => h.textContent.trim().startsWith(linkText) || linkText.startsWith(h.textContent.trim())
      );
      return loose || null;
    };

    const scrollToEl = (target) => {
      const header = document.querySelector("header.sticky, header[class*='sticky']");
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const offset = 24; // extra breathing room
      const y = target.getBoundingClientRect().top + window.scrollY - headerH - offset;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    };

    const onTocClick = (e) => {
      const a = e.currentTarget;

      // If this anchor is the toggle button, collapse/expand instead of scrolling
      if (
        a.classList.contains("ez-toc-toggle") ||
        a.classList.contains("ez-toc-pull-right") ||
        a.closest(".ez-toc-title-toggle")
      ) {
        e.preventDefault();
        e.stopPropagation();
        const container = a.closest(".ez-toc-container, #ez-toc-container");
        if (container) container.classList.toggle("ez-toc-collapsed");
        return;
      }

      const target = findTarget(a);
      if (!target) {
        // Still swallow href="#" jumps
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#")) e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      scrollToEl(target);
      if (target.id) history.replaceState(null, "", `#${target.id}`);
    };

    tocLinks.forEach((a) => a.addEventListener("click", onTocClick));

    // -- 2. Responsive oEmbed ------------------------------------------------
    const bareIframes = prose.querySelectorAll(
      "iframe:not([data-responsive-wrapped])"
    );
    bareIframes.forEach((iframe) => {
      if (iframe.closest(".wp-block-embed__wrapper") || iframe.closest(".tin-embed")) return;
      iframe.setAttribute("data-responsive-wrapped", "1");
      const src = iframe.getAttribute("src") || "";
      const isVertical = /tiktok\.com|\/shorts\//.test(src);
      const wrap = document.createElement("div");
      wrap.className = "tin-embed";
      wrap.style.cssText = `position:relative;width:100%;margin:24px 0;aspect-ratio:${
        isVertical ? "9 / 16" : "16 / 9"
      };${isVertical ? "max-width:420px;margin-inline:auto;" : ""}`;
      iframe.parentNode.insertBefore(wrap, iframe);
      wrap.appendChild(iframe);
      iframe.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px;";
      iframe.removeAttribute("width");
      iframe.removeAttribute("height");
    });

    // Social widget SDKs
    const inject = (src, id) => {
      if (id && document.getElementById(id)) return;
      if (!id && document.querySelector(`script[src*="${src}"]`)) return;
      const s = document.createElement("script");
      s.src = src;
      if (id) s.id = id;
      s.async = true;
      if (src.includes("facebook")) s.crossOrigin = "anonymous";
      document.body.appendChild(s);
    };
    if (prose.querySelector(".twitter-tweet, .twitter-video"))
      inject("https://platform.twitter.com/widgets.js");
    if (prose.querySelector(".instagram-media")) {
      if (window.instgrm?.Embeds?.process) window.instgrm.Embeds.process();
      else inject("https://www.instagram.com/embed.js");
    }
    if (prose.querySelector("blockquote.tiktok-embed"))
      inject("https://www.tiktok.com/embed.js");
    if (prose.querySelector(".fb-post, .fb-video"))
      inject("https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0", "fb-sdk");

    return () => {
      tocLinks.forEach((a) => a.removeEventListener("click", onTocClick));
    };
  }, [rootSelector]);

  // Fallback: delegated document listener for any TOC anchor
  useEffect(() => {
    const onDocClick = (e) => {
      const a = e.target.closest && e.target.closest("a");
      if (!a) return;

      const inToc = a.closest(".ez-toc-container") || a.closest("#ez-toc-container");
      if (!inToc) return;

      // ---- A) Toggle / collapse button ---------------------------------
      const isToggle =
        a.classList.contains("ez-toc-toggle") ||
        a.classList.contains("ez-toc-pull-right") ||
        a.closest(".ez-toc-title-toggle");
      if (isToggle) {
        e.preventDefault();
        e.stopPropagation();
        inToc.classList.toggle("ez-toc-collapsed");
        return;
      }

      // ---- B) TOC heading link ----------------------------------------
      const href = a.getAttribute("href") || "";
      const hashIdx = href.indexOf("#");
      if (hashIdx < 0) return;

      let hash = href.slice(hashIdx + 1);
      if (!hash) return; // bare "#" with no id — ignore rather than scroll top

      let target = document.getElementById(hash);
      if (!target) {
        try { target = document.getElementById(decodeURIComponent(hash)); } catch {}
      }
      if (!target) {
        const linkText = a.textContent.trim();
        const prose = document.querySelector(".prose-news");
        if (prose) {
          const headings = Array.from(
            prose.querySelectorAll("h1, h2, h3, h4, h5, h6")
          ).filter((h) => !h.closest(".ez-toc-container"));
          target = headings.find((h) => h.textContent.trim() === linkText);
        }
      }
      if (!target) {
        // Still prevent the default jump-to-top on href="#..."
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const header = document.querySelector("header.sticky, header[class*='sticky']");
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const y = target.getBoundingClientRect().top + window.scrollY - headerH - 24;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      if (target.id) history.replaceState(null, "", `#${target.id}`);
    };
    document.addEventListener("click", onDocClick, true); // capture
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  return null;
}
