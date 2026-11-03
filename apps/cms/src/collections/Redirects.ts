import type { CollectionConfig } from 'payload'
import { idAboveWordPress } from '../hooks/id-floor'
import { isEditorOrAdmin, isStaff } from '../access'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/**
 * Old post URLs → the post they now belong to. Filled from WordPress's
 * `_wp_old_slug` on import, and automatically whenever a published post's
 * slug changes (Posts hook), so links shared before a rename keep working.
 */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'URL เดิม', plural: 'URL เดิม (redirect)' },
  admin: {
    useAsTitle: 'from',
    defaultColumns: ['from', 'post', 'updatedAt'],
    group: 'ตั้งค่า',
    description: 'ลิงก์ /{slug เดิม} จะพาไปบทความที่เลือก',
  },
  access: {
    read: () => true,
    create: isStaff,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  hooks: {
    beforeChange: [idAboveWordPress],
    afterChange: [revalidateAfterChange('redirects')],
    afterDelete: [revalidateAfterDelete('redirects')],
  },
  fields: [
    { name: 'from', label: 'slug เดิม', type: 'text', required: true, unique: true, index: true },
    { name: 'post', label: 'บทความ', type: 'relationship', relationTo: 'posts', required: true },
  ],
}
