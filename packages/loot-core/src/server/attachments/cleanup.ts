import * as fs from '#platform/server/fs';
import { logger } from '#platform/server/log';
import * as db from '#server/db';
import * as prefs from '#server/prefs';

import {
  getAttachmentsDir,
  isSafeAttachmentId,
  removeAttachmentFile,
  TEMP_SUFFIX,
} from './storage';

// Removes attachment rows and files that nothing uses anymore (#155):
// removed attachments, the attachments of deleted transactions, files that
// no row points to, and leftover temporary files. Everything is kept for a
// grace period first. That isn't for the app's undo, which is cleared each
// time a budget opens: it covers deletes that arrive by sync from another
// device, and a re-download, which replaces db.sqlite (and so the rows) but
// leaves the files.
//
// Each step can be interrupted at any point and leaves things consistent:
// rows are always removed before their files, so no row ever points at a
// file that cleanup removed.

export const ATTACHMENT_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

// Files in attachments/ that have no row, and when cleanup first saw each
// one: { [id]: firstSeenMs }. The browser fs can't tell when a file was
// last modified, so cleanup keeps track itself.
const UNUSED_FILES_NAME = '.cleanup.json';

// Whether the attachment's transaction is live. Attachments belong to
// non-child transactions; the child case matches `resolveOwnerTransactionId`
// in case a row from an imported budget points at one.
const TRANSACTION_IS_LIVE = `EXISTS (
  SELECT 1 FROM transactions t
    LEFT JOIN transactions p ON p.id = t.parent_id
    WHERE t.id = transaction_attachments.transaction_id
      AND t.tombstone = 0
      AND (COALESCE(t.isChild, 0) = 0 OR (p.id IS NOT NULL AND p.tombstone = 0))
)`;

export type AttachmentCleanupResult = {
  // Rows first seen as unused (removed, or their transaction deleted)
  stamped: number;
  // Rows whose transaction is live again
  unstamped: number;
  // Rows removed, with their files
  purged: number;
  // Files with no row, or leftover temporary files, removed
  removedFiles: number;
};

export async function cleanUpAttachments(
  budgetId: string,
  {
    now = Date.now(),
    graceMs = ATTACHMENT_GRACE_MS,
  }: { now?: number; graceMs?: number } = {},
): Promise<AttachmentCleanupResult> {
  const result: AttachmentCleanupResult = {
    stamped: 0,
    unstamped: 0,
    purged: 0,
    removedFiles: 0,
  };
  const cutoff = now - graceMs;

  // The database is whichever budget is open, so stop if that changes
  const isOpen = () => prefs.getPrefs()?.id === budgetId;

  if (!isOpen()) {
    return result;
  }
  try {
    Object.assign(result, stampRows(now));
  } catch (error) {
    logger.warn('Attachment cleanup: failed to stamp rows', error);
  }

  if (!isOpen()) {
    return result;
  }
  try {
    result.purged = await purgeRows(budgetId, cutoff);
  } catch (error) {
    logger.warn('Attachment cleanup: failed to remove rows', error);
  }

  if (!isOpen()) {
    return result;
  }
  try {
    result.removedFiles = await removeUnusedFiles(budgetId, {
      now,
      cutoff,
      isOpen,
    });
  } catch (error) {
    logger.warn('Attachment cleanup: failed to remove unused files', error);
  }

  return result;
}

// Step 1. `deleted_at` on a live row (`tombstone = 0`) means its transaction
// was deleted; on a removed row it is when it was removed. Recording when a
// delete was first noticed avoids reading `messages_crdt`.
function stampRows(now: number) {
  const stamped = db.runQuery(
    `UPDATE transaction_attachments SET deleted_at = ?
       WHERE deleted_at IS NULL
         AND (tombstone = 1 OR NOT ${TRANSACTION_IS_LIVE})`,
    [now],
  );
  // The delete was undone. Only live rows: a removed attachment keeps its
  // removal time even though its transaction is live, or it would never be
  // purged.
  const unstamped = db.runQuery(
    `UPDATE transaction_attachments SET deleted_at = NULL
       WHERE tombstone = 0 AND deleted_at IS NOT NULL
         AND ${TRANSACTION_IS_LIVE}`,
  );
  return {
    stamped: Number(stamped.changes),
    unstamped: Number(unstamped.changes),
  };
}

// Step 2. Rows first, then files. A file left behind if removing it fails is
// picked up by step 3 later.
async function purgeRows(budgetId: string, cutoff: number): Promise<number> {
  // The select and the delete run with nothing awaited in between, so both
  // see the same database
  const condition = `deleted_at IS NOT NULL AND deleted_at <= ?
    AND (tombstone = 1 OR NOT ${TRANSACTION_IS_LIVE})`;
  const rows = db.runQuery<{ id: string }>(
    `SELECT id FROM transaction_attachments WHERE ${condition}`,
    [cutoff],
    true,
  );
  if (rows.length === 0) {
    return 0;
  }
  db.runQuery(`DELETE FROM transaction_attachments WHERE ${condition}`, [
    cutoff,
  ]);

  for (const { id } of rows) {
    if (!isSafeAttachmentId(id)) {
      continue;
    }
    try {
      await removeAttachmentFile(budgetId, id);
    } catch (error) {
      logger.warn(`Attachment cleanup: failed to remove file ${id}`, error);
    }
  }
  return rows.length;
}

// Steps 3 and 4. A file with no row is removed once it has had no row for
// the whole grace period. A temporary file is removed the next time cleanup
// finds it, rather than straight away, so a save in progress isn't disturbed.
async function removeUnusedFiles(
  budgetId: string,
  {
    now,
    cutoff,
    isOpen,
  }: { now: number; cutoff: number; isOpen: () => boolean },
): Promise<number> {
  const dir = getAttachmentsDir(budgetId);
  if (!(await fs.exists(dir))) {
    return 0;
  }

  const names = await fs.listDir(dir);
  const firstSeen = await readUnusedFiles(dir);
  if (!isOpen()) {
    return 0;
  }
  // All rows, removed ones included: their files are step 2's to remove
  const rowIds = new Set(
    db
      .runQuery<{
        id: string;
      }>('SELECT id FROM transaction_attachments', [], true)
      .map(row => row.id),
  );

  const nextFirstSeen: Record<string, number> = {};
  let removed = 0;
  for (const name of names) {
    const isTemp = name.endsWith(TEMP_SUFFIX);
    const id = isTemp ? name.slice(0, -TEMP_SUFFIX.length) : name;
    // Also skips the list of unused files itself
    if (!isSafeAttachmentId(id) || (!isTemp && rowIds.has(id))) {
      continue;
    }

    const seen = firstSeen[name];
    const isDue = isTemp ? seen != null : seen != null && seen <= cutoff;
    if (!isDue) {
      nextFirstSeen[name] = seen ?? now;
      continue;
    }
    try {
      await fs.removeFile(fs.join(dir, name));
      removed++;
    } catch (error) {
      logger.warn(`Attachment cleanup: failed to remove file ${name}`, error);
      nextFirstSeen[name] = seen;
    }
  }

  await writeUnusedFiles(dir, firstSeen, nextFirstSeen);
  return removed;
}

async function readUnusedFiles(dir: string): Promise<Record<string, number>> {
  const path = fs.join(dir, UNUSED_FILES_NAME);
  try {
    if (!(await fs.exists(path))) {
      return {};
    }
    const parsed: unknown = JSON.parse(await fs.readFile(path));
    const result: Record<string, number> = {};
    if (parsed != null && typeof parsed === 'object') {
      for (const [name, seen] of Object.entries(parsed)) {
        if (typeof seen === 'number') {
          result[name] = seen;
        }
      }
    }
    return result;
  } catch (error) {
    // Starting over only delays removing files, so that's safe
    logger.warn('Attachment cleanup: ignoring an unreadable list', error);
    return {};
  }
}

async function writeUnusedFiles(
  dir: string,
  previous: Record<string, number>,
  next: Record<string, number>,
) {
  const path = fs.join(dir, UNUSED_FILES_NAME);
  const isEmpty = Object.keys(next).length === 0;
  if (JSON.stringify(previous) === JSON.stringify(next)) {
    return;
  }
  if (isEmpty) {
    if (await fs.exists(path)) {
      await fs.removeFile(path);
    }
    return;
  }
  await fs.writeFile(path, JSON.stringify(next));
}
