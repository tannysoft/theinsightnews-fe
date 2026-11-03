import type { CollectionConfig } from 'payload'
import { idAboveWordPress } from '../hooks/id-floor'
import { isEditorOrAdmin, isStaff } from '../access'
import { generateSizes, sizesAfterRead } from '../hooks/image-sizes'

/**
 * Images and files (WordPress `attachment`). Stored in the R2 bucket
 * `theinsightnews-media` (files.theinsightnews.co) under
 * `wp-content/uploads/{yyyy}/{mm}/{filename}` — the same path WordPress
 * served them from, so every old file URL keeps working. WebP copies at the
 * sizes the website renders are written next to each original
 * (hooks/image-sizes.ts) — Payload's own imageSizes need sharp, which
 * Workers don't have.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'สื่อ', plural: 'คลังสื่อ' },
  admin: {
    defaultColumns: ['filename', 'alt', 'createdAt'],
    group: 'เนื้อหา',
  },
  access: {
    read: () => true,
    create: isStaff,
    update: isStaff,
    // Deleting removes the file from R2, which files.theinsightnews.co serves to every page linking it.
    delete: isEditorOrAdmin,
  },
  hooks: {
    beforeChange: [
      idAboveWordPress,
      ({ data, originalDoc, operation }) => {
        // A replaced file needs new resized copies before `sizes` points at them.
        if (operation === 'update' && data.filename && data.filename !== originalDoc?.filename) data.sizesReady = false
        // New uploads go to a year/month folder, like WordPress.
        if (operation === 'create' && !data.prefix) {
          const now = new Date()
          const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
          data.prefix = `wp-content/uploads/${now.getUTCFullYear()}/${mm}`
        }
        return data
      },
    ],
    afterChange: [generateSizes],
  },
  fields: [
    { name: 'alt', label: 'ข้อความแทนภาพ (alt)', type: 'text' },
    { name: 'caption', label: 'คำบรรยายภาพ', type: 'textarea' },
    { name: 'credit', label: 'เครดิตภาพ', type: 'text' },
    {
      // True once the resized copies exist in R2 (upload hook or the backfill);
      // until then `sizes` is null and the website shows the original.
      name: 'sizesReady',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
    {
      // URLs of the resized copies the website uses (see packages/shared/src/image-sizes.ts).
      name: 'sizes',
      type: 'json',
      virtual: true,
      admin: { hidden: true },
      hooks: { afterRead: [sizesAfterRead] },
    },
  ],
  upload: {
    mimeTypes: ['image/*', 'application/pdf', 'video/mp4'],
    // WordPress reuses filenames across months; the folder (prefix) tells them apart.
    filenameCompoundIndex: ['filename', 'prefix'],
    // Not supported on Workers (no sharp).
    crop: false,
    focalPoint: false,
  },
}
