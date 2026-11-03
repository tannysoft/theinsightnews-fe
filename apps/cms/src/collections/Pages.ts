import type { CollectionConfig } from 'payload'
import { idAboveWordPress } from '../hooks/id-floor'
import { capturePublished } from '../hooks/published-before'
import { isEditorOrAdmin, publishedOrStaff } from '../access'
import { articleEditor } from '../lib/editor'
import { slugFrom } from '../lib/slug'
import { renderContentHtml } from '../hooks/content-html'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/**
 * Static pages (WordPress `page`), e.g. privacy policy. A page with the slug
 * `topic-{slug}` becomes the editor-written guide + FAQ on /topic/{slug}.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'หน้า', plural: 'หน้า' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt', '_status'],
    group: 'เนื้อหา',
  },
  access: {
    read: publishedOrStaff,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  versions: { drafts: true, maxPerDoc: 25 },
  hooks: {
    beforeChange: [
      idAboveWordPress,
      capturePublished,
      renderContentHtml,
    ],
    afterChange: [revalidateAfterChange('pages')],
    afterDelete: [revalidateAfterDelete('pages')],
  },
  fields: [
    { name: 'title', label: 'ชื่อหน้า', type: 'text', required: true },
    { name: 'content', label: 'เนื้อหา', type: 'richText', editor: articleEditor },
    // Long Thai stories run past Payload's default 40,000-character text limit.
    { name: 'contentHtml', type: 'textarea', maxLength: 2_000_000, admin: { hidden: true } },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: { beforeValidate: [slugFrom('title')] },
    },
    { name: 'featuredImage', label: 'ภาพหน้าปก', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'publishedAt', label: 'วันที่เผยแพร่', type: 'date', admin: { position: 'sidebar' } },
  ],
}
