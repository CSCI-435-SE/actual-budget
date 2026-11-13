import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type SyncServerHandle = {
  url: string;
  port: number;
  serverFiles: string;
  userFiles: string;
  shutdown: () => Promise<void>;
};

let hasStarted = false;

/**
 * Starts the real sync-server app in this process on a random free port,
 * with fresh temporary `serverFiles` and `userFiles` directories.
 *
 * sync-server loads its config once, when its modules are first imported,
 * so this can only be called once per module graph (i.e. once per test
 * file under Vitest's default isolation).
 */
export async function startSyncServer(): Promise<SyncServerHandle> {
  if (hasStarted) {
    throw new Error(
      'startSyncServer() was already called in this module graph. ' +
        'sync-server reads its config once at import; use one server per test file.',
    );
  }
  hasStarted = true;

  const rootDir = await mkdtemp(join(tmpdir(), 'actual-sync-server-'));
  const serverFiles = join(rootDir, 'server-files');
  const userFiles = join(rootDir, 'user-files');

  // The migration state file lives in `dataDir`, so it must be temporary
  // too: a stale state file elsewhere would make migrations skip creating
  // the tables in the fresh account.sqlite. The config path points at a
  // file that doesn't exist so no developer config.json is picked up.
  const restoreEnv = setEnv({
    ACTUAL_CONFIG_PATH: join(rootDir, 'config.json'),
    ACTUAL_DATA_DIR: rootDir,
    ACTUAL_SERVER_FILES: serverFiles,
    ACTUAL_USER_FILES: userFiles,
  });

  let server: Server | undefined;
  try {
    // Migrations must run before the app is imported: the app's modules
    // touch the account database as they load.
    const { run: runMigrations } =
      await import('@actual-app/sync-server/src/migrations');
    await runMigrations();

    const { app } = await import('@actual-app/sync-server/src/app');
    server = await listen(app.listen(0, '127.0.0.1'));
  } catch (error) {
    await removeDir(rootDir);
    throw error;
  } finally {
    restoreEnv();
  }

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected the sync server to listen on a TCP port');
  }

  const { closeAccountDb } =
    await import('@actual-app/sync-server/src/account-db');
  const listeningServer = server;
  let shutdownPromise: Promise<void> | null = null;

  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    serverFiles,
    userFiles,
    shutdown() {
      shutdownPromise ??= (async () => {
        await closeServer(listeningServer);
        // Windows can't delete account.sqlite while it is still open
        closeAccountDb();
        await removeDir(rootDir);
      })();
      return shutdownPromise;
    },
  };
}

function setEnv(values: Record<string, string>): () => void {
  const previous = Object.fromEntries(
    Object.keys(values).map(key => [key, process.env[key]]),
  );
  Object.assign(process.env, values);

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function listen(server: Server): Promise<Server> {
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
    // Drop keep-alive connections so close() doesn't wait on them
    server.closeAllConnections();
  });
}

function removeDir(dir: string): Promise<void> {
  return rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
