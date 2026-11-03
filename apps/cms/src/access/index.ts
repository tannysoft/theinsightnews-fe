import type { Access, FieldAccess } from 'payload'

type Role = 'admin' | 'editor' | 'author'

const roleOf = (user: unknown): Role | null =>
  user && typeof user === 'object' && 'role' in user ? ((user as { role?: Role }).role ?? null) : null

export const isAdmin: Access = ({ req }) => roleOf(req.user) === 'admin'
export const isAdminField: FieldAccess = ({ req }) => roleOf(req.user) === 'admin'
export const isStaff: Access = ({ req }) => Boolean(req.user)
export const isEditorOrAdmin: Access = ({ req }) => ['admin', 'editor'].includes(roleOf(req.user) ?? '')

/**
 * Anyone can read published documents whose publish time has come; signed-in
 * staff also see drafts and scheduled stories (embargoes stay private).
 */
export const publishedOrStaff: Access = ({ req }) => {
  if (req.user) return true
  return {
    and: [
      { _status: { equals: 'published' } },
      { or: [{ publishedAt: { exists: false } }, { publishedAt: { less_than_equal: new Date().toISOString() } }] },
    ],
  }
}

/** Editors and admins edit everything; authors only their own posts. */
export const ownPostsOrEditor: Access = ({ req }) => {
  const role = roleOf(req.user)
  if (!role) return false
  if (role === 'admin' || role === 'editor') return true
  return { author: { equals: req.user!.id } }
}

/** Admins manage every account; everyone else only their own. */
export const selfOrAdmin: Access = ({ req }) => {
  if (!req.user) return false
  if (roleOf(req.user) === 'admin') return true
  return { id: { equals: req.user.id } }
}
