import type { CollectionConfig } from 'payload'
import { idAboveWordPress } from '../hooks/id-floor'
import { isStaff, isEditorOrAdmin } from '../access'
import { slugFrom } from '../lib/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/** WordPress `post_tag`. Page: /tag/{slug}. */
export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'แท็ก', plural: 'แท็ก' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'postCount'],
    group: 'เนื้อหา',
    listSearchableFields: ['name', 'slug'],
  },
  access: {
    read: () => true,
    // Authors add tags while writing.
    create: isStaff,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  hooks: {
    beforeChange: [idAboveWordPress],
    afterChange: [revalidateAfterChange('tags')],
    afterDelete: [revalidateAfterDelete('tags')],
  },
  fields: [
    { name: 'name', label: 'ชื่อ', type: 'text', required: true, index: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: { beforeValidate: [slugFrom('name')] },
    },
    { name: 'description', label: 'คำอธิบาย', type: 'textarea' },
    {
      name: 'postCount',
      label: 'จำนวนบทความ',
      type: 'number',
      defaultValue: 0,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'นับอัตโนมัติเมื่อบันทึกบทความ ใช้เรียงแท็กยอดนิยมและซ่อนแท็กว่าง',
      },
    },
  ],
}
