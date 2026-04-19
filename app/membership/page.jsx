import Link from "next/link";

export const metadata = {
  title: "Membership — ร่วมสนับสนุนวารสารศาสตร์คุณภาพ",
  description: "สมัครสมาชิก Premium Analysis · Donate · Member Benefits",
};

const PLANS = [
  {
    name: "Reader",
    price: "0",
    tag: "ฟรี",
    desc: "อ่านข่าวและบทวิเคราะห์ทั่วไปของเรา",
    features: ["ข่าวประจำวันแบบไม่จำกัด", "Newsletter รายสัปดาห์", "ติดตามคอลัมน์ทั่วไป"],
    cta: "เริ่มต้นอ่าน",
    href: "/",
    accent: false,
  },
  {
    name: "Insider",
    price: "149",
    tag: "ยอดนิยม",
    desc: "สำหรับผู้ที่ต้องการข่าวเชิงลึกเป็นประจำ",
    features: [
      "ทุกสิทธิของ Reader",
      "Premium Analysis รายสัปดาห์",
      "Podcast 'Inside Insight' แบบไม่มีโฆษณา",
      "เข้าถึงคลังรายงานพิเศษย้อนหลัง",
      "ส่วนลดงานอีเวนต์ 50%",
    ],
    cta: "เป็น Insider",
    href: "#",
    accent: true,
  },
  {
    name: "Patron",
    price: "499",
    tag: "สนับสนุนเต็มที่",
    desc: "สำหรับผู้ที่เชื่อมั่นในสื่ออิสระ",
    features: [
      "ทุกสิทธิของ Insider",
      "Briefing รายเดือนกับกอง บ.ก.",
      "เข้าร่วม Editorial Roundtable",
      "ขึ้นรายชื่อ Supporting Members",
      "Early access รายงานพิเศษ",
    ],
    cta: "เป็น Patron",
    href: "#",
    accent: false,
  },
];

const BENEFITS = [
  { t: "Premium Analysis", d: "บทวิเคราะห์เจาะลึกที่เขียนเฉพาะสำหรับสมาชิกเท่านั้น" },
  { t: "Ad-free Experience", d: "อ่านเว็บไซต์และฟังพ็อดแคสต์โดยไม่มีโฆษณาคั่น" },
  { t: "Members-only Events", d: "เวิร์กช็อป ดีเบต และ Editorial Roundtable" },
  { t: "Full Archive Access", d: "เข้าถึงคลังรายงาน สารคดี และ Data Stories" },
  { t: "Priority Response", d: "ทีมงานตอบกลับข้อเสนอแนะของคุณเป็นอันดับแรก" },
  { t: "Support Journalism", d: "ทุกบาทหล่อเลี้ยงห้องข่าวอิสระโดยตรง" },
];

export default function Membership() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand via-brand-600 to-brand-800 text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "linear-gradient(45deg, white 25%, transparent 25%, transparent 50%, white 50%, white 75%, transparent 75%)", backgroundSize: "4px 4px" }}
        />
        <div className="container-news relative py-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] backdrop-blur">
            ● Membership
          </span>
          <h1 className="headline mt-5 max-w-4xl text-5xl text-white md:text-7xl">
            สนับสนุนสื่ออิสระ<br />ที่ยึดมั่นในความจริง
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/90">
            เราไม่ได้อยู่ได้ด้วยอำนาจทางการเมืองหรือกลุ่มทุน แต่อยู่ได้ด้วยผู้อ่านเช่นคุณ
            ร่วมเป็นสมาชิกวันนี้ เพื่อหล่อเลี้ยงห้องข่าวที่ทำงานเพื่อสาธารณะอย่างแท้จริง
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#plans" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand hover:bg-white/90">
              เลือกแพ็กเกจ →
            </a>
            <a href="#donate" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-semibold hover:bg-white/10">
              บริจาคครั้งเดียว
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-black/5">
        <div className="container-news grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
          {[
            { k: "500+", v: "รายงานเชิงลึก" },
            { k: "100K+", v: "ผู้อ่านประจำเดือน" },
            { k: "0%", v: "อิทธิพลภายนอก" },
            { k: "100%", v: "เพื่อสาธารณะ" },
          ].map((s) => (
            <div key={s.v}>
              <div className="headline text-4xl text-brand md:text-5xl">{s.k}</div>
              <div className="mt-2 text-sm text-ink-muted">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="container-news py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="headline mt-2 text-3xl md:text-5xl">เลือกแพ็กเกจที่เหมาะกับคุณ</h2>
          <p className="mt-3 text-ink-muted">ยกเลิกได้ทุกเมื่อ · ไม่มีข้อผูกมัดระยะยาว</p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-8 transition hover:-translate-y-1 ${
                p.accent
                  ? "border-transparent bg-ink text-white shadow-[0_30px_80px_-30px_rgba(237,32,36,0.5)]"
                  : "border-black/10 bg-white"
              }`}
            >
              {p.accent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  {p.tag}
                </span>
              )}
              {!p.accent && (
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">{p.tag}</span>
              )}
              <h3 className={`headline mt-2 text-3xl ${p.accent ? "text-white" : ""}`}>{p.name}</h3>
              <p className={`mt-1 text-sm ${p.accent ? "text-white/70" : "text-ink-muted"}`}>{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className={`headline text-5xl ${p.accent ? "text-white" : ""}`}>฿{p.price}</span>
                <span className={`text-sm ${p.accent ? "text-white/60" : "text-ink-muted"}`}>/เดือน</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-start gap-3 ${p.accent ? "text-white/90" : ""}`}>
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${p.accent ? "bg-brand text-white" : "bg-brand/10 text-brand"}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={p.href}
                className={`mt-8 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold transition ${
                  p.accent
                    ? "bg-brand text-white hover:bg-brand-600"
                    : "bg-ink text-white hover:bg-brand"
                }`}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="bg-paper-warm py-20">
        <div className="container-news">
          <span className="eyebrow">Member Benefits</span>
          <h2 className="headline mt-2 text-3xl md:text-5xl">สิทธิประโยชน์ของสมาชิก</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <div key={b.t} className="group rounded-2xl border border-black/5 bg-white p-6 transition hover:border-brand/30 hover:shadow-card">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="headline mt-4 text-xl">{b.t}</h3>
                <p className="mt-2 text-sm text-ink-muted">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Donate + Newsletter */}
      <section id="donate" className="container-news py-20">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl bg-ink p-10 text-white">
            <span className="eyebrow text-brand-400">Donate</span>
            <h3 className="headline mt-3 text-3xl text-white">บริจาคครั้งเดียว</h3>
            <p className="mt-3 text-white/70">
              หากยังไม่พร้อมสมัครสมาชิกรายเดือน การบริจาคครั้งเดียวก็สำคัญและช่วยเราได้เสมอ
            </p>
            <div className="mt-6 grid grid-cols-4 gap-2">
              {["฿100", "฿300", "฿500", "฿1,000"].map((a) => (
                <button key={a} className="rounded-full border border-white/20 py-2 text-sm font-semibold hover:border-brand hover:bg-brand hover:text-white">
                  {a}
                </button>
              ))}
            </div>
            <button className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold hover:bg-brand-600">
              บริจาคเลย →
            </button>
          </div>
          <div id="newsletter" className="rounded-3xl border border-black/10 bg-white p-10">
            <span className="eyebrow">Newsletter</span>
            <h3 className="headline mt-3 text-3xl">รับ Insight Weekly</h3>
            <p className="mt-3 text-ink-muted">
              สรุปข่าวสำคัญและบทวิเคราะห์แห่งสัปดาห์ ส่งตรงถึงกล่องจดหมายของคุณทุกเช้าวันจันทร์ ฟรี
            </p>
            <form className="mt-6 flex gap-2">
              <input type="email" placeholder="you@email.com" className="h-12 flex-1 rounded-full border border-black/10 bg-paper-warm px-5 text-sm outline-none focus:border-brand" />
              <button className="inline-flex h-12 shrink-0 items-center rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-brand">
                สมัคร →
              </button>
            </form>
            <p className="mt-3 text-xs text-ink-muted">
              เราเคารพความเป็นส่วนตัวของคุณ ยกเลิกได้ทุกเมื่อ
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
