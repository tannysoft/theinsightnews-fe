"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

function writeConsent(consent) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...consent, timestamp: Date.now() })
    );
  } catch {}
  // Notify downstream listeners (analytics, etc.)
  window.dispatchEvent(new CustomEvent("tin:consent", { detail: consent }));
}

const DEFAULT = {
  necessary: true, // always on
  analytics: false,
  marketing: false,
};

export default function CookieNotice() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT);

  useEffect(() => {
    setMounted(true);
    const existing = readConsent();
    if (!existing) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    } else {
      setPrefs({ ...DEFAULT, ...existing });
    }
  }, []);

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 350);
  };

  const acceptAll = () => {
    const c = { necessary: true, analytics: true, marketing: true };
    setPrefs(c);
    writeConsent(c);
    dismiss();
  };

  const rejectAll = () => {
    const c = { necessary: true, analytics: false, marketing: false };
    setPrefs(c);
    writeConsent(c);
    dismiss();
  };

  const savePreferences = () => {
    writeConsent(prefs);
    dismiss();
  };

  if (!mounted || !open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] p-3 md:bottom-4 md:left-auto md:right-4 md:inset-x-auto md:p-0"
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
    >
      <div
        className={`mx-auto max-w-[560px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)] will-change-transform md:ml-auto md:mr-0 ${
          closing ? "animate-cookie-out" : "animate-cookie-in"
        }`}
      >
        <div className="p-3">
          <div className="flex items-center gap-3">
            <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/30 [animation-duration:2.6s]" />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="relative origin-center animate-cookie-wiggle"
              >
                <path d="M12 2a10 10 0 0 0-9.94 8.88.76.76 0 0 0 1.1.76 3 3 0 0 1 4.22 2.52.76.76 0 0 0 1.17.62 2.5 2.5 0 0 1 3.9 2.3.76.76 0 0 0 1.2.62 3 3 0 0 1 4.62 3 .76.76 0 0 0 .94.83A10 10 0 0 0 12 2Z" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="9" cy="8" r="0.9" fill="currentColor"/>
                <circle cx="14" cy="11" r="1" fill="currentColor"/>
                <circle cx="8" cy="14" r="0.9" fill="currentColor"/>
              </svg>
            </span>

            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[12.5px] text-ink">เราใช้คุกกี้เพื่อประสบการณ์การใช้งานให้ดียิ่งขึ้น</p>
              <Link
                href="/privacy"
                className="mt-0.5 inline-block text-[12.5px] font-semibold text-brand underline-offset-4 hover:underline"
              >
                นโยบายความเป็นส่วนตัว
              </Link>
            </div>

            <button
              onClick={() => setShowDetails((v) => !v)}
              aria-label={showDetails ? "ซ่อนการตั้งค่าคุกกี้" : "ตั้งค่าคุกกี้"}
              aria-expanded={showDetails}
              className="group inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 text-ink-muted transition hover:border-brand hover:text-brand"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className={`transition duration-500 group-hover:rotate-90 ${
                  showDetails ? "rotate-45 text-brand" : ""
                }`}
              >
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button
              onClick={acceptAll}
              className="inline-flex h-9 shrink-0 items-center rounded-full bg-brand px-4 text-xs font-semibold text-white transition hover:bg-brand-600"
            >
              ยอมรับทั้งหมด
            </button>
          </div>

          {showDetails && (
            <div className="mt-3 origin-top animate-detail-in divide-y divide-black/5 overflow-hidden rounded-lg border border-black/10">
              <CookieToggle title="จำเป็น" checked disabled />
              <CookieToggle
                title="Analytics"
                checked={prefs.analytics}
                onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
              />
              <CookieToggle
                title="Marketing"
                checked={prefs.marketing}
                onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
              />
              <div className="flex justify-end bg-paper-warm p-2">
                <button
                  onClick={savePreferences}
                  className="inline-flex h-8 items-center rounded-full bg-ink px-4 text-[11px] font-semibold text-white transition hover:bg-brand"
                >
                  บันทึกที่เลือก
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CookieToggle({ title, checked, onChange, disabled }) {
  return (
    <label
      className={`flex items-center justify-between gap-3 px-3 py-2 ${
        disabled ? "opacity-70" : "cursor-pointer"
      }`}
    >
      <span className="text-xs font-semibold text-ink">{title}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          checked ? "bg-brand" : "bg-black/15"
        } ${disabled ? "cursor-not-allowed" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onChange && onChange(!checked)}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}
