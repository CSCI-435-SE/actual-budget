import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { openDatabase } from '#db';

import type { SyncServerHandle } from './startSyncServer';

/**
 * Counts the sync messages the server has stored for `groupId`, read
 * straight from its group database. 0 if nothing has been synced yet.
 */
export function countServerMessages(
  server: SyncServerHandle,
  groupId: string,
): number {
  return countServerMessagesWhere(server, groupId, '');
}

/** How many of the group's stored messages are end-to-end encrypted. */
export function countEncryptedServerMessages(
  server: SyncServerHandle,
  groupId: string,
): number {
  return countServerMessagesWhere(server, groupId, 'WHERE is_encrypted = 1');
}

function countServerMessagesWhere(
  server: SyncServerHandle,
  groupId: string,
  where: string,
): number {
  const path = join(server.userFiles, `group-${groupId}.sqlite`);
  if (!existsSync(path)) {
    return 0;
  }
  const db = openDatabase(path);
  try {
    return db.first(`SELECT count(*) AS count FROM messages_binary ${where}`)
      .count;
  } finally {
    db.close();
  }
}
