"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";

// Must match CookieNotice.jsx
const STORAGE_KEY = "tin-cookie-consent-v1";
const EXPIRY_DAYS = 180;

function readConsent() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v?.timestamp) return null;
    const age = (Date.now() - v.timestamp) / 86_400_000;
    if (age > EXPIRY_DAYS) return null;
    return v;
  } catch {
    return null;
  }
}

export default function Analytics() {
  // null = still reading client-side state. We can't know the real answer
  // until after hydration because consent lives in localStorage.
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    const existing = readConsent();
    // Default posture: cookies on. Only flip off when the user has
    // explicitly rejected analytics via the cookie panel.
    setAllowed(existing?.analytics === false ? false : true);

    const onConsent = (e) => {
      const ok = e.detail?.analytics !== false;
      setAllowed(ok);
      // Kill-switch recognized by gtag.js — any queued or future events
      // are dropped once this flag is set.
      if (typeof window !== "undefined" && SITE.gaId) {
        window[`ga-disable-${SITE.gaId}`] = !ok;
      }
    };
    window.addEventListener("tin:consent", onConsent);
    return () => window.removeEventListener("tin:consent", onConsent);
  }, []);

  if (process.env.NODE_ENV !== "production") return null;
  if (!SITE.gaId) return null;
  if (!allowed) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${SITE.gaId}');
        `}
      </Script>
    </>
  );
}
