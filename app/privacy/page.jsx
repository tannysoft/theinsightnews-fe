import Link from "next/link";
import { SITE, absUrl } from "@/lib/site";

export const metadata = {
  title: "นโยบายความเป็นส่วนตัว",
  description:
    "นโยบายความเป็นส่วนตัวของ The Insight News — เราเก็บรวบรวม ใช้ และปกป้องข้อมูลของคุณอย่างไร",
  alternates: { canonical: absUrl("/privacy") },
};

const LAST_UPDATED = "1 เมษายน 2569";

const SECTIONS = [
  { id: "overview", title: "ภาพรวม" },
  { id: "data-we-collect", title: "ข้อมูลที่เราเก็บรวบรวม" },
  { id: "how-we-use", title: "วิธีที่เราใช้ข้อมูล" },
  { id: "cookies", title: "คุกกี้และเทคโนโลยีติดตาม" },
  { id: "sharing", title: "การเปิดเผยข้อมูลต่อบุคคลที่สาม" },
  { id: "retention", title: "ระยะเวลาเก็บรักษาข้อมูล" },
  { id: "security", title: "ความปลอดภัยของข้อมูล" },
  { id: "rights", title: "สิทธิของคุณ" },
  { id: "children", title: "ข้อมูลของผู้เยาว์" },
  { id: "international", title: "การโอนข้อมูลข้ามประเทศ" },
  { id: "changes", title: "การเปลี่ยนแปลงนโยบาย" },
  { id: "contact", title: "ติดต่อเรา" },
];

export default function PrivacyPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-black/5 bg-ink text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="container-news relative py-14 md:py-20">
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
            <Link href="/" className="hover:text-brand-400">Home</Link>
            <span>·</span>
            <span>Legal</span>
          </div>
          <h1 className="headline mt-5 text-4xl text-white md:text-6xl">
            นโยบายความเป็นส่วนตัว
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/75 md:text-lg">
            เราให้ความสำคัญกับความเป็นส่วนตัวของคุณ เอกสารนี้อธิบายว่า{" "}
            {SITE.name} เก็บรวบรวม ใช้ และปกป้องข้อมูลของคุณอย่างไร
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
            อัปเดตล่าสุด: {LAST_UPDATED}
          </div>
        </div>
      </section>

      <div className="container-news py-12">
        <div className="mx-auto grid max-w-[1160px] gap-14 lg:grid-cols-[240px,minmax(0,1fr)]">
          {/* TOC */}
          <aside className="lg:sticky lg:top-[180px] lg:self-start">
            <span className="eyebrow">Contents</span>
            <nav className="mt-3">
              <ol className="divide-y divide-black/5">
                {SECTIONS.map((s, i) => (
                  <li key={s.id} className="py-2">
                    <a
                      href={`#${s.id}`}
                      className="group flex items-start gap-3 text-sm text-ink/80 transition hover:text-brand"
                    >
                      <span className="mt-0.5 shrink-0 text-[11px] font-bold tabular-nums text-brand/40 group-hover:text-brand">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          {/* Content */}
          <article className="prose-news" style={{ fontFamily: "var(--font-content)" }}>
            <Section id="overview" n={1} title="ภาพรวม">
              <p>
                {SITE.name} (“เรา”, “ของเรา”) เป็นสำนักข่าวออนไลน์ที่ให้ความสำคัญกับความเป็นส่วนตัวของผู้ใช้งาน
                เอกสารฉบับนี้อธิบายประเภทของข้อมูลที่เราเก็บรวบรวม
                วิธีที่เราใช้และปกป้องข้อมูล รวมถึงสิทธิของคุณในฐานะ
                <strong>เจ้าของข้อมูลส่วนบุคคล</strong>
                ภายใต้<strong>พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</strong>
              </p>
              <p>
                {SITE.name} ทำหน้าที่เป็น “ผู้ควบคุมข้อมูลส่วนบุคคล” (Data Controller)
                ตามความหมายของ PDPA การเข้าใช้งานเว็บไซต์ของเราแสดงว่าคุณรับทราบและยอมรับแนวทางที่ระบุไว้ในนโยบายนี้
              </p>
            </Section>

            <Section id="data-we-collect" n={2} title="ข้อมูลที่เราเก็บรวบรวม">
              <p>เราเก็บข้อมูลจาก 3 แหล่งหลัก:</p>
              <h3>1. ข้อมูลที่คุณให้กับเราโดยตรง</h3>
              <ul>
                <li>อีเมลเมื่อสมัครรับจดหมายข่าว หรือสมัครสมาชิก</li>
                <li>ชื่อ ที่อยู่อีเมล และข้อความเมื่อติดต่อกองบรรณาธิการ</li>
                <li>ข้อมูลการชำระเงินเมื่อสนับสนุนเรา (ผ่านผู้ให้บริการรายย่อย เราไม่เก็บข้อมูลบัตรโดยตรง)</li>
              </ul>
              <h3>2. ข้อมูลที่รวบรวมอัตโนมัติ</h3>
              <ul>
                <li>IP address, ชนิดเบราว์เซอร์, ระบบปฏิบัติการ, referrer URL</li>
                <li>เวลาที่เข้าชม, หน้าที่เข้าชม, ระยะเวลาอ่าน</li>
                <li>ข้อมูลอุปกรณ์และการตั้งค่าภาษา</li>
              </ul>
              <h3>3. คุกกี้</h3>
              <p>
                ดูรายละเอียดในหัวข้อ{" "}
                <a href="#cookies" className="font-semibold">คุกกี้และเทคโนโลยีติดตาม</a>
              </p>
            </Section>

            <Section id="how-we-use" n={3} title="วิธีที่เราใช้ข้อมูลและฐานทางกฎหมาย">
              <p>เราประมวลผลข้อมูลของคุณเพื่อวัตถุประสงค์ต่อไปนี้ โดยอาศัยฐานทางกฎหมายตาม PDPA มาตรา 24:</p>
              <ul>
                <li>
                  <strong>ส่งจดหมายข่าวและเนื้อหาทางการตลาด</strong> —
                  ฐาน<em>ความยินยอม</em> (Consent) มาตรา 19
                </li>
                <li>
                  <strong>ปรับปรุงคุณภาพเนื้อหาและวิเคราะห์การใช้งาน</strong> —
                  ฐาน<em>ประโยชน์โดยชอบด้วยกฎหมาย</em> (Legitimate Interest) มาตรา 24(5)
                </li>
                <li>
                  <strong>ตอบกลับข้อความ/ข้อร้องเรียน และประมวลผลสมาชิก</strong> —
                  ฐาน<em>สัญญา</em> (Contract) มาตรา 24(3)
                </li>
                <li>
                  <strong>ป้องกันการโจมตีและรักษาความปลอดภัยของระบบ</strong> —
                  ฐาน<em>ประโยชน์อันจำเป็นเพื่อการรักษาความปลอดภัย</em> มาตรา 24(4)
                </li>
                <li>
                  <strong>ปฏิบัติตามข้อกำหนดทางกฎหมาย</strong> —
                  ฐาน<em>การปฏิบัติตามกฎหมาย</em> (Legal Obligation) มาตรา 24(6)
                </li>
                <li>
                  <strong>รายงานข่าวเพื่อประโยชน์สาธารณะ</strong> —
                  ฐาน<em>ประโยชน์สาธารณะและเสรีภาพสื่อมวลชน</em> มาตรา 4(3)
                  (ข้อยกเว้นสำหรับการสื่อมวลชน)
                </li>
              </ul>
              <p>
                เราจะ<strong>ไม่ใช้ข้อมูล</strong>ของคุณเพื่อวัตถุประสงค์อื่นนอกเหนือจากที่ระบุไว้ข้างต้น
                เว้นแต่จะได้รับความยินยอมเพิ่มเติม หรือมีฐานทางกฎหมายรองรับ
              </p>
            </Section>

            <Section id="cookies" n={4} title="คุกกี้และเทคโนโลยีติดตาม">
              <p>
                คุกกี้คือไฟล์ข้อความขนาดเล็กที่เว็บไซต์เก็บไว้ในเบราว์เซอร์ของคุณ
                เราใช้คุกกี้ 3 ประเภท:
              </p>
              <div className="not-prose my-6 overflow-hidden rounded-xl border border-black/10">
                <CookieRow
                  title="คุกกี้จำเป็น (Necessary)"
                  status="เปิดเสมอ"
                  desc="จำเป็นสำหรับฟังก์ชันพื้นฐาน เช่น การจดจำการตั้งค่าคุกกี้ เซสชันผู้ใช้ ไม่สามารถปิดได้"
                />
                <CookieRow
                  title="คุกกี้วิเคราะห์ (Analytics)"
                  status="ต้องการความยินยอม"
                  desc="ช่วยให้เราเข้าใจว่าผู้อ่านใช้งานเว็บไซต์อย่างไร เพื่อปรับปรุงเนื้อหา เช่น Google Analytics"
                />
                <CookieRow
                  title="คุกกี้การตลาด (Marketing)"
                  status="ต้องการความยินยอม"
                  desc="ใช้เพื่อติดตามประสิทธิภาพแคมเปญและแสดงเนื้อหาที่เกี่ยวข้องในแพลตฟอร์มอื่น"
                />
              </div>
              <p>
                คุณสามารถจัดการความยินยอมได้ทุกเมื่อผ่านแบนเนอร์คุกกี้
                (คลิกไอคอนเฟืองในแบนเนอร์) หรือปรับการตั้งค่าในเบราว์เซอร์ของคุณโดยตรง
                โปรดทราบว่าการปิดคุกกี้บางประเภทอาจส่งผลให้บางฟีเจอร์ไม่ทำงาน
              </p>
            </Section>

            <Section id="sharing" n={5} title="การเปิดเผยข้อมูลต่อบุคคลที่สาม">
              <p>
                เราจะ<strong>ไม่ขาย</strong>ข้อมูลส่วนบุคคลของคุณ
                เราอาจเปิดเผยข้อมูลเฉพาะกับ:
              </p>
              <ul>
                <li>
                  <strong>ผู้ให้บริการที่ไว้วางใจ</strong> —
                  เช่น ผู้ให้บริการโฮสติ้ง วิเคราะห์ข้อมูล อีเมลมาร์เก็ตติ้ง ระบบรับชำระเงิน
                  โดยผู้ให้บริการเหล่านี้ต้องปฏิบัติตามสัญญาเก็บรักษาข้อมูล
                </li>
                <li>
                  <strong>หน่วยงานรัฐ</strong> — เมื่อกฎหมายกำหนด เช่น คำสั่งศาล
                  การสืบสวนอาชญากรรม
                </li>
                <li>
                  <strong>ผู้รับโอนกิจการ</strong> — กรณีมีการควบรวมหรือเข้าซื้อกิจการ
                  เราจะแจ้งให้คุณทราบล่วงหน้า
                </li>
              </ul>
            </Section>

            <Section id="retention" n={6} title="ระยะเวลาเก็บรักษาข้อมูล">
              <ul>
                <li>อีเมล newsletter: จนกว่าคุณจะยกเลิกการรับ</li>
                <li>ข้อความจากฟอร์มติดต่อ: 2 ปี</li>
                <li>ข้อมูลสมาชิก: ตราบเท่าที่บัญชียังใช้งาน</li>
                <li>Log การเข้าใช้งาน: 90 วัน</li>
                <li>ข้อมูลการชำระเงิน: ตามที่กฎหมายภาษีกำหนด (5-7 ปี)</li>
              </ul>
            </Section>

            <Section id="security" n={7} title="ความปลอดภัยของข้อมูล">
              <p>
                เราใช้มาตรการทางเทคนิคและองค์กรที่เหมาะสมเพื่อปกป้องข้อมูล:
                การเข้ารหัส HTTPS ตลอดการเชื่อมต่อ, การควบคุมการเข้าถึงข้อมูล,
                การสำรองข้อมูลอย่างสม่ำเสมอ, การตรวจสอบความปลอดภัยเป็นระยะ
              </p>
              <p>
                อย่างไรก็ตาม ไม่มีวิธีการส่งข้อมูลทางอินเทอร์เน็ตใดที่ปลอดภัย 100%
                เราพยายามใช้มาตรฐานอุตสาหกรรมที่ดีที่สุดแต่ไม่สามารถรับประกันความปลอดภัยได้อย่างสมบูรณ์
              </p>
            </Section>

            <Section id="rights" n={8} title="สิทธิของเจ้าของข้อมูลตาม PDPA">
              <p>ในฐานะเจ้าของข้อมูลส่วนบุคคล คุณมีสิทธิดังต่อไปนี้ตาม PDPA หมวด 3:</p>
              <ul>
                <li>
                  <strong>สิทธิในการเข้าถึงและขอสำเนาข้อมูล</strong> (มาตรา 30) —
                  ขอสำเนาข้อมูลส่วนบุคคลที่เรามีเกี่ยวกับคุณ
                </li>
                <li>
                  <strong>สิทธิในการขอแก้ไขข้อมูล</strong> (มาตรา 35 ประกอบมาตรา 36) —
                  ขอให้แก้ไขข้อมูลที่ไม่ถูกต้องหรือไม่เป็นปัจจุบัน
                </li>
                <li>
                  <strong>สิทธิในการขอลบ ทำลาย หรือทำให้ข้อมูลไม่สามารถระบุตัวบุคคลได้</strong> (มาตรา 33) —
                  เมื่อข้อมูลหมดความจำเป็นหรือถอนความยินยอม
                </li>
                <li>
                  <strong>สิทธิในการขอระงับการใช้ข้อมูล</strong> (มาตรา 34) —
                  ขอให้เราระงับการประมวลผลเป็นการชั่วคราว
                </li>
                <li>
                  <strong>สิทธิในการคัดค้านการประมวลผลข้อมูล</strong> (มาตรา 32) —
                  โดยเฉพาะการประมวลผลเพื่อการตลาดตรง
                </li>
                <li>
                  <strong>สิทธิในการขอรับและโอนย้ายข้อมูล</strong> (มาตรา 31) —
                  รับข้อมูลในรูปแบบที่อ่านได้โดยอัตโนมัติ และขอให้โอนไปยังผู้ควบคุมข้อมูลรายอื่น
                </li>
                <li>
                  <strong>สิทธิในการถอนความยินยอม</strong> (มาตรา 19 วรรคห้า) —
                  เมื่อใดก็ได้ที่ประมวลผลโดยฐานความยินยอม
                </li>
                <li>
                  <strong>สิทธิในการร้องเรียน</strong> (มาตรา 73) —
                  ต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)
                  หากเห็นว่าเราฝ่าฝืน PDPA
                </li>
              </ul>
              <p>
                ส่งคำขอใช้สิทธิของคุณมาที่{" "}
                <a href="mailto:privacy@theinsightnews.co" className="font-semibold">
                  privacy@theinsightnews.co
                </a>{" "}
                เราจะพิจารณาและตอบกลับภายใน <strong>30 วัน</strong> นับแต่วันที่ได้รับคำขอ
                ตามมาตรา 30 วรรคสาม
              </p>
            </Section>

            <Section id="children" n={9} title="ข้อมูลของผู้เยาว์">
              <p>
                เว็บไซต์ของเราไม่ได้ออกแบบมาเพื่อเด็กอายุต่ำกว่า 13 ปี
                เราจะไม่เก็บข้อมูลส่วนบุคคลของเด็กโดยเจตนา
                หากคุณเป็นผู้ปกครองและพบว่าบุตรของคุณได้ให้ข้อมูลส่วนบุคคลกับเรา
                โปรดติดต่อเราเพื่อลบข้อมูลดังกล่าว
              </p>
            </Section>

            <Section id="international" n={10} title="การส่งหรือโอนข้อมูลไปต่างประเทศ">
              <p>
                เมื่อเราจำเป็นต้องส่งหรือโอนข้อมูลส่วนบุคคลไปยังต่างประเทศ (เช่น
                บริการคลาวด์/อีเมลที่เซิร์ฟเวอร์อยู่ต่างประเทศ) เราจะดำเนินการตาม
                <strong>มาตรา 28 ของ PDPA</strong> โดยส่งไปยังประเทศปลายทางหรือองค์การระหว่างประเทศ
                ที่มีมาตรฐานการคุ้มครองข้อมูลส่วนบุคคลที่เพียงพอตามที่
                คณะกรรมการคุ้มครองข้อมูลส่วนบุคคลประกาศกำหนด
                หรือจัดให้มีมาตรการคุ้มครองที่เหมาะสม เช่น
                ข้อสัญญามาตรฐาน (Data Processing Agreement) ระหว่างเรากับผู้รับข้อมูล
              </p>
            </Section>

            <Section id="changes" n={11} title="การเปลี่ยนแปลงนโยบาย">
              <p>
                เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว
                เมื่อมีการเปลี่ยนแปลงที่มีนัยสำคัญเราจะแจ้งให้ทราบผ่านแบนเนอร์บนเว็บไซต์หรืออีเมล
                วันที่อัปเดตล่าสุดจะแสดงที่ด้านบนของหน้านี้
              </p>
            </Section>

            <Section id="contact" n={12} title="ติดต่อผู้ควบคุมข้อมูล / DPO">
              <p>
                หากมีคำถามเกี่ยวกับนโยบายนี้ หรือต้องการใช้สิทธิของคุณตาม PDPA
                สามารถติดต่อ
                <strong>เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล</strong>{" "}
                (Data Protection Officer — DPO) ของเราได้ที่:
              </p>
              <div className="not-prose mt-4 rounded-xl border border-black/10 bg-paper-warm p-5">
                <div className="text-sm">
                  <div>
                    <span className="text-ink-muted">ผู้ควบคุมข้อมูลส่วนบุคคล: </span>
                    <span className="font-semibold text-ink">{SITE.name}</span>
                  </div>
                  <div className="mt-1.5">
                    <span className="text-ink-muted">DPO อีเมล: </span>
                    <a href="mailto:privacy@theinsightnews.co" className="font-semibold text-brand hover:underline">
                      privacy@theinsightnews.co
                    </a>
                  </div>
                  <div className="mt-1.5">
                    <span className="text-ink-muted">กองบรรณาธิการ: </span>
                    <a href="mailto:newsroom@theinsightnews.co" className="font-semibold text-brand hover:underline">
                      newsroom@theinsightnews.co
                    </a>
                  </div>
                </div>
              </div>
            </Section>
          </article>
        </div>
      </div>
    </div>
  );
}

function Section({ id, n, title, children }) {
  return (
    <section id={id} className="scroll-mt-[180px] border-t border-black/5 pt-10 first:border-t-0 first:pt-0">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="headline text-3xl font-black text-brand/30 tabular-nums">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="headline text-2xl text-ink md:text-3xl" style={{ margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function CookieRow({ title, status, desc }) {
  return (
    <div className="border-b border-black/5 p-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-ink" style={{ margin: 0 }}>
          {title}
        </h4>
        <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
          {status}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted" style={{ margin: "0.375rem 0 0 0" }}>
        {desc}
      </p>
    </div>
  );
}
