import Link from "next/link";

export const metadata = {
  title: "Membership — เร็วๆ นี้",
  description: "ระบบสมาชิก Premium Analysis และการสนับสนุนกำลังจะเปิดเร็วๆ นี้",
};

export default function Membership() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand via-brand-600 to-brand-800 text-white">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(45deg, white 25%, transparent 25%, transparent 50%, white 50%, white 75%, transparent 75%)",
          backgroundSize: "4px 4px",
        }}
      />
      <div className="container-news relative flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] backdrop-blur">
          ● Membership
        </span>
        <h1 className="headline mt-5 max-w-3xl text-5xl text-white md:text-7xl md:leading-[1.15]">
          เร็วๆ นี้
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/90">
          ระบบสมาชิกและแพ็กเกจสนับสนุนของเรากำลังอยู่ระหว่างการจัดเตรียม
          ในระหว่างนี้คุณสามารถติดตามข่าวและบทวิเคราะห์ของเราได้ฟรี
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-brand hover:bg-white/90"
          >
            กลับสู่หน้าแรก →
          </Link>
          <Link
            href="/about"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-semibold hover:bg-white/10"
          >
            เกี่ยวกับเรา
          </Link>
        </div>
      </div>
    </section>
  );
}
