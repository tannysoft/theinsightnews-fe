import type { Block } from 'payload'

/** YouTube, Facebook, X, TikTok… — a URL, or the provider's embed code. */
export const EmbedBlock: Block = {
  slug: 'embed',
  labels: { singular: 'Embed (YouTube / โซเชียล)', plural: 'Embeds' },
  fields: [
    { name: 'url', label: 'URL', type: 'text' },
    {
      name: 'html',
      label: 'โค้ดฝัง (ถ้ามี)',
      type: 'code',
      admin: { language: 'html', description: 'เว้นว่างได้ถ้าเป็น YouTube — ระบบสร้างให้จาก URL' },
    },
    { name: 'caption', label: 'คำบรรยาย', type: 'text' },
  ],
}

/** Several images shown as a grid (WordPress gallery block). */
export const GalleryBlock: Block = {
  slug: 'gallery',
  labels: { singular: 'แกลเลอรีภาพ', plural: 'แกลเลอรีภาพ' },
  fields: [
    { name: 'images', label: 'ภาพ', type: 'upload', relationTo: 'media', hasMany: true, required: true },
    { name: 'caption', label: 'คำบรรยาย', type: 'text' },
  ],
}

/** Raw HTML for anything the editor has no block for (tables, code, widgets). */
export const HTMLBlock: Block = {
  slug: 'html',
  labels: { singular: 'HTML', plural: 'HTML' },
  fields: [{ name: 'html', label: 'HTML', type: 'code', required: true, admin: { language: 'html' } }],
}

export const contentBlocks = [EmbedBlock, GalleryBlock, HTMLBlock]
