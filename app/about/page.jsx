import Link from "next/link";

export const metadata = {
  title: "About Us — รู้จัก The Insight News",
  description: "สำนักข่าวเชิงลึกที่ยึดมั่นในความจริง เพื่อประโยชน์สูงสุดของสังคม",
};

const PRINCIPLES = [
  { n: "01", t: "Truth Above All", d: "เราตรวจสอบข้อมูลจากหลายแหล่ง ยึดข้อเท็จจริงและความถูกต้องเป็นที่ตั้งในทุกรายงาน" },
  { n: "02", t: "Depth Over Noise", d: "เราไม่แข่งเร็ว แต่แข่งลึก ให้บริบทครบถ้วนและคำตอบที่คุ้มค่ากับเวลาอ่าน" },
  { n: "03", t: "Editorial Independence", d: "เราเป็นอิสระจากอิทธิพลทางการเมืองและธุรกิจ ผู้อ่านคือเจ้านายเพียงคนเดียวของเรา" },
  { n: "04", t: "Public Interest", d: "เป้าหมายของทุกบทความคือประโยชน์สูงสุดของสังคมและสาธารณะ" },
];

const TEAM_COLUMNS = [
  { t: "Editorial", d: "กองบรรณาธิการ ผู้สื่อข่าว นักวิเคราะห์ และผู้เชี่ยวชาญประจำกอง" },
  { t: "Expert Columns", d: "คอลัมนิสต์รับเชิญจากหลากหลายวงการที่ร่วมส่งมุมมอง" },
  { t: "Guest Opinions", d: "ผู้นำทางความคิดและผู้ปฏิบัติการจริงในอุตสาหกรรม" },
];

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 2px, transparent 2px)", backgroundSize: "32px 32px" }} />
        <div className="container-news relative py-24">
          <span className="eyebrow text-brand-400">● About Us</span>
          <h1 className="headline mt-4 max-w-4xl text-5xl text-white md:text-7xl md:leading-[1.15]">
            สร้างมาตรฐานใหม่<br />ของการนำเสนอข่าว
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/75">
            The Insight News คือศูนย์รวมข่าวสารเชิงลึกที่ยึดมั่นในความจริง
            เราเชื่อว่าสังคมประชาธิปไตยที่แข็งแรง ต้องมีพลเมืองที่ได้รับข้อมูลที่ถูกต้อง
            ครบถ้วน และมีบริบทเพียงพอต่อการตัดสินใจ
          </p>
        </div>
      </section>

      {/* Mission */}
      <section id="standards" className="container-news py-20">
        <div className="grid gap-12 md:grid-cols-[1fr,2fr]">
          <div>
            <span className="eyebrow">Editorial Standards</span>
            <h2 className="headline mt-2 text-3xl md:text-4xl">หลักการของเรา</h2>
            <p className="mt-4 text-sm text-ink-muted">
              4 หลักการที่เป็นรากฐานของทุกบรรทัดที่เราเขียน
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <article key={p.n} className="relative rounded-2xl border border-black/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-card">
                <span className="headline text-5xl font-black text-brand/20">{p.n}</span>
                <h3 className="headline mt-2 text-xl">{p.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{p.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline / Heritage */}
      <section className="bg-paper-warm py-20">
        <div className="container-news">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Heritage</span>
            <h2 className="headline mt-3 text-3xl md:text-4xl">ในจิตวิญญาณแห่งสื่อเสรี</h2>
            <p className="mt-5 text-ink-muted">
              เราก้าวเดินบนเส้นทางที่สืบทอดจิตวิญญาณของสื่อมวลชนที่กล้าหาญในประวัติศาสตร์ไทย
              ยึดถือเอกราชบรรณาธิการ และเชื่อว่าข่าวที่ดีต้องยืนอยู่ข้างประชาชน ไม่ใช่ข้างอำนาจ
            </p>
          </div>
          <div className="mt-12 grid gap-0 border-t border-black/10 md:grid-cols-3">
            {[
              { y: "Editorial", t: "กองบรรณาธิการอิสระ", d: "ทีมงานที่มีเสรีภาพในการเลือกประเด็นและมุมมองการรายงาน" },
              { y: "Data-driven", t: "ข้อมูลคือหัวใจ", d: "เราใช้ข้อมูลเชิงประจักษ์เป็นตัวตั้งในการวิเคราะห์และเล่าเรื่อง" },
              { y: "Reader-first", t: "ผู้อ่านคือศูนย์กลาง", d: "ทุกหน้าที่เราเขียน เราถามว่า 'ผู้อ่านจะได้อะไร' เสมอ" },
            ].map((c, i) => (
              <div key={c.t} className={`border-b border-black/10 p-8 md:border-b-0 ${i < 2 ? "md:border-r" : ""}`}>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">{c.y}</span>
                <h3 className="headline mt-3 text-2xl">{c.t}</h3>
                <p className="mt-3 text-sm text-ink-muted">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section id="careers" className="container-news py-20">
        <span className="eyebrow">Our Team</span>
        <h2 className="headline mt-2 text-3xl md:text-4xl">ทีมที่อยู่เบื้องหลังทุกบรรทัด</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TEAM_COLUMNS.map((c) => (
            <div key={c.t} className="rounded-2xl bg-ink p-8 text-white">
              <div className="mb-4 h-px w-10 bg-brand" />
              <h3 className="headline text-2xl text-white">{c.t}</h3>
              <p className="mt-3 text-sm text-white/70">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-black/5 bg-white">
        <div className="container-news grid gap-10 py-20 md:grid-cols-[1.2fr,1fr]">
          <div>
            <span className="eyebrow">Contact Us</span>
            <h2 className="headline mt-2 text-3xl md:text-5xl">พูดคุยกับเรา</h2>
            <p className="mt-4 max-w-md text-ink-muted">
              มีประเด็นข่าว ข้อมูลภายใน เบาะแส หรือข้อร้องเรียน
              กองบรรณาธิการพร้อมรับฟังและคุ้มครองแหล่งข่าวเป็นความลับ
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <div><span className="text-ink-muted">Newsroom: </span><a href="mailto:newsroom@theinsightnews.co" className="font-medium text-brand hover:underline">newsroom@theinsightnews.co</a></div>
              <div><span className="text-ink-muted">Tips: </span><a href="mailto:tips@theinsightnews.co" className="font-medium text-brand hover:underline">tips@theinsightnews.co</a></div>
              <div><span className="text-ink-muted">Partnerships: </span><a href="mailto:biz@theinsightnews.co" className="font-medium text-brand hover:underline">biz@theinsightnews.co</a></div>
            </div>
          </div>
          <form className="space-y-3 rounded-2xl border border-black/10 bg-paper-warm p-6">
            <input className="h-11 w-full rounded-md border border-black/10 bg-white px-4 text-sm outline-none focus:border-brand" placeholder="ชื่อของคุณ" />
            <input className="h-11 w-full rounded-md border border-black/10 bg-white px-4 text-sm outline-none focus:border-brand" placeholder="อีเมล" type="email" />
            <textarea rows={5} className="w-full rounded-md border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-brand" placeholder="ข้อความ..." />
            <button type="button" className="h-11 w-full rounded-md bg-ink text-sm font-semibold text-white hover:bg-brand">ส่งข้อความ</button>
          </form>
        </div>
      </section>
    </div>
  );
}
