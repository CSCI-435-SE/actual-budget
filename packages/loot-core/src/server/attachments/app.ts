import { v4 as uuidv4 } from 'uuid';

import { captureException } from '#platform/exceptions';
import * as connection from '#platform/server/connection';
import { logger } from '#platform/server/log';
import { createApp } from '#server/app';
import * as db from '#server/db';
import type { DbTransaction, DbTransactionAttachment } from '#server/db';
import * as prefs from '#server/prefs';
import {
  detectAttachmentMimeType,
  normalizeAttachmentFileName,
  validateAttachment,
} from '#shared/attachments';
import type { AttachmentValidationError } from '#shared/attachments';
import type {
  AttachmentMimeType,
  TransactionAttachmentEntity,
} from '#types/models';

import {
  hasAttachmentFile,
  readAttachmentFile,
  removeAttachmentFile,
  writeAttachmentFile,
} from './storage';

// Attachments are stored on this device only (#154). Rows are written with
// `db.runQuery` rather than `db.insert`/`db.update`, so they never produce
// sync messages and the app's undo stack never sees them. The handlers
// aren't wrapped in `mutator` for the same reason, and as plain handlers
// `close-budget` waits for an in-progress save.
//
// Removing an attachment only marks its row (`tombstone = 1` and
// `deleted_at`) and keeps the file, so `attachment-restore` can undo it.
// Cleanup removes the row and the file after a grace period (#155).

export type AttachmentAddError =
  | AttachmentValidationError
  | { reason: 'no-budget' }
  | { reason: 'transaction-not-found' }
  | { reason: 'save-failed' };

export type AttachmentReadError =
  | { reason: 'no-budget' }
  | { reason: 'not-found' }
  // The row exists but its file isn't on this device
  | { reason: 'missing' }
  | { reason: 'read-failed' };

export type AttachmentRestoreError =
  | { reason: 'no-budget' }
  // The row has been cleaned up, or its file is no longer on this device
  | { reason: 'not-found' }
  // The attachment's transaction (or its parent) is deleted
  | { reason: 'transaction-not-found' };

export type AttachmentHandlers = {
  'attachment-add': typeof addAttachment;
  'attachment-remove': typeof removeAttachment;
  'attachment-restore': typeof restoreAttachment;
  'attachment-list': typeof listAttachments;
  'attachment-read': typeof readAttachment;
};

export const app = createApp<AttachmentHandlers>();
app.method('attachment-add', addAttachment);
app.method('attachment-remove', removeAttachment);
app.method('attachment-restore', restoreAttachment);
app.method('attachment-list', listAttachments);
app.method('attachment-read', readAttachment);

async function addAttachment({
  transactionId,
  fileName,
  data,
}: {
  transactionId: TransactionAttachmentEntity['transaction_id'];
  fileName: string;
  data: ArrayBuffer | Uint8Array;
}): Promise<
  { attachment: TransactionAttachmentEntity } | { error: AttachmentAddError }
> {
  const budgetId = getBudgetId();
  if (budgetId == null) {
    return { error: { reason: 'no-budget' } };
  }

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const validation = validateAttachment(bytes);
  if ('error' in validation) {
    return { error: validation.error };
  }

  const ownerId = await resolveOwnerTransactionId(transactionId);
  if (ownerId == null) {
    return { error: { reason: 'transaction-not-found' } };
  }

  const attachment: TransactionAttachmentEntity = {
    id: uuidv4(),
    transaction_id: ownerId,
    file_name: normalizeAttachmentFileName(fileName),
    mime_type: validation.mimeType,
    size: bytes.byteLength,
    storage: 'local',
    created_at: Date.now(),
    deleted_at: null,
    tombstone: false,
  };

  try {
    await writeAttachmentFile(budgetId, attachment.id, bytes);
  } catch (error) {
    reportError('Failed to write attachment file', error);
    return { error: { reason: 'save-failed' } };
  }

  try {
    db.runQuery(
      `INSERT INTO transaction_attachments
         (id, transaction_id, file_name, mime_type, size, storage, created_at, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        attachment.id,
        attachment.transaction_id,
        attachment.file_name,
        attachment.mime_type,
        attachment.size,
        attachment.storage,
        attachment.created_at,
      ],
    );
  } catch (error) {
    reportError('Failed to save attachment row', error);
    // Don't leave a file behind that no row points to
    try {
      await removeAttachmentFile(budgetId, attachment.id);
    } catch (removeError) {
      logger.warn('Failed to remove unsaved attachment file', removeError);
    }
    return { error: { reason: 'save-failed' } };
  }

  notifyChanged();
  return { attachment };
}

// Marks the attachment as removed and keeps its file, so the removal can be
// undone with `attachment-restore`. Cleanup removes the row and the file
// later. Removing an attachment that is already gone succeeds.
async function removeAttachment({
  id,
}: {
  id: TransactionAttachmentEntity['id'];
}): Promise<{ error?: { reason: 'no-budget' } }> {
  const budgetId = getBudgetId();
  if (budgetId == null) {
    return { error: { reason: 'no-budget' } };
  }

  const row = await getAttachmentRow(id);
  if (row == null) {
    return {};
  }

  db.runQuery(
    'UPDATE transaction_attachments SET tombstone = 1, deleted_at = ? WHERE id = ?',
    [Date.now(), id],
  );
  notifyChanged();
  return {};
}

// Undoes `attachment-remove`. Refused when the row or its file is gone, or
// when the attachment's transaction has been deleted since. Restoring an
// attachment that isn't removed succeeds.
async function restoreAttachment({
  id,
}: {
  id: TransactionAttachmentEntity['id'];
}): Promise<{ error?: AttachmentRestoreError }> {
  const budgetId = getBudgetId();
  if (budgetId == null) {
    return { error: { reason: 'no-budget' } };
  }

  const row = await db.first<DbTransactionAttachment>(
    'SELECT * FROM transaction_attachments WHERE id = ?',
    [id],
  );
  if (row == null) {
    return { error: { reason: 'not-found' } };
  }
  if ((await resolveOwnerTransactionId(row.transaction_id)) == null) {
    return { error: { reason: 'transaction-not-found' } };
  }
  if (row.tombstone === 0) {
    return {};
  }
  if (!(await hasAttachmentFile(budgetId, id))) {
    return { error: { reason: 'not-found' } };
  }

  db.runQuery(
    'UPDATE transaction_attachments SET tombstone = 0, deleted_at = NULL WHERE id = ?',
    [id],
  );
  // The attachment list is a live query that only refreshes on this event
  notifyChanged();
  return {};
}

// The attachments on a transaction, oldest first. A split child's
// attachments are the ones on its parent. A deleted transaction has none.
async function listAttachments({
  transactionId,
}: {
  transactionId: TransactionAttachmentEntity['transaction_id'];
}): Promise<TransactionAttachmentEntity[]> {
  const ownerId = await resolveOwnerTransactionId(transactionId);
  if (ownerId == null) {
    return [];
  }

  const rows = await db.all<DbTransactionAttachment>(
    `SELECT * FROM transaction_attachments
       WHERE transaction_id = ? AND tombstone = 0
       ORDER BY created_at, id`,
    [ownerId],
  );
  return rows.map(fromDbRow);
}

async function readAttachment({
  id,
}: {
  id: TransactionAttachmentEntity['id'];
}): Promise<
  | { attachment: TransactionAttachmentEntity; data: Uint8Array }
  | { error: AttachmentReadError }
> {
  const budgetId = getBudgetId();
  if (budgetId == null) {
    return { error: { reason: 'no-budget' } };
  }

  const row = await getAttachmentRow(id);
  // A deleted transaction's attachments are hidden until the delete is undone
  if (
    row == null ||
    (await resolveOwnerTransactionId(row.transaction_id)) == null
  ) {
    return { error: { reason: 'not-found' } };
  }

  try {
    const data = await readAttachmentFile(budgetId, id);
    if (data == null) {
      return { error: { reason: 'missing' } };
    }
    // Report the type found in the file itself rather than the row's: rows
    // can come from an imported budget, and the UI shows the file using
    // this type
    const mimeType = detectAttachmentMimeType(data);
    if (mimeType == null) {
      logger.warn(`Attachment ${id} is not an allowed file type`);
      return { error: { reason: 'read-failed' } };
    }
    return { attachment: { ...fromDbRow(row), mime_type: mimeType }, data };
  } catch (error) {
    reportError('Failed to read attachment file', error);
    return { error: { reason: 'read-failed' } };
  }
}

function getBudgetId(): string | null {
  return prefs.getPrefs()?.id ?? null;
}

async function getAttachmentRow(
  id: TransactionAttachmentEntity['id'],
): Promise<DbTransactionAttachment | null> {
  return db.first<DbTransactionAttachment>(
    'SELECT * FROM transaction_attachments WHERE id = ? AND tombstone = 0',
    [id],
  );
}

// Attachments belong to non-child transactions: a split child's attachments
// go on its parent. Returns null if the transaction (or the child's parent)
// doesn't exist or is deleted.
async function resolveOwnerTransactionId(
  transactionId: string,
): Promise<string | null> {
  type Row = Pick<DbTransaction, 'id' | 'isChild' | 'parent_id' | 'tombstone'>;
  const query =
    'SELECT id, isChild, parent_id, tombstone FROM transactions WHERE id = ?';

  const transaction = await db.first<Row>(query, [transactionId]);
  if (transaction == null || transaction.tombstone) {
    return null;
  }
  if (!transaction.isChild) {
    return transaction.id;
  }
  if (transaction.parent_id == null) {
    return null;
  }

  const parent = await db.first<Row>(query, [transaction.parent_id]);
  if (parent == null || parent.tombstone) {
    return null;
  }
  return parent.id;
}

function fromDbRow(row: DbTransactionAttachment): TransactionAttachmentEntity {
  return {
    id: row.id,
    transaction_id: row.transaction_id,
    file_name: row.file_name,
    // This app only writes validated types, but an imported budget could hold
    // anything; `attachment-read` reports the type found in the file instead
    mime_type: row.mime_type as AttachmentMimeType,
    size: row.size,
    storage: 'local',
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    tombstone: row.tombstone === 1,
  };
}

function notifyChanged() {
  connection.send('sync-event', {
    type: 'applied',
    tables: ['transaction_attachments'],
  });
}

function reportError(message: string, error: unknown) {
  logger.error(message, error);
  if (error instanceof Error) {
    captureException(error);
  }
}
