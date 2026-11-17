import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as fs from '#platform/server/fs';
import { app as accountsApp } from '#server/accounts/app';
import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import * as prefs from '#server/prefs';
import { transactionAttachmentCountsQuery } from '#shared/attachments';
import type { TransactionAttachmentCount } from '#shared/attachments';

import { app } from './app';
import { ATTACHMENT_GRACE_MS, cleanUpAttachments } from './cleanup';

vi.mock('#platform/server/connection', () => ({
  init: vi.fn(),
  send: vi.fn(),
  resetEvents: vi.fn(),
}));

// `prefs.loadPrefs()` uses this id in tests
const BUDGET_ID = 'test';
const GRACE = ATTACHMENT_GRACE_MS;
const T0 = 1_000_000_000_000;

const PDF = new Uint8Array([...'%PDF-1.7\n'].map(c => c.charCodeAt(0)));

let documentDir: string;

function attachmentsDir() {
  return path.join(documentDir, BUDGET_ID, 'attachments');
}

function attachmentFiles(): string[] {
  const dir = attachmentsDir();
  return nativeFs.existsSync(dir) ? nativeFs.readdirSync(dir).sort() : [];
}

function writeFile(name: string) {
  nativeFs.mkdirSync(attachmentsDir(), { recursive: true });
  nativeFs.writeFileSync(path.join(attachmentsDir(), name), PDF);
}

function rows() {
  return db.runQuery<{
    id: string;
    tombstone: number;
    deleted_at: number | null;
  }>(
    'SELECT id, tombstone, deleted_at FROM transaction_attachments ORDER BY id',
    [],
    true,
  );
}

function setTransactionDeleted(id: string, deleted: boolean) {
  db.runQuery('UPDATE transactions SET tombstone = ? WHERE id = ?', [
    deleted ? 1 : 0,
    id,
  ]);
}

async function add(transactionId = 'plain') {
  const result = await app.handlers['attachment-add']({
    transactionId,
    fileName: 'receipt.pdf',
    data: PDF,
  });
  if (!('attachment' in result)) {
    throw new Error('setup failed');
  }
  return result.attachment.id;
}

function cleanUp(now: number) {
  return cleanUpAttachments(BUDGET_ID, { now, graceMs: GRACE });
}

beforeEach(async () => {
  await global.emptyDatabase()();
  await prefs.loadPrefs();

  documentDir = nativeFs.mkdtempSync(
    path.join(os.tmpdir(), 'actual-attachments-cleanup-'),
  );
  fs._setDocumentDir(documentDir);
  nativeFs.mkdirSync(path.join(documentDir, BUDGET_ID));

  db.runQuery(
    "INSERT INTO accounts (id, name, offbudget, closed, sort_order) VALUES ('acct1', 'Checking', 0, 0, 1)",
  );
  db.runQuery(
    `INSERT INTO transactions (id, isParent, isChild, acct, amount, date, parent_id, sort_order, tombstone)
       VALUES ('plain', 0, 0, 'acct1', -1000, 20261113, NULL, 1, 0),
              ('parent', 1, 0, 'acct1', -3000, 20261113, NULL, 2, 0),
              ('child', 0, 1, 'acct1', -3000, 20261113, 'parent', 3, 0),
              ('other', 0, 0, 'acct1', -500, 20261113, NULL, 4, 0)`,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  prefs.unloadPrefs();
  nativeFs.rmSync(documentDir, { recursive: true, force: true });
});

describe("a deleted transaction's attachments", () => {
  it('are stamped, then removed after the grace period and not before', async () => {
    const id = await add('plain');
    const kept = await add('other');
    setTransactionDeleted('plain', true);

    expect(await cleanUp(T0)).toEqual({
      stamped: 1,
      unstamped: 0,
      purged: 0,
      removedFiles: 0,
    });
    expect(rows()).toEqual(
      [
        { id, tombstone: 0, deleted_at: T0 },
        { id: kept, tombstone: 0, deleted_at: null },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );

    await cleanUp(T0 + GRACE - 1);
    expect(attachmentFiles()).toEqual([id, kept].sort());

    expect((await cleanUp(T0 + GRACE)).purged).toBe(1);
    expect(rows().map(row => row.id)).toEqual([kept]);
    expect(attachmentFiles()).toEqual([kept]);
  });

  it("include a split's, when the parent is deleted", async () => {
    await add('child');
    setTransactionDeleted('parent', true);

    await cleanUp(T0);
    await cleanUp(T0 + GRACE);

    expect(rows()).toEqual([]);
    expect(attachmentFiles()).toEqual([]);
  });

  it('are unstamped and never removed when the delete is undone', async () => {
    const id = await add('plain');
    setTransactionDeleted('plain', true);
    await cleanUp(T0);
    setTransactionDeleted('plain', false);

    expect((await cleanUp(T0 + 1)).unstamped).toBe(1);
    await cleanUp(T0 + 2 * GRACE);

    expect(rows()).toEqual([{ id, tombstone: 0, deleted_at: null }]);
    expect(attachmentFiles()).toEqual([id]);
  });

  it('are removed in the same run with a grace period of 0', async () => {
    await add('plain');
    setTransactionDeleted('plain', true);

    await cleanUpAttachments(BUDGET_ID, { now: T0, graceMs: 0 });

    expect(rows()).toEqual([]);
    expect(attachmentFiles()).toEqual([]);
  });
});

describe("a deleted account's attachments", () => {
  async function counts() {
    const { data } = await aqlQuery(transactionAttachmentCountsQuery());
    return (data as TransactionAttachmentCount[])
      .filter(row => row.transaction_id != null)
      .map(row => row.transaction_id)
      .sort();
  }

  beforeEach(() => {
    db.runQuery(
      "INSERT INTO accounts (id, name, offbudget, closed, sort_order) VALUES ('acct2', 'Savings', 0, 0, 2)",
    );
    db.runQuery(
      `INSERT INTO payees (id, name, transfer_acct, tombstone)
         VALUES ('transfer-acct1', '', 'acct1', 0),
                ('transfer-acct2', '', 'acct2', 0)`,
    );
  });

  it('are hidden, then removed after the grace period, like its transactions', async () => {
    const id = await add('plain');
    await add('child');
    expect(await counts()).toEqual(['parent', 'plain']);

    await accountsApp.handlers['account-close']({ id: 'acct1', forced: true });

    expect(await counts()).toEqual([]);
    expect(attachmentFiles()).toHaveLength(2);
    expect(rows().find(row => row.id === id)?.tombstone).toBe(0);

    expect((await cleanUp(T0)).stamped).toBe(2);
    await cleanUp(T0 + GRACE - 1);
    expect(attachmentFiles()).toHaveLength(2);

    expect((await cleanUp(T0 + GRACE)).purged).toBe(2);
    expect(rows()).toEqual([]);
    expect(attachmentFiles()).toEqual([]);
  });

  it('are left alone when the account is closed without deleting them', async () => {
    // A zero balance, so closing needs no transfer
    db.runQuery(
      `INSERT INTO transactions (id, isParent, isChild, acct, amount, date, parent_id, sort_order, tombstone)
         VALUES ('zero', 0, 0, 'acct2', 0, 20261113, NULL, 5, 0)`,
    );
    const id = await add('zero');

    await accountsApp.handlers['account-close']({ id: 'acct2' });

    expect(
      db.runQuery<{ closed: number }>(
        "SELECT closed FROM accounts WHERE id = 'acct2'",
        [],
        true,
      ),
    ).toEqual([{ closed: 1 }]);
    expect(await counts()).toEqual(['zero']);

    await cleanUp(T0);
    await cleanUp(T0 + 2 * GRACE);

    expect(rows()).toEqual([{ id, tombstone: 0, deleted_at: null }]);
    expect(attachmentFiles()).toEqual([id]);
  });
});

describe('removed attachments', () => {
  it('are removed after the grace period, even on a live transaction', async () => {
    const now = vi.spyOn(Date, 'now');
    const id = await add('plain');
    const kept = await add('plain');
    now.mockReturnValue(T0);
    await app.handlers['attachment-remove']({ id });
    now.mockRestore();

    // Unstamping must leave the removal time alone
    expect(await cleanUp(T0 + 1)).toMatchObject({ stamped: 0, unstamped: 0 });
    expect(rows().find(row => row.id === id)?.deleted_at).toBe(T0);

    await cleanUp(T0 + GRACE - 1);
    expect(attachmentFiles()).toEqual([id, kept].sort());

    await cleanUp(T0 + GRACE);
    expect(rows().map(row => row.id)).toEqual([kept]);
    expect(attachmentFiles()).toEqual([kept]);
  });

  it('with no removal time (from an imported budget) are stamped', async () => {
    const id = await add('plain');
    db.runQuery(
      'UPDATE transaction_attachments SET tombstone = 1, deleted_at = NULL WHERE id = ?',
      [id],
    );

    expect((await cleanUp(T0)).stamped).toBe(1);
    await cleanUp(T0 + GRACE);

    expect(rows()).toEqual([]);
    expect(attachmentFiles()).toEqual([]);
  });
});

describe('files with no row', () => {
  it('are kept on first sighting and removed after the grace period', async () => {
    writeFile('orphan');

    expect((await cleanUp(T0)).removedFiles).toBe(0);
    expect(
      JSON.parse(
        nativeFs.readFileSync(
          path.join(attachmentsDir(), '.cleanup.json'),
          'utf8',
        ),
      ),
    ).toEqual({ orphan: T0 });

    await cleanUp(T0 + GRACE - 1);
    expect(attachmentFiles()).toEqual(['.cleanup.json', 'orphan']);

    expect((await cleanUp(T0 + GRACE)).removedFiles).toBe(1);
    // The list is removed once it is empty
    expect(attachmentFiles()).toEqual([]);
  });

  it('are kept when their row comes back (an import after a re-download)', async () => {
    const id = await add('plain');
    const [row] = db.runQuery<Record<string, string | number | null>>(
      'SELECT * FROM transaction_attachments',
      [],
      true,
    );
    db.runQuery('DELETE FROM transaction_attachments');

    await cleanUp(T0);
    db.runQuery(
      `INSERT INTO transaction_attachments
         (id, transaction_id, file_name, mime_type, size, storage, created_at, tombstone)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        row.id,
        row.transaction_id,
        row.file_name,
        row.mime_type,
        row.size,
        row.storage,
        row.created_at,
      ],
    );
    await cleanUp(T0 + GRACE);

    expect(attachmentFiles()).toEqual([id]);
  });

  it('are left alone when the name is not an attachment id', async () => {
    writeFile('notes.txt');

    await cleanUp(T0);
    await cleanUp(T0 + GRACE);

    expect(attachmentFiles()).toEqual(['notes.txt']);
  });
});

describe('temporary files', () => {
  it('are removed the next time cleanup finds them', async () => {
    writeFile('abc.tmp');

    await cleanUp(T0);
    expect(attachmentFiles()).toEqual(['.cleanup.json', 'abc.tmp']);

    expect((await cleanUp(T0 + 1)).removedFiles).toBe(1);
    expect(attachmentFiles()).toEqual([]);
  });
});

describe('cleanup', () => {
  it("never touches a live attachment's row or file", async () => {
    const id = await add('plain');

    await cleanUp(T0);
    await cleanUp(T0 + 10 * GRACE);

    expect(rows()).toEqual([{ id, tombstone: 0, deleted_at: null }]);
    expect(attachmentFiles()).toEqual([id]);
  });

  it('changes nothing when run twice in a row', async () => {
    await add('plain');
    const removed = await add('other');
    await app.handlers['attachment-remove']({ id: removed });
    setTransactionDeleted('plain', true);
    writeFile('orphan');
    await cleanUp(T0);
    const before = { rows: rows(), files: attachmentFiles() };

    expect(await cleanUp(T0)).toEqual({
      stamped: 0,
      unstamped: 0,
      purged: 0,
      removedFiles: 0,
    });
    expect({ rows: rows(), files: attachmentFiles() }).toEqual(before);
  });

  it('leaves no row pointing at a missing file when removing files fails', async () => {
    const id = await add('plain');
    setTransactionDeleted('plain', true);
    await cleanUp(T0);
    const removeFile = vi
      .spyOn(fs, 'removeFile')
      .mockRejectedValue(new Error('locked'));

    await cleanUp(T0 + GRACE);

    // The row is gone; the file stays, and is now listed as a file with no
    // row so a later run removes it
    expect(rows()).toEqual([]);
    expect(attachmentFiles()).toEqual(['.cleanup.json', id].sort());

    removeFile.mockRestore();
    await cleanUp(T0 + GRACE + 1);
    await cleanUp(T0 + 2 * GRACE + 1);
    expect(attachmentFiles()).toEqual([]);
  });

  it('carries on with the files when the rows step fails', async () => {
    writeFile('abc.tmp');
    await cleanUp(T0);
    const runQuery = db.runQuery;
    vi.spyOn(db, 'runQuery').mockImplementation(((
      ...args: Parameters<typeof runQuery>
    ) => {
      if (String(args[0]).trimStart().startsWith('UPDATE')) {
        throw new Error('database is locked');
      }
      return runQuery(...args);
    }) as typeof runQuery);

    expect((await cleanUp(T0 + 1)).removedFiles).toBe(1);
  });

  it('does nothing when another budget is open', async () => {
    await add('plain');
    setTransactionDeleted('plain', true);

    await cleanUpAttachments('another-budget', { now: T0, graceMs: 0 });

    expect(rows()).toHaveLength(1);
  });
});

describe('attachments-cleanup', () => {
  it('cleans up the open budget', async () => {
    await add('plain');
    setTransactionDeleted('plain', true);

    expect(await app.handlers['attachments-cleanup']()).toEqual({
      stamped: 1,
      unstamped: 0,
      purged: 0,
      removedFiles: 0,
    });
  });

  it('needs an open budget', async () => {
    prefs.unloadPrefs();

    expect(await app.handlers['attachments-cleanup']()).toEqual({
      error: { reason: 'no-budget' },
    });
  });
});
