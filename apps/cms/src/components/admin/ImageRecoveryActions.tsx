'use client'

import { Button } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Status = 'pending' | 'approved' | 'rejected' | 'removed'
type Action = 'approve' | 'reject' | 'remove'

/** Buttons for one broken image on /admin/image-recovery. */
export function RecoveryActions({ id, status, hasCandidate }: { id: number; status: Status; hasCandidate: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (status === 'approved' || status === 'removed') return null

  const run = async (action: Action) => {
    setBusy(action)
    setError('')
    try {
      const res = await fetch(`/api/image-recoveries/${id}/${action}`, { method: 'POST', credentials: 'include' })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || `เกิดข้อผิดพลาด (${res.status})`)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
      setConfirmRemove(false)
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {hasCandidate && (
          <Button size="small" buttonStyle="primary" disabled={!!busy} onClick={() => run('approve')}>
            {busy === 'approve' ? 'กำลังบันทึก…' : '✓ ใช้รูปนี้'}
          </Button>
        )}
        {hasCandidate && status !== 'rejected' && (
          <Button size="small" buttonStyle="secondary" disabled={!!busy} onClick={() => run('reject')}>
            {busy === 'reject' ? 'กำลังบันทึก…' : '✕ ไม่ใช่รูปนี้'}
          </Button>
        )}
        {(!hasCandidate || status === 'rejected') &&
          (confirmRemove ? (
            <>
              <Button size="small" buttonStyle="error" disabled={!!busy} onClick={() => run('remove')}>
                {busy === 'remove' ? 'กำลังลบ…' : 'ยืนยัน ลบรูปออกจากข่าว'}
              </Button>
              <Button size="small" buttonStyle="secondary" disabled={!!busy} onClick={() => setConfirmRemove(false)}>
                ยกเลิก
              </Button>
            </>
          ) : (
            <Button size="small" buttonStyle="secondary" disabled={!!busy} onClick={() => setConfirmRemove(true)}>
              ลบรูปเสียออกจากข่าว
            </Button>
          ))}
      </div>
      {error && <p style={{ color: '#b91c1c', margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}
