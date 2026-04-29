// Apple Notes ZTYPEUTI values that live in the protobuf body or
// ZMERGEABLEDATA1 — they have no on-disk file, so resolveAttachment(...) and
// getAttachmentUrl(...) will always return not-found / null for them.
export const INLINE_ATTACHMENT_TYPES: ReadonlySet<string> = new Set([
  "com.apple.notes.table",
  "com.apple.notes.gallery",
  "public.url",
]);

const INLINE_ATTACHMENT_PREFIX = "com.apple.notes.inlinetextattachment.";

export function isFileBackedAttachment(contentType: string): boolean {
  if (!contentType) return false;
  if (INLINE_ATTACHMENT_TYPES.has(contentType)) return false;
  if (contentType.startsWith(INLINE_ATTACHMENT_PREFIX)) return false;
  return true;
}
