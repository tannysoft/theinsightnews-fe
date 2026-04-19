import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BreakingTicker from "@/components/BreakingTicker";

export const metadata = {
  title: {
    default: "The Insight News — ศูนย์รวมข่าวสารเชิงลึก ที่ยึดมั่นในความจริง",
    template: "%s · The Insight News",
  },
  description:
    "The Insight News — สร้างมาตรฐานใหม่ของการนำเสนอข้อมูลข่าวสารเชิงลึก วิเคราะห์เจาะประเด็น ด้วยความเป็นกลางและยึดมั่นในความจริง เพื่อประโยชน์สูงสุดของสังคม",
  openGraph: {
    title: "The Insight News",
    description: "ศูนย์รวมข่าวสารเชิงลึก ที่ยึดมั่นในความจริง",
    type: "website",
    locale: "th_TH",
  },
  icons: {
    icon: "/logo.svg",
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
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@300;400;500;600;700&family=Inter+Tight:wght@400;500;600;700;800&display=swap"
        />
        <link rel="stylesheet" href="https://use.typekit.net/bqa0hwf.css" />
      </head>
      <body className="min-h-screen flex flex-col">
        <BreakingTicker />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
