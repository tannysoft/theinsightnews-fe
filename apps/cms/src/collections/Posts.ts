import type { CollectionConfig } from 'payload'
import { idAboveWordPress } from '../hooks/id-floor'
import { capturePublished } from '../hooks/published-before'
import { ownPostsOrEditor, publishedOrStaff, isStaff } from '../access'
import { articleEditor } from '../lib/editor'
import { normalizeSlug } from '../lib/slug'
import { fillSlugWithAI } from '../hooks/ai-slug'
import { WEB_URL } from '../lib/env'
import { renderContentHtml } from '../hooks/content-html'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { updateTagCounts, updateTagCountsOnDelete } from '../hooks/tag-counts'
import { rememberOldSlug } from '../hooks/slug-redirect'
import { draftsEndpoint } from '../endpoints/drafts'

/**
 * News stories and articles (WordPress `post`). Imported stories keep their
 * WordPress post id and slug, so URLs stay /{slug}.
 */
export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'ข่าว / บทความ', plural: 'ข่าว / บทความ' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['featuredImage', 'title', 'primaryCategory', 'author', 'publishedAt', '_status'],
    group: 'เนื้อหา',
    listSearchableFields: ['title', 'slug'],
    // Opens the story on the website in draft mode (apps/web/src/app/api/preview).
    preview: (doc) =>
      process.env.PREVIEW_SECRET
        ? `${WEB_URL}/api/preview?id=${doc.id}&secret=${encodeURIComponent(process.env.PREVIEW_SECRET)}`
        : `${WEB_URL}/${encodeURIComponent(String(doc.slug ?? ''))}`,
  },
  defaultSort: '-publishedAt',
  // POST /api/posts/drafts: other tools send stories in as drafts.
  endpoints: [draftsEndpoint],
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: ownPostsOrEditor,
    delete: ownPostsOrEditor,
  },
  versions: {
    drafts: { autosave: { interval: 3000 } },
    maxPerDoc: 25,
  },
  hooks: {
    // An empty slug is written by Claude on save (English, WordPress style).
    beforeValidate: [fillSlugWithAI],
    beforeChange: [
      idAboveWordPress,
      capturePublished,
      renderContentHtml,
      ({ data, originalDoc, req, operation }) => {
        // Partial updates (bulk publish/edit, PATCH) don't resend every field:
        // fall back to the stored values before filling defaults.
        if (!data.publishedAt && !originalDoc?.publishedAt && data._status === 'published')
          data.publishedAt = new Date().toISOString()
        if (operation === 'create' && !data.author && req.user) data.author = req.user.id
        // The first category is the primary one unless an editor picked another.
        const primary = data.primaryCategory ?? originalDoc?.primaryCategory
        const categories = (data.categories ?? originalDoc?.categories) as unknown[] | undefined
        if (!primary && Array.isArray(categories) && categories.length) data.primaryCategory = categories[0]
        return data
      },
    ],
    afterChange: [updateTagCounts, rememberOldSlug, revalidateAfterChange('posts')],
    afterDelete: [updateTagCountsOnDelete, revalidateAfterDelete('posts')],
  },
  fields: [
    {
      name: 'title',
      label: 'หัวข้อข่าว',
      type: 'text',
      required: true,
      // The cover is the first list column; keep the title clickable too.
      admin: { components: { Cell: '/components/admin/CoverCell#TitleCell' } },
    },
    {
      name: 'featuredImage',
      label: 'ภาพหน้าปก',
      type: 'upload',
      relationTo: 'media',
      admin: { components: { Cell: '/components/admin/CoverCell#CoverCell' } },
    },
    { name: 'content', label: 'เนื้อหา', type: 'richText', editor: articleEditor },
    {
      name: 'excerpt',
      label: 'เกริ่นนำ / สรุปย่อ',
      type: 'textarea',
      admin: { description: 'แสดงในรายการข่าวและใช้เป็นคำอธิบายเมื่อไม่ได้กรอก SEO' },
    },
    // Rendered body for the website; rebuilt from `content` on every save.
    // Long Thai stories run past Payload's default 40,000-character text limit.
    { name: 'contentHtml', type: 'textarea', maxLength: 2_000_000, admin: { hidden: true } },
    // "N min read" on cards, so lists don't need the body (hooks/content-html.ts).
    { name: 'readingMinutes', type: 'number', defaultValue: 1, admin: { hidden: true } },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'ใช้เป็น URL ของบทความ (/{slug}) — เว้นว่างไว้ ระบบจะตั้งเป็นภาษาอังกฤษจากหัวข้อและเนื้อหาให้ตอนบันทึก · ถ้าแก้หลังเผยแพร่ ลิงก์เดิมจะ redirect มาที่นี่ให้อัตโนมัติ',
      },
      hooks: { beforeValidate: [normalizeSlug] },
    },
    {
      name: 'publishedAt',
      label: 'วันที่เผยแพร่',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy HH:mm' },
        description: 'ตั้งเป็นเวลาในอนาคตเพื่อตั้งเวลาเผยแพร่',
      },
    },
    {
      name: 'categories',
      label: 'หมวดหมู่',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'primaryCategory',
      label: 'หมวดหลัก',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
      admin: { position: 'sidebar', description: 'เว้นว่าง = ใช้หมวดแรก' },
    },
    {
      name: 'tags',
      label: 'แท็ก',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    { name: 'author', label: 'ผู้เขียน', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar' } },
    {
      name: 'sticky',
      label: 'ปักหมุด',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'format',
      label: 'รูปแบบ',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'มาตรฐาน', value: 'standard' },
        { label: 'วิดีโอ', value: 'video' },
        { label: 'แกลเลอรี', value: 'gallery' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
}
