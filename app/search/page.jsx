import Link from "next/link";
import { getPosts } from "@/lib/api";
import { NewsCard } from "@/components/NewsCard";

export const revalidate = 60;

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  return {
    title: sp?.q ? `ค้นหา: ${sp.q}` : "ค้นหา",
    description: "ค้นหาข่าวเชิงลึก บทวิเคราะห์ และรายงานพิเศษจาก The Insight News",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }) {
  const sp = await searchParams;
  const q = (sp?.q || "").toString().trim();
  const { posts, total } = q ? await getPosts({ search: q, perPage: 18 }) : { posts: [], total: 0 };

  return (
    <div className="container-news py-14">
      <span className="eyebrow">Search</span>
      <h1 className="headline mt-2 text-3xl md:text-5xl">
        {q ? <>ผลการค้นหา: <span className="text-brand">"{q}"</span></> : "ค้นหาข่าว"}
      </h1>

      <form action="/search" className="mt-6 flex max-w-2xl gap-2">
        <input name="q" defaultValue={q} placeholder="พิมพ์คำค้นหา..." className="h-12 flex-1 rounded-full border border-black/10 bg-white px-5 text-sm outline-none focus:border-brand" />
        <button className="h-12 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-brand">ค้นหา</button>
      </form>

      {q && (
        <p className="mt-4 text-sm text-ink-muted">พบ {total} บทความ</p>
      )}

      {q && posts.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-black/15 bg-paper-warm p-12 text-center">
          <p className="text-lg">ไม่พบบทความที่ตรงกับ "{q}"</p>
          <p className="mt-2 text-sm text-ink-muted">ลองค้นหาด้วยคำอื่น หรือกลับสู่หน้าแรก</p>
          <Link href="/" className="mt-6 inline-flex rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-brand">
            กลับหน้าแรก
          </Link>
        </div>
      )}

      {posts.length > 0 && (
        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <NewsCard key={p.id} post={p} size="md" />
          ))}
        </div>
      )}
    </div>
  );
}
