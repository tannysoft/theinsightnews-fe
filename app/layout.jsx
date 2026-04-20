import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BreakingTicker from "@/components/BreakingTicker";
import CookieNotice from "@/components/CookieNotice";
import { SITE, absUrl, safeJsonLd } from "@/lib/site";

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE.url }],
  keywords: [
    "ข่าวเชิงลึก",
    "บทวิเคราะห์",
    "ข่าวการเมือง",
    "ข่าวเศรษฐกิจ",
    "Data Journalism",
    "Fact-Check",
    "Investigative Reporting",
    "The Insight News",
  ],
  referrer: "origin-when-cross-origin",
  creator: SITE.name,
  publisher: SITE.name,
  alternates: {
    canonical: SITE.url,
    types: {
      "application/rss+xml": [
        { url: "https://www.theinsightnews.co/feed", title: `${SITE.name} RSS` },
      ],
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.tagline,
    url: SITE.url,
    locale: SITE.locale,
    images: [{ url: absUrl(SITE.defaultOgImage), width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.tagline,
    creator: SITE.twitter,
    site: SITE.twitter,
    images: [absUrl(SITE.defaultOgImage)],
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export const viewport = {
  themeColor: "#ed2024",
  width: "device-width",
  initialScale: 1,
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": SITE.organizationType,
  name: SITE.name,
  alternateName: SITE.shortName,
  url: SITE.url,
  logo: absUrl(SITE.logo),
  description: SITE.description,
  foundingDate: SITE.foundingDate,
  sameAs: [
    `https://twitter.com/${SITE.twitter.replace(/^@/, "")}`,
    `https://www.facebook.com/${SITE.facebook}`,
    `https://www.youtube.com/@${SITE.facebook}`,
    `https://www.instagram.com/${SITE.facebook}`,
  ],
};

const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: SITE.url,
  inLanguage: "th-TH",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE.url}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600;700&display=swap"
        />
        <link rel="stylesheet" href="https://use.typekit.net/bqa0hwf.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(ORG_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(WEBSITE_JSONLD) }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        <BreakingTicker />
        <Header />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
        <CookieNotice />
      </body>
    </html>
  );
}
