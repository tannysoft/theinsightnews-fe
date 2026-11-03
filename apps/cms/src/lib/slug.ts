import type { FieldHook } from 'payload'

/**
 * URL slug that keeps Thai script (WordPress allowed Thai slugs) and replaces
 * spaces and punctuation with hyphens.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[\s_/\\]+/g, '-')
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Fill the slug from another field when it's left empty. */
export const slugFrom =
  (source: string): FieldHook =>
  ({ value, data, originalDoc }) => {
    if (typeof value === 'string' && value.trim()) return slugify(value)
    const from = data?.[source] ?? originalDoc?.[source]
    return typeof from === 'string' ? slugify(from) : value
  }

/** Tidy a slug someone typed; an empty one is left for hooks/ai-slug.ts to fill. */
export const normalizeSlug: FieldHook = ({ value }) =>
  typeof value === 'string' && value.trim() ? slugify(value) : value
