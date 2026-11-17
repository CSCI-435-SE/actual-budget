import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { zipSync } from 'fflate';

import * as fs from '#platform/server/fs';
import * as sqlite from '#platform/server/sqlite';
import { exportBuffer, importBuffer } from '#server/cloud-storage';
import * as db from '#server/db';
import * as prefs from '#server/prefs';
import { safeUnzip } from '#server/util/zip';

import { app } from './app';

// `prefs.loadPrefs()` uses this id in tests
const BUDGET_ID = 'test';

const PDF = new Uint8Array([...'%PDF-1.7\n'].map(c => c.charCodeAt(0)));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = new Uint8Array([...'GIF89a'].map(c => c.charCodeAt(0)));

// fflate stamps each zip entry with the current date in DOS format, which
// rejects the fake pre-1980 clock the test setup freezes `Date.now` to
const testGlobal = global as unknown as {
  restoreDateNow: () => void;
  restoreFakeDateNow: () => void;
};

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'actual-archive-'));
  tempDirs.push(dir);
  return dir;
}

function useDocumentDir(): string {
  const dir = makeTempDir();
  fs._setDocumentDir(dir);
  return dir;
}

function budgetDir(documentDir: string): string {
  return path.join(documentDir, BUDGET_ID);
}

function attachmentFiles(documentDir: string): string[] {
  const dir = path.join(budgetDir(documentDir), 'attachments');
  return nativeFs.existsSync(dir) ? nativeFs.readdirSync(dir).sort() : [];
}

async function addAttachment(fileName: string, data: Uint8Array) {
  const result = await app.handlers['attachment-add']({
    transactionId: 'trans1',
    fileName,
    data,
  });
  if (!('attachment' in result)) {
    throw new Error('Failed to add attachment');
  }
  return result.attachment;
}

// Saves the in-memory test database as the budget's db.sqlite, which is what
// `exportBuffer` reads
async function saveBudgetToDisk(documentDir: string) {
  const database = db.getDatabase();
  if (database == null) {
    throw new Error('No database is open');
  }
  nativeFs.writeFileSync(
    path.join(budgetDir(documentDir), 'db.sqlite'),
    await sqlite.exportDatabase(database),
  );
}

async function attachmentRowIds(dbContent: Uint8Array): Promise<string[]> {
  const database = await sqlite.openDatabase(Buffer.from(dbContent));
  const rows = sqlite.runQuery<{ id: string }>(
    database,
    'SELECT id FROM transaction_attachments ORDER BY id',
    [],
    true,
  );
  sqlite.closeDatabase(database);
  return rows.map(row => row.id);
}

let documentDir: string;

beforeEach(async () => {
  testGlobal.restoreDateNow();
  await global.emptyDatabase()();
  await prefs.loadPrefs();

  process.env.ACTUAL_DATA_DIR = makeTempDir();
  documentDir = useDocumentDir();
  nativeFs.mkdirSync(budgetDir(documentDir));
  nativeFs.writeFileSync(
    path.join(budgetDir(documentDir), 'metadata.json'),
    JSON.stringify({ id: BUDGET_ID, budgetName: 'Test budget' }),
  );

  db.runQuery(
    "INSERT INTO accounts (id, name, offbudget, closed, sort_order) VALUES ('acct1', 'Checking', 0, 0, 1)",
  );
  db.runQuery(
    "INSERT INTO transactions (id, acct, amount, date, sort_order) VALUES ('trans1', 'acct1', -1000, 20261113, 1)",
  );
});

afterEach(() => {
  testGlobal.restoreFakeDateNow();
  prefs.unloadPrefs();
  for (const dir of tempDirs.splice(0)) {
    nativeFs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('exporting a budget', () => {
  it("includes each attachment's file and keeps the rows", async () => {
    const pdf = await addAttachment('receipt.pdf', PDF);
    const png = await addAttachment('photo.png', PNG);
    await saveBudgetToDisk(documentDir);

    const exported = await exportBuffer({ includeAttachments: true });
    const entries = safeUnzip(exported!.data);

    expect(Object.keys(entries).sort()).toEqual(
      [
        'db.sqlite',
        'metadata.json',
        `attachments/${pdf.id}`,
        `attachments/${png.id}`,
      ].sort(),
    );
    expect(Array.from(entries[`attachments/${pdf.id}`])).toEqual(
      Array.from(PDF),
    );
    expect(await attachmentRowIds(entries['db.sqlite'])).toEqual(
      [pdf.id, png.id].sort(),
    );
  });

  it('leaves out files no row points to, and rows whose file is gone', async () => {
    const kept = await addAttachment('receipt.pdf', PDF);
    const lost = await addAttachment('photo.png', PNG);
    nativeFs.rmSync(path.join(budgetDir(documentDir), 'attachments', lost.id));
    nativeFs.writeFileSync(
      path.join(budgetDir(documentDir), 'attachments', 'stray'),
      PDF,
    );
    await saveBudgetToDisk(documentDir);

    const exported = await exportBuffer({ includeAttachments: true });
    const entries = safeUnzip(exported!.data);

    expect(
      Object.keys(entries).filter(name => name.startsWith('attachments/')),
    ).toEqual([`attachments/${kept.id}`]);
    // The row stays, so the attachment shows as missing after import
    expect(await attachmentRowIds(entries['db.sqlite'])).toEqual(
      [kept.id, lost.id].sort(),
    );
  });
});

describe('the snapshot uploaded to the sync server', () => {
  it('has no attachment rows or files, and the local budget keeps both', async () => {
    const attachment = await addAttachment('receipt.pdf', PDF);
    await saveBudgetToDisk(documentDir);

    const exported = await exportBuffer({ includeAttachments: false });
    const entries = safeUnzip(exported!.data);

    expect(Object.keys(entries).sort()).toEqual(['db.sqlite', 'metadata.json']);
    expect(await attachmentRowIds(entries['db.sqlite'])).toEqual([]);

    const localDb = nativeFs.readFileSync(
      path.join(budgetDir(documentDir), 'db.sqlite'),
    );
    expect(await attachmentRowIds(localDb)).toEqual([attachment.id]);
    expect(attachmentFiles(documentDir)).toEqual([attachment.id]);
  });
});

describe('importing a budget', () => {
  it('restores the attachment files from an export', async () => {
    const pdf = await addAttachment('receipt.pdf', PDF);
    const png = await addAttachment('photo.png', PNG);
    await saveBudgetToDisk(documentDir);
    const exported = await exportBuffer({ includeAttachments: true });

    // Import on a "different device"
    const otherDocumentDir = useDocumentDir();
    await importBuffer({ fileId: null, groupId: null }, exported!.data);

    expect(attachmentFiles(otherDocumentDir)).toEqual([pdf.id, png.id].sort());
    expect(
      Array.from(
        nativeFs.readFileSync(
          path.join(budgetDir(otherDocumentDir), 'attachments', png.id),
        ),
      ),
    ).toEqual(Array.from(PNG));
    expect(
      await attachmentRowIds(
        nativeFs.readFileSync(
          path.join(budgetDir(otherDocumentDir), 'db.sqlite'),
        ),
      ),
    ).toEqual([pdf.id, png.id].sort());
  });

  it('restores attachments from a zip that keeps the budget in a folder', async () => {
    await saveBudgetToDisk(documentDir);
    const exported = await exportBuffer({ includeAttachments: true });
    const entries = safeUnzip(exported!.data);
    const nested = zipSync({
      'My Budget/db.sqlite': entries['db.sqlite'],
      'My Budget/metadata.json': entries['metadata.json'],
      'My Budget/attachments/att-1': PDF,
    });

    const otherDocumentDir = useDocumentDir();
    await importBuffer({ fileId: null, groupId: null }, nested);

    expect(attachmentFiles(otherDocumentDir)).toEqual(['att-1']);
  });

  it('skips entries with unexpected names or contents', async () => {
    await saveBudgetToDisk(documentDir);
    const exported = await exportBuffer({ includeAttachments: true });
    const entries = safeUnzip(exported!.data);
    const zip = zipSync({
      'db.sqlite': entries['db.sqlite'],
      'metadata.json': entries['metadata.json'],
      'attachments/good': PNG,
      // Not an allowed type
      'attachments/gif': GIF,
      // Empty
      'attachments/empty': new Uint8Array(),
      // Names that aren't attachment ids
      'attachments/nested/file': PDF,
      'attachments/has space': PDF,
      'other/thing': PDF,
    });

    const otherDocumentDir = useDocumentDir();
    await importBuffer({ fileId: null, groupId: null }, zip);

    expect(attachmentFiles(otherDocumentDir)).toEqual(['good']);
  });

  it('imports a budget with no attachments', async () => {
    await saveBudgetToDisk(documentDir);
    const exported = await exportBuffer({ includeAttachments: false });

    const otherDocumentDir = useDocumentDir();
    await importBuffer({ fileId: null, groupId: null }, exported!.data);

    expect(attachmentFiles(otherDocumentDir)).toEqual([]);
    expect(
      nativeFs.existsSync(path.join(budgetDir(otherDocumentDir), 'db.sqlite')),
    ).toBe(true);
  });
});
