import type { AttachmentMimeType } from '#types/models';

import { q } from './query';

// Rules for files attached to transactions (#154). They live in `shared` so
// the UI can check a file before sending it, and loot-core checks it again
// before storing it, using the same rules.

export const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;

export const ATTACHMENT_MIME_TYPES: readonly AttachmentMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

// For a file picker's `accept` attribute
export const ATTACHMENT_FILE_ACCEPT = [
  ...ATTACHMENT_MIME_TYPES,
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
].join(',');

const MAX_FILE_NAME_LENGTH = 255;

export type AttachmentValidationError =
  | { reason: 'empty' }
  | { reason: 'too-large'; maxSize: number }
  | { reason: 'unsupported-type'; allowed: readonly AttachmentMimeType[] };

export type AttachmentValidationResult =
  | { ok: true; mimeType: AttachmentMimeType }
  | { ok: false; error: AttachmentValidationError };

// Checks only the size. The UI can run this on a picked file before reading
// its contents.
export function checkAttachmentSize(
  size: number,
): AttachmentValidationError | null {
  if (size <= 0) {
    return { reason: 'empty' };
  }
  if (size > ATTACHMENT_MAX_SIZE) {
    return { reason: 'too-large', maxSize: ATTACHMENT_MAX_SIZE };
  }
  return null;
}

// Works out the file type from the file's first bytes. The file name and the
// type the browser reports are never trusted.
export function detectAttachmentMimeType(
  data: Uint8Array,
): AttachmentMimeType | null {
  if (startsWith(data, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // "RIFF", 4 bytes of length, then "WEBP"
  if (
    startsWith(data, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  // "%PDF-"
  if (startsWith(data, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf';
  }
  return null;
}

// The full check that runs before a file is stored: not empty, not over the
// size limit, and an allowed type judged by its contents
export function validateAttachment(
  data: Uint8Array,
): AttachmentValidationResult {
  const sizeError = checkAttachmentSize(data.byteLength);
  if (sizeError) {
    return { ok: false, error: sizeError };
  }

  const mimeType = detectAttachmentMimeType(data);
  if (mimeType == null) {
    return {
      ok: false,
      error: { reason: 'unsupported-type', allowed: ATTACHMENT_MIME_TYPES },
    };
  }

  return { ok: true, mimeType };
}

// The number of attachments on each transaction, as rows of
// `{ transaction_id, count }`. `transaction_id` is read through the live
// transactions, so attachments on a deleted transaction come back with a
// null id.
export type TransactionAttachmentCount = {
  transaction_id: string | null;
  count: number;
};

export function transactionAttachmentCountsQuery() {
  return q('transaction_attachments')
    .groupBy('transaction_id')
    .select(['transaction_id', { count: { $count: '$id' } }]);
}

// Cleans up a file name for storing and showing. Files are stored by
// attachment id, so the name is never used as a path; this only removes
// characters that would display badly and keeps the name a sensible length.
export function normalizeAttachmentFileName(name: string): string {
  // Keep only the last part if a path was passed (e.g. "C:\fakepath\a.pdf")
  const base = name.split(/[\\/]/).pop() ?? '';
  // oxlint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (cleaned === '') {
    return 'attachment';
  }
  if (cleaned.length <= MAX_FILE_NAME_LENGTH) {
    return cleaned;
  }

  // Shorten the name but keep a short extension, if there is one
  const dot = cleaned.lastIndexOf('.');
  const extension =
    dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, MAX_FILE_NAME_LENGTH - extension.length) + extension;
}

function startsWith(data: Uint8Array, bytes: number[], offset = 0): boolean {
  if (data.byteLength < offset + bytes.length) {
    return false;
  }
  return bytes.every((byte, i) => data[offset + i] === byte);
}
