import type { Endpoint, PayloadRequest } from 'payload'
import { slugify } from '../lib/slug'

/**
 * Actions for collections/ImageRecoveries.ts (editors and admins):
 *
 *   POST /api/image-recoveries/:id/approve  copy the found image into the media
 *                                          library and put it in the story
 *   POST /api/image-recoveries/:id/reject   not the right image; story unchanged
 *   POST /api/image-recoveries/:id/remove   take the broken image out of the story
 */

type Recovery = {
  id: number
  post: number | { id: number }
  originalSrc: string
  candidateUrl?: string | null
  caption?: string | null
  status: string
}

type LexNode = { type: string; children?: LexNode[]; fields?: { blockType?: string; html?: string } } & Record<string, unknown>

const MAX_BYTES = 20 * 1024 * 1024

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const canReview = (req: PayloadRequest) => ['admin', 'editor'].includes((req.user as { role?: string } | null)?.role ?? '')

function action(name: 'approve' | 'reject' | 'remove'): Endpoint {
  return {
    path: `/:id/${name}`,
    method: 'post',
    handler: async (req) => {
      try {
        if (!canReview(req)) throw new HttpError(403, 'เฉพาะบรรณาธิการหรือผู้ดูแลระบบ')
        const id = Number(req.routeParams?.id)
        const rec = (await req.payload
          .findByID({ collection: 'image-recoveries', id, depth: 0, req, disableErrors: true })
          .catch((): null => null)) as Recovery | null
        if (!rec) throw new HttpError(404, 'ไม่พบรายการนี้')
        if (rec.status === 'approved' || rec.status === 'removed') throw new HttpError(409, 'รายการนี้แก้ข่าวไปแล้ว')
        const postId = typeof rec.post === 'object' ? rec.post.id : rec.post

        let mediaId: number | undefined
        if (name === 'approve') {
          if (!rec.candidateUrl) throw new HttpError(400, 'ไม่มีรูปให้ใช้')
          mediaId = await uploadCandidate(req, rec)
          await editStory(req, postId, rec.originalSrc, { type: 'upload', mediaId, caption: rec.caption ?? '' })
        } else if (name === 'remove') {
          await editStory(req, postId, rec.originalSrc, { type: 'remove' })
        }

        const status = ({ approve: 'approved', reject: 'rejected', remove: 'removed' } as const)[name]
        const doc = await req.payload.update({
          collection: 'image-recoveries',
          id,
          data: { status, media: mediaId, reviewedBy: req.user!.id as number, reviewedAt: new Date().toISOString() },
          depth: 0,
          req,
        })
        return Response.json({ ok: true, doc })
      } catch (err) {
        const status = err instanceof HttpError ? err.status : 500
        if (status === 500) req.payload.logger.error({ err }, 'image recovery failed')
        return Response.json({ ok: false, error: (err as Error).message }, { status })
      }
    },
  }
}

/** Wayback `im_` links are for display; `id_` returns the archived bytes untouched. */
const rawUrl = (u: string) => u.replace(/\/web\/(\d+)(?:im_|id_)?\//, '/web/$1id_/')

async function uploadCandidate(req: PayloadRequest, rec: Recovery): Promise<number> {
  const res = await fetch(rawUrl(rec.candidateUrl!), { redirect: 'follow' })
  if (!res.ok) throw new HttpError(502, `ดึงรูปไม่สำเร็จ (${res.status}) ลองใหม่อีกครั้ง`)
  const mimetype = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!mimetype.startsWith('image/')) throw new HttpError(502, `ไฟล์ที่ได้ไม่ใช่รูป (${mimetype || 'ไม่ทราบชนิด'})`)
  const data = Buffer.from(await res.arrayBuffer())
  if (data.byteLength > MAX_BYTES) throw new HttpError(400, 'รูปใหญ่เกิน 20 MB')
  const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  const original = decodeURIComponent(new URL(rec.originalSrc).pathname.split('/').pop() ?? '')
  const base = slugify(original.replace(/\.[^.]+$/, '').replace(/-\d+x\d+$/, '')) || 'image'
  const doc = await req.payload.create({
    collection: 'media',
    data: { alt: rec.caption || undefined, caption: rec.caption || undefined },
    file: { data, mimetype, name: `${base}.${ext}`, size: data.byteLength },
    req,
  })
  return doc.id as number
}

const variants = (src: string) => [...new Set([src, src.replace(/&/g, '&amp;'), src.replace(/&amp;/g, '&')])]

/**
 * The broken image sits in an HTML block (imported markup WordPress couldn't
 * map to the library). If the block is just that image, it becomes a normal
 * image node; otherwise only the <img> inside the HTML changes.
 */
async function editStory(
  req: PayloadRequest,
  postId: number,
  src: string,
  change: { type: 'upload'; mediaId: number; caption: string } | { type: 'remove' },
) {
  const post = (await req.payload.findByID({ collection: 'posts', id: postId, depth: 0, draft: false, req })) as {
    content?: { root: LexNode }
    _status?: string
  }
  const root = post.content?.root
  if (!root) throw new HttpError(404, 'ข่าวนี้ไม่มีเนื้อหา')
  const forms = variants(src)
  let mediaUrl = ''
  if (change.type === 'upload') {
    const m = (await req.payload.findByID({ collection: 'media', id: change.mediaId, depth: 0, req })) as { url?: string }
    mediaUrl = m.url ?? ''
  }

  let hits = 0
  const walk = (node: LexNode): LexNode[] => {
    const html = node.type === 'block' && node.fields?.blockType === 'html' ? (node.fields.html ?? '') : ''
    if (html && forms.some((f) => html.includes(f))) {
      hits++
      const imgs = html.match(/<img\b[^>]*>/gi) ?? []
      const text = html.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '').replace(/<[^>]+>/g, '').trim()
      const alone = imgs.length === 1 && !text
      if (alone) {
        if (change.type === 'remove') return []
        return [
          {
            type: 'upload',
            version: 3,
            format: '',
            id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
            fields: change.caption ? { caption: change.caption } : {},
            relationTo: 'media',
            value: change.mediaId,
          } as unknown as LexNode,
        ]
      }
      let next = html
      for (const img of imgs) {
        if (!forms.some((f) => img.includes(f))) continue
        next = next.replace(img, change.type === 'remove' ? '' : img.replace(/\ssrc="[^"]*"/, ` src="${mediaUrl}"`).replace(/\ssrcset="[^"]*"/, ''))
      }
      return [{ ...node, fields: { ...node.fields, html: next } }]
    }
    if (node.children) return [{ ...node, children: node.children.flatMap(walk) }]
    return [node]
  }
  const nextRoot = walk(root)[0]
  if (!hits) throw new HttpError(409, 'ไม่พบรูปนี้ในเนื้อหาข่าวแล้ว (อาจมีคนแก้ไปก่อน)')

  await req.payload.update({
    collection: 'posts',
    id: postId,
    data: { content: { ...post.content, root: nextRoot } } as never,
    draft: false,
    req,
  })
}

export const imageRecoveryEndpoints: Endpoint[] = [action('approve'), action('reject'), action('remove')]
