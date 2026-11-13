import * as fs from '#platform/server/fs';
import { logger } from '#platform/server/log';

// Attachment files are stored on this device at
// <budgetDir>/attachments/<attachmentId>. In the browser, the fs layer keeps
// them in IndexedDB; on desktop they are ordinary files.

const ATTACHMENTS_DIR = 'attachments';
const TEMP_SUFFIX = '.tmp';

// The id becomes part of a path, so only allow characters a uuid can contain
export function isSafeAttachmentId(attachmentId: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(attachmentId);
}

function assertSafeAttachmentId(attachmentId: string) {
  if (!isSafeAttachmentId(attachmentId)) {
    throw new Error(`Invalid attachment id: "${attachmentId}"`);
  }
}

export function getAttachmentsDir(budgetId: string): string {
  return fs.join(fs.getBudgetDir(budgetId), ATTACHMENTS_DIR);
}

export function getAttachmentPath(
  budgetId: string,
  attachmentId: string,
): string {
  assertSafeAttachmentId(attachmentId);
  return fs.join(getAttachmentsDir(budgetId), attachmentId);
}

async function ensureAttachmentsDir(budgetId: string) {
  const dir = getAttachmentsDir(budgetId);
  if (!(await fs.exists(dir))) {
    await fs.mkdir(dir);
  }
}

// Writes the file to a temporary path first and renames it into place, so a
// file at the final path is always complete. If anything fails, the temporary
// file is removed and the error is rethrown.
export async function writeAttachmentFile(
  budgetId: string,
  attachmentId: string,
  data: Uint8Array,
): Promise<void> {
  const finalPath = getAttachmentPath(budgetId, attachmentId);
  const tempPath = finalPath + TEMP_SUFFIX;

  await ensureAttachmentsDir(budgetId);

  try {
    // Copy into a buffer of its own: the browser fs layer stores a view's
    // whole underlying buffer, which would be wrong for a view with an offset
    await fs.writeFile(tempPath, new Uint8Array(data));
    await fs.rename(tempPath, finalPath);
  } catch (error) {
    await removeIfExists(tempPath);
    throw error;
  }
}

// Returns the file's contents, or null when the file isn't on this device
export async function readAttachmentFile(
  budgetId: string,
  attachmentId: string,
): Promise<Uint8Array | null> {
  const path = getAttachmentPath(budgetId, attachmentId);
  if (!(await fs.exists(path))) {
    return null;
  }
  return fs.readFile(path, 'binary');
}

// Removes the file. Does nothing if it is already gone.
export async function removeAttachmentFile(
  budgetId: string,
  attachmentId: string,
): Promise<void> {
  const path = getAttachmentPath(budgetId, attachmentId);
  if (await fs.exists(path)) {
    await fs.removeFile(path);
  }
}

async function removeIfExists(path: string) {
  try {
    if (await fs.exists(path)) {
      await fs.removeFile(path);
    }
  } catch (error) {
    // Don't hide the original error; a leftover .tmp file is never read
    logger.warn(`Failed to remove temporary attachment file ${path}`, error);
  }
}
