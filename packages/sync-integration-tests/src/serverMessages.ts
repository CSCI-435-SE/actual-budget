import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { openDatabase } from '@actual-app/sync-server/src/db';

import type { SyncServerHandle } from './startSyncServer';

/**
 * Counts the sync messages the server has stored for `groupId`, read
 * straight from its group database. 0 if nothing has been synced yet.
 */
export function countServerMessages(
  server: SyncServerHandle,
  groupId: string,
): number {
  const path = join(server.userFiles, `group-${groupId}.sqlite`);
  if (!existsSync(path)) {
    return 0;
  }
  const db = openDatabase(path);
  try {
    return db.first('SELECT count(*) AS count FROM messages_binary').count;
  } finally {
    db.close();
  }
}
