import type { CollectionConfig } from 'payload'
import { idAboveWordPress } from '../hooks/id-floor'
import { isEditorOrAdmin } from '../access'
import { slugFrom } from '../lib/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/** WordPress `category`. The slug is the URL: /{slug} and /{slug}/{postId}. */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'หมวดหมู่', plural: 'หมวดหมู่' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'order', 'showInMenu'],
    group: 'เนื้อหา',
  },
  defaultSort: 'order',
  access: {
    read: () => true,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  hooks: {
    beforeChange: [idAboveWordPress],
    afterChange: [revalidateAfterChange('categories')],
    afterDelete: [revalidateAfterDelete('categories')],
  },
  fields: [
    { name: 'name', label: 'ชื่อ', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'ใช้เป็น URL เช่น /news' },
      hooks: { beforeValidate: [slugFrom('name')] },
    },
    { name: 'description', label: 'คำอธิบาย', type: 'textarea' },
    { name: 'parent', label: 'หมวดแม่', type: 'relationship', relationTo: 'categories', admin: { position: 'sidebar' } },
    { name: 'order', label: 'ลำดับในเมนู', type: 'number', defaultValue: 100, admin: { position: 'sidebar' } },
    { name: 'showInMenu', label: 'แสดงในเมนู', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    {
      name: 'noindex',
      label: 'ไม่ให้ search engine เก็บหน้าหมวดนี้',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'เช่น หมวด “สไลด์” ที่ใช้จัดหน้าแรกเท่านั้น' },
    },
  ],
}
