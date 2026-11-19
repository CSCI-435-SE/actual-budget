import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type SyncServerHandle = {
  url: string;
  port: number;
  /** Temporary root holding `serverFiles`, `userFiles` and migration state */
  dataDir: string;
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
  let port: number;
  try {
    // Migrations must run before the app is imported: the app's modules
    // touch the account database as they load.
    const { run: runMigrations } = await import('#migrations');
    await runMigrations();

    const { app } = await import('#app');
    server = await listen(app.listen(0, '127.0.0.1'));

    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected the sync server to listen on a TCP port');
    }
    port = address.port;
  } catch (error) {
    await cleanUp(server, rootDir);
    throw error;
  } finally {
    restoreEnv();
  }

  const listeningServer = server;
  let shutdownPromise: Promise<void> | null = null;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    dataDir: rootDir,
    serverFiles,
    userFiles,
    // Safe to call more than once: later calls wait on the first
    shutdown() {
      shutdownPromise ??= cleanUp(listeningServer, rootDir);
      return shutdownPromise;
    },
  };
}

async function cleanUp(server: Server | undefined, rootDir: string) {
  try {
    if (server?.listening) {
      await closeServer(server);
    }
  } finally {
    // Windows can't delete account.sqlite while it is still open, so close
    // it first, even if closing the server failed
    const { closeAccountDb } = await import('#account-db');
    closeAccountDb();
    await removeDir(rootDir);
  }
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
