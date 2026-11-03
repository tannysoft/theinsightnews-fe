import type { PayloadRequest } from 'payload'

/**
 * True for draft saves and autosaves (`?draft=true`). They only write a new
 * version; the published document — what the website and counts use — is
 * untouched, so public-facing side effects can be skipped.
 */
export const isDraftSave = (req: PayloadRequest) => {
  const q = req.query as Record<string, unknown> | undefined
  // Local API calls that only write a draft mark it in context (endpoints/drafts.ts).
  if ((req.context as Record<string, unknown> | undefined)?.draftSave) return true
  return q?.draft === 'true' || q?.draft === true || q?.autosave === 'true' || q?.autosave === true
}
