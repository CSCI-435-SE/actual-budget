import type { Database } from '@jlongster/sql.js';

import { logger } from '#platform/server/log';
import * as sqlite from '#platform/server/sqlite';
import { validateAttachment } from '#shared/attachments';

import {
  isSafeAttachmentId,
  readAttachmentFile,
  writeAttachmentFile,
} from './storage';

// How attachments travel in a budget zip: each file is an entry at
// `attachments/<id>`, next to `db.sqlite` and `metadata.json`. Only the
// user's own export carries them; the snapshot uploaded to the sync server
// never does (see `clearAttachmentRows`).

export const ATTACHMENTS_ZIP_DIR = 'attachments/';

function hasAttachmentsTable(database: Database): boolean {
  const rows = sqlite.runQuery<{ name: string }>(
    database,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transaction_attachments'",
    [],
    true,
  );
  return rows.length > 0;
}

// Attachment rows only describe files on this device, so a copy of the
// database that leaves the device without its files mustn't keep them.
// Otherwise a device that downloads it would list attachments it can't open.
export function clearAttachmentRows(database: Database) {
  if (hasAttachmentsTable(database)) {
    sqlite.execQuery(database, 'DELETE FROM transaction_attachments');
  }
}

// The zip entries for every attachment that `database` lists. A row whose
// file is missing is exported without a file and shows as missing after
// import, the same as it does here.
export async function collectAttachmentEntries(
  budgetId: string,
  database: Database,
): Promise<Record<string, Uint8Array>> {
  if (!hasAttachmentsTable(database)) {
    return {};
  }

  const rows = sqlite.runQuery<{ id: string }>(
    database,
    'SELECT id FROM transaction_attachments WHERE tombstone = 0 ORDER BY id',
    [],
    true,
  );

  const entries: Record<string, Uint8Array> = {};
  for (const { id } of rows) {
    if (!isSafeAttachmentId(id)) {
      continue;
    }
    const data = await readAttachmentFile(budgetId, id);
    if (data == null) {
      logger.warn(`Attachment ${id} has no file; exporting it without one`);
      continue;
    }
    entries[ATTACHMENTS_ZIP_DIR + id] = data;
  }
  return entries;
}

// Writes the attachment files found in an unzipped budget into the budget's
// folder. `dir` is the folder inside the zip that holds `db.sqlite`. An
// imported file isn't trusted: entries with unexpected names, and files that
// fail the same checks as a new attachment, are skipped.
export async function restoreAttachmentEntries(
  budgetId: string,
  entries: Record<string, Uint8Array>,
  dir: string,
): Promise<number> {
  const prefix = dir + ATTACHMENTS_ZIP_DIR;
  let restored = 0;

  for (const [name, data] of Object.entries(entries)) {
    if (!name.startsWith(prefix)) {
      continue;
    }
    const id = name.slice(prefix.length);
    // Skips folder entries ("attachments/") and anything nested
    if (!isSafeAttachmentId(id)) {
      continue;
    }
    if (!validateAttachment(data).ok) {
      logger.warn(`Skipping imported attachment ${id}: failed validation`);
      continue;
    }

    try {
      await writeAttachmentFile(budgetId, id, data);
      restored++;
    } catch (error) {
      // The rest of the budget is still usable; this attachment will show
      // as missing
      logger.warn(`Failed to restore imported attachment ${id}`, error);
    }
  }

  return restored;
}
