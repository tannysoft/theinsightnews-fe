import Link from "next/link";

export default function SectionHeader({ eyebrow, title, description, href, actionLabel = "ดูทั้งหมด" }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="headline mt-1 text-2xl md:text-3xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-[12px] font-bold uppercase tracking-[0.18em] text-ink-muted transition hover:text-brand">
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}
