import type { CollectionConfig } from 'payload'
import { isAdmin, isEditorOrAdmin } from '../access'
import { imageRecoveryEndpoints } from '../endpoints/image-recovery'

/**
 * Broken images in story bodies (e.g. hotlinked from songsue.co, which is
 * gone) with a copy found elsewhere (the Wayback Machine). An editor checks
 * each one on /admin/image-recovery; approving adds the copy to the media
 * library and swaps it into the story (endpoints/image-recovery.ts).
 * Rows are created by scripts/recover-images.
 */
export const ImageRecoveries: CollectionConfig = {
  slug: 'image-recoveries',
  labels: { singular: 'กู้รูปในเนื้อหา', plural: 'กู้รูปในเนื้อหา' },
  admin: {
    group: 'เครื่องมือ',
    useAsTitle: 'originalSrc',
    defaultColumns: ['post', 'originalSrc', 'status', 'reviewedAt'],
    description: 'ตรวจรูปที่หายจากเนื้อหาข่าวได้ที่หน้า "กู้รูปที่หายไป"',
    // Editors work on /admin/image-recovery (sidebar link), not this raw list.
    hidden: true,
  },
  access: {
    read: isEditorOrAdmin,
    create: isAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  endpoints: imageRecoveryEndpoints,
  fields: [
    { name: 'post', label: 'ข่าว', type: 'relationship', relationTo: 'posts', required: true, index: true },
    { name: 'originalSrc', label: 'URL รูปเดิม (เสีย)', type: 'text', required: true },
    { name: 'candidateUrl', label: 'รูปที่พบ', type: 'text', admin: { description: 'ว่าง = หาไม่พบ' } },
    {
      name: 'source',
      label: 'แหล่งที่พบ',
      type: 'select',
      options: [
        { label: 'Wayback (ไฟล์เดียวกัน)', value: 'wayback' },
        { label: 'Wayback (ขนาดอื่นของไฟล์เดียวกัน)', value: 'wayback-other-size' },
        { label: 'ไม่พบ', value: 'none' },
      ],
    },
    { name: 'archivedAt', label: 'วันที่ Wayback เก็บไว้', type: 'date' },
    { name: 'caption', label: 'คำบรรยายภาพเดิม', type: 'text' },
    { name: 'context', label: 'ข้อความรอบรูป', type: 'textarea' },
    {
      name: 'status',
      label: 'สถานะ',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'รอตรวจ', value: 'pending' },
        { label: 'ใช้รูปนี้แล้ว', value: 'approved' },
        { label: 'ไม่ใช่รูปนี้', value: 'rejected' },
        { label: 'ลบรูปออกจากข่าวแล้ว', value: 'removed' },
      ],
    },
    { name: 'media', label: 'รูปในคลังสื่อ', type: 'upload', relationTo: 'media' },
    { name: 'reviewedBy', label: 'ผู้ตรวจ', type: 'relationship', relationTo: 'users' },
    { name: 'reviewedAt', label: 'ตรวจเมื่อ', type: 'date' },
  ],
}
