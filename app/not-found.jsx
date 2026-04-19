import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-news py-24 text-center">
      <span className="eyebrow">404</span>
      <h1 className="headline mt-3 text-5xl md:text-7xl">ไม่พบหน้าที่คุณค้นหา</h1>
      <p className="mt-4 text-ink-muted">อาจถูกย้าย ถูกลบ หรือยังไม่ได้เผยแพร่</p>
      <Link href="/" className="mt-8 inline-flex items-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">
        กลับหน้าแรก →
      </Link>
    </div>
  );
}
