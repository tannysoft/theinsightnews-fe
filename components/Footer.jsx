import Link from "next/link";
import Logo from "./Logo";
import SocialIcons from "./SocialIcons";

const COLS = [
  {
    title: "Sections",
    links: [
      { label: "Home", href: "/" },
      { label: "Insight Analysis", href: "/insight-analysis" },
      { label: "Special Reports", href: "/special-reports" },
      { label: "Opinion", href: "/opinion" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Editorial Standards", href: "/about#standards" },
      { label: "Contact Us", href: "/about#contact" },
      { label: "Careers", href: "/about#careers" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Become a Member", href: "/membership" },
      { label: "Donate", href: "/membership#donate" },
      { label: "Member Benefits", href: "/membership#benefits" },
      { label: "Newsletter", href: "/membership#newsletter" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="container-news py-14">
        {/* Newsletter */}
        <div className="mb-12 grid items-center gap-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-8 md:grid-cols-[1.3fr,1fr] md:p-12">
          <div>
            <span className="eyebrow text-brand-400">Newsletter</span>
            <h3 className="headline mt-2 text-2xl text-white md:text-3xl">
              รับข่าวเชิงลึกก่อนใคร ทุกเช้าวันจันทร์
            </h3>
            <p className="mt-2 max-w-md text-sm text-white/70">
              สรุปข่าว–บทวิเคราะห์ที่ยึดมั่นในความจริง ส่งตรงถึงกล่องจดหมายของคุณ ฟรี
            </p>
          </div>
          <form className="flex gap-2" action="#">
            <input
              type="email"
              required
              placeholder="you@email.com"
              className="h-12 flex-1 rounded-full border border-white/20 bg-white/5 px-5 text-sm outline-none placeholder:text-white/50 focus:border-brand"
            />
            <button className="inline-flex h-12 shrink-0 items-center rounded-full bg-brand px-6 text-sm font-semibold hover:bg-brand-600">
              Subscribe →
            </button>
          </form>
        </div>

        <div className="grid gap-10 md:grid-cols-[1.4fr,1fr,1fr,1fr]">
          <div>
            <Logo variant="light" height={56} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              ศูนย์รวมข่าวสารเชิงลึก ที่ยึดมั่นในความจริง
              สร้างมาตรฐานใหม่ของการนำเสนอข้อมูลข่าวสาร เพื่อประโยชน์สูงสุดของสังคม
            </p>
            <div className="mt-5">
              <SocialIcons
                platforms={["x", "facebook", "youtube", "instagram", "tiktok", "line"]}
                variant="solid"
                size={36}
                iconSize={15}
              />
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-white/80 hover:text-brand">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-news flex flex-col items-start justify-between gap-3 py-5 text-xs text-white/50 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} The Insight News. All rights reserved.</p>
          <p>
            Built with integrity · ยืนหยัดในความจริงและความถูกต้อง
          </p>
        </div>
      </div>
    </footer>
  );
}
