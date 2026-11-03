import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import { WEB_URL } from '../../lib/env'
import { RecoveryActions } from './ImageRecoveryActions'

type Rec = {
  id: number
  post: { id: number; title: string; slug: string } | number
  originalSrc: string
  candidateUrl?: string | null
  source?: string | null
  archivedAt?: string | null
  caption?: string | null
  context?: string | null
  status: 'pending' | 'approved' | 'rejected' | 'removed'
  media?: { url?: string } | number | null
}

const STATUS: Record<Rec['status'], { label: string; color: string }> = {
  pending: { label: 'รอตรวจ', color: '#b45309' },
  approved: { label: 'ใช้รูปนี้แล้ว', color: '#15803d' },
  rejected: { label: 'ไม่ใช่รูปนี้', color: '#6b7280' },
  removed: { label: 'ลบรูปออกจากข่าวแล้ว', color: '#6b7280' },
}

const FILTERS = [
  { key: 'pending', label: 'รอตรวจ' },
  { key: 'all', label: 'ทั้งหมด' },
] as const

/** /admin/image-recovery — editors confirm images found for broken story images. */
export async function ImageRecoveryView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult
  const role = (req.user as { role?: string } | null)?.role
  const filter = searchParams?.show === 'all' ? 'all' : 'pending'

  let body: React.ReactNode
  if (!req.user || !['admin', 'editor'].includes(role ?? '')) {
    body = <p>หน้านี้สำหรับบรรณาธิการและผู้ดูแลระบบ</p>
  } else {
    const { docs } = await req.payload.find({
      collection: 'image-recoveries',
      where: filter === 'pending' ? { status: { equals: 'pending' } } : {},
      sort: ['post', 'id'],
      limit: 500,
      depth: 1,
      req,
    })
    const counts = await Promise.all(
      (['pending', 'approved', 'rejected', 'removed'] as const).map(async (s) => {
        const { totalDocs } = await req.payload.count({ collection: 'image-recoveries', where: { status: { equals: s } }, req })
        return [s, totalDocs] as const
      }),
    )
    const groups = new Map<number, { post: Exclude<Rec['post'], number>; items: Rec[] }>()
    for (const d of docs as unknown as Rec[]) {
      const post = typeof d.post === 'object' ? d.post : { id: d.post, title: `ข่าว #${d.post}`, slug: '' }
      if (!groups.has(post.id)) groups.set(post.id, { post, items: [] })
      groups.get(post.id)!.items.push(d)
    }

    body = (
      <>
        <p style={{ maxWidth: 820, lineHeight: 1.7 }}>
          รูปเหล่านี้เดิมลิงก์ไปที่ songsue.co ซึ่งปิดไปแล้ว ระบบค้นสำเนาจาก Wayback Machine (archive.org) ได้บางรูป
          ช่วยเทียบกับเนื้อหาและคำบรรยายภาพ ถ้าใช่ กด <b>ใช้รูปนี้</b> ระบบจะเก็บรูปเข้าคลังสื่อและแก้ข่าวให้ทันที
          ถ้าไม่ใช่ กด <b>ไม่ใช่รูปนี้</b> (ข่าวไม่เปลี่ยน) รูปที่หาไม่พบ เลือก <b>ลบรูปเสียออกจากข่าว</b> หรือปล่อยไว้ก็ได้
        </p>
        <p style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '12px 0 24px' }}>
          {counts.map(([s, n]) => (
            <span key={s} style={{ color: STATUS[s].color }}>
              {STATUS[s].label}: <b>{n}</b>
            </span>
          ))}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/admin/image-recovery${f.key === 'all' ? '?show=all' : ''}`}
                style={{ fontWeight: filter === f.key ? 700 : 400, textDecoration: filter === f.key ? 'underline' : 'none' }}
              >
                {f.label}
              </Link>
            ))}
          </span>
        </p>
        {groups.size === 0 && <p>ไม่มีรายการ{filter === 'pending' ? 'ที่รอตรวจ' : ''}</p>}
        {[...groups.values()].map(({ post, items }) => (
          <section key={post.id} style={{ borderTop: '1px solid var(--theme-elevation-150)', padding: '24px 0' }}>
            <h3 style={{ margin: '0 0 6px' }}>{post.title}</h3>
            <p style={{ margin: '0 0 16px', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
              <Link href={`/admin/collections/posts/${post.id}`}>แก้ไขข่าว</Link>
              {post.slug && (
                <>
                  <a href={`https://www.theinsightnews.co/${encodeURIComponent(post.slug)}`} target="_blank" rel="noreferrer">
                    ดูบนเว็บปัจจุบัน ↗
                  </a>
                  <a href={`${WEB_URL}/${encodeURIComponent(post.slug)}`} target="_blank" rel="noreferrer">
                    ดูบนเว็บใหม่ ↗
                  </a>
                </>
              )}
            </p>
            <div style={{ display: 'grid', gap: 20 }}>
              {items.map((r) => (
                <Item key={r.id} r={r} />
              ))}
            </div>
          </section>
        ))}
      </>
    )
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <h1 style={{ margin: '24px 0 12px' }}>กู้รูปที่หายไปในเนื้อหาข่าว</h1>
        {body}
      </Gutter>
    </DefaultTemplate>
  )
}

function Item({ r }: { r: Rec }) {
  const st = STATUS[r.status]
  const mediaUrl = r.media && typeof r.media === 'object' ? r.media.url : undefined
  const shown = mediaUrl ?? r.candidateUrl
  const file = decodeURIComponent(r.originalSrc.split('?')[0].split('/').pop() ?? '')
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
        gap: 20,
        padding: 16,
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 6,
        background: 'var(--theme-elevation-0)',
      }}
    >
      <div style={{ fontSize: 14, lineHeight: 1.7, minWidth: 0 }}>
        <p style={{ margin: 0 }}>
          <b>ไฟล์เดิม:</b>{' '}
          <span style={{ wordBreak: 'break-all' }} title={r.originalSrc}>
            {file}
          </span>
        </p>
        <p style={{ margin: 0 }}>
          <b>คำบรรยายภาพเดิม:</b> {r.caption || <i style={{ color: '#6b7280' }}>ไม่มี</i>}
        </p>
        {r.context && (
          <blockquote style={{ margin: '8px 0', padding: '4px 12px', borderLeft: '3px solid var(--theme-elevation-200)', color: 'var(--theme-elevation-800)' }}>
            {r.context}
          </blockquote>
        )}
        <p style={{ margin: '8px 0 0', color: st.color }}>
          <b>สถานะ:</b> {st.label}
        </p>
        <RecoveryActions id={r.id} status={r.status} hasCandidate={Boolean(r.candidateUrl)} />
      </div>
      <div style={{ minWidth: 0 }}>
        {shown ? (
          <>
            <a href={shown} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shown}
                alt=""
                loading="lazy"
                style={{ display: 'block', maxWidth: '100%', maxHeight: 420, borderRadius: 4, background: 'var(--theme-elevation-50)' }}
              />
            </a>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0' }}>
              {mediaUrl
                ? 'อยู่ในคลังสื่อแล้ว'
                : `สำเนาจาก Wayback Machine${r.archivedAt ? ` เก็บไว้เมื่อ ${new Date(r.archivedAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}` : ''}${r.source === 'wayback-other-size' ? ' (ขนาดอื่นของไฟล์เดียวกัน)' : ''}`}
            </p>
          </>
        ) : (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              minHeight: 160,
              borderRadius: 4,
              border: '1px dashed var(--theme-elevation-250)',
              color: '#6b7280',
              textAlign: 'center',
              padding: 16,
            }}
          >
            หาสำเนาไม่พบ
            <br />
            (ไม่มีใน Wayback Machine)
          </div>
        )}
      </div>
    </div>
  )
}

/** Sidebar link to the review page. */
export function ImageRecoveryNavLink() {
  return (
    <Link href="/admin/image-recovery" className="nav__link" style={{ marginTop: 12 }}>
      <span className="nav__link-label">กู้รูปที่หายไป</span>
    </Link>
  )
}
