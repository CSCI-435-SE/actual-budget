import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as exceptions from '#platform/exceptions';
import * as connection from '#platform/server/connection';
import * as fs from '#platform/server/fs';
import { logger } from '#platform/server/log';
import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import * as prefs from '#server/prefs';
import {
  ATTACHMENT_MAX_SIZE,
  ATTACHMENT_MIME_TYPES,
  transactionAttachmentCountsQuery,
  transactionAttachmentsQuery,
} from '#shared/attachments';
import type { TransactionAttachmentCount } from '#shared/attachments';
import type { TransactionAttachmentEntity } from '#types/models';

import { app, moveAttachments } from './app';
import * as storage from './storage';

vi.mock('#platform/server/connection', () => ({
  init: vi.fn(),
  send: vi.fn(),
  resetEvents: vi.fn(),
}));

// `prefs.loadPrefs()` uses this id in tests
const BUDGET_ID = 'test';

const PDF = new Uint8Array([...'%PDF-1.7\n'].map(c => c.charCodeAt(0)));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const addAttachment = app.handlers['attachment-add'];
const removeAttachment = app.handlers['attachment-remove'];
const listAttachments = app.handlers['attachment-list'];
const readAttachment = app.handlers['attachment-read'];
const restoreAttachment = app.handlers['attachment-restore'];

let documentDir: string;

function attachmentFiles(): string[] {
  const dir = path.join(documentDir, BUDGET_ID, 'attachments');
  return nativeFs.existsSync(dir) ? nativeFs.readdirSync(dir).sort() : [];
}

// Live rows only; see `removedRows` for removed ones
function attachmentRows() {
  return db.runQuery<{ id: string; transaction_id: string }>(
    'SELECT id, transaction_id FROM transaction_attachments WHERE tombstone = 0 ORDER BY id',
    [],
    true,
  );
}

function removedRows() {
  return db.runQuery<{ id: string; deleted_at: number | null }>(
    'SELECT id, deleted_at FROM transaction_attachments WHERE tombstone = 1 ORDER BY id',
    [],
    true,
  );
}

async function add(transactionId: string, data: Uint8Array = PDF) {
  const result = await addAttachment({
    transactionId,
    fileName: 'receipt.pdf',
    data,
  });
  if (!('attachment' in result)) {
    throw new Error('setup failed');
  }
  return result.attachment;
}

function syncEvents() {
  return vi
    .mocked(connection.send)
    .mock.calls.filter(([name]) => name === 'sync-event');
}

beforeEach(async () => {
  await global.emptyDatabase()();
  await prefs.loadPrefs();

  vi.mocked(connection.send).mockClear();

  documentDir = nativeFs.mkdtempSync(
    path.join(os.tmpdir(), 'actual-attachments-app-'),
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
              ('deleted', 0, 0, 'acct1', -500, 20261113, NULL, 4, 1),
              ('orphan-child', 0, 1, 'acct1', -500, 20261113, 'deleted', 5, 0),
              ('lost-child', 0, 1, 'acct1', -500, 20261113, 'gone', 6, 0)`,
  );
});

afterEach(() => {
  prefs.unloadPrefs();
  nativeFs.rmSync(documentDir, { recursive: true, force: true });
});

describe('attachment-add', () => {
  it('stores the file and a row, and tells the UI', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);

    const result = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.pdf',
      data: PDF.buffer,
    });

    expect(result).toEqual({
      attachment: {
        id: expect.any(String),
        transaction_id: 'plain',
        file_name: 'receipt.pdf',
        mime_type: 'application/pdf',
        size: PDF.byteLength,
        storage: 'local',
        created_at: 1234,
        deleted_at: null,
        tombstone: false,
      },
    });
    const { id } = 'attachment' in result ? result.attachment : { id: '' };
    expect(attachmentFiles()).toEqual([id]);
    expect(attachmentRows()).toEqual([{ id, transaction_id: 'plain' }]);
    expect(syncEvents()).toEqual([
      ['sync-event', { type: 'applied', tables: ['transaction_attachments'] }],
    ]);

    vi.mocked(Date.now).mockRestore();
  });

  it('uses the type found in the contents, not the file name', async () => {
    const result = await addAttachment({
      transactionId: 'plain',
      fileName: 'not-really.pdf',
      data: PNG,
    });

    expect('attachment' in result && result.attachment.mime_type).toBe(
      'image/png',
    );
  });

  it('cleans up the file name', async () => {
    const result = await addAttachment({
      transactionId: 'plain',
      fileName: 'C:\\fakepath\\receipt.pdf',
      data: PDF,
    });

    expect('attachment' in result && result.attachment.file_name).toBe(
      'receipt.pdf',
    );
  });

  it("puts a split child's attachment on its parent", async () => {
    const result = await addAttachment({
      transactionId: 'child',
      fileName: 'receipt.pdf',
      data: PDF,
    });

    expect('attachment' in result && result.attachment.transaction_id).toBe(
      'parent',
    );
  });

  it.each([
    ['an empty file', new Uint8Array(), { reason: 'empty' }],
    [
      'a file over the limit',
      new Uint8Array(ATTACHMENT_MAX_SIZE + 1),
      { reason: 'too-large', maxSize: ATTACHMENT_MAX_SIZE },
    ],
    [
      'an unsupported type',
      new Uint8Array([...'GIF89a'].map(c => c.charCodeAt(0))),
      { reason: 'unsupported-type', allowed: ATTACHMENT_MIME_TYPES },
    ],
  ])('rejects %s and stores nothing', async (_, data, error) => {
    const result = await addAttachment({
      transactionId: 'plain',
      fileName: 'file',
      data,
    });

    expect(result).toEqual({ error });
    expect(attachmentFiles()).toEqual([]);
    expect(attachmentRows()).toEqual([]);
    expect(syncEvents()).toEqual([]);
  });

  // 'orphan-child' has a deleted parent; 'lost-child' has a parent_id that
  // points to no row at all
  it.each(['missing', 'deleted', 'orphan-child', 'lost-child'])(
    'rejects a transaction that is %s and stores nothing',
    async transactionId => {
      const result = await addAttachment({
        transactionId,
        fileName: 'receipt.pdf',
        data: PDF,
      });

      expect(result).toEqual({ error: { reason: 'transaction-not-found' } });
      expect(attachmentFiles()).toEqual([]);
      expect(attachmentRows()).toEqual([]);
    },
  );

  it('saves no row when writing the file fails', async () => {
    // `writeAttachmentFile` removes its own temporary file on failure (see
    // storage.test.ts); here it just has to fail
    const write = vi
      .spyOn(storage, 'writeAttachmentFile')
      .mockRejectedValue(new Error('disk full'));

    const result = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.pdf',
      data: PDF,
    });

    expect(write).toHaveBeenCalledOnce();
    expect(result).toEqual({ error: { reason: 'save-failed' } });
    expect(attachmentFiles()).toEqual([]);
    expect(attachmentRows()).toEqual([]);
    expect(syncEvents()).toEqual([]);

    write.mockRestore();
  });

  it('removes the file when saving the row fails', async () => {
    db.runQuery('DROP TABLE transaction_attachments');

    const result = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.pdf',
      data: PDF,
    });

    expect(result).toEqual({ error: { reason: 'save-failed' } });
    expect(attachmentFiles()).toEqual([]);
    expect(syncEvents()).toEqual([]);
  });

  it('needs an open budget', async () => {
    prefs.unloadPrefs();

    const result = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.pdf',
      data: PDF,
    });

    expect(result).toEqual({ error: { reason: 'no-budget' } });
  });
});

describe('attachment-list', () => {
  it("lists a transaction's attachments, oldest first", async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(2000);
    await addAttachment({
      transactionId: 'plain',
      fileName: 'b.pdf',
      data: PDF,
    });
    now.mockReturnValue(1000);
    await addAttachment({
      transactionId: 'plain',
      fileName: 'a.png',
      data: PNG,
    });
    await addAttachment({
      transactionId: 'parent',
      fileName: 'c.pdf',
      data: PDF,
    });
    now.mockRestore();

    const list = await listAttachments({ transactionId: 'plain' });

    expect(list.map(a => a.file_name)).toEqual(['a.png', 'b.pdf']);
  });

  it("lists a split child's attachments from its parent", async () => {
    await addAttachment({
      transactionId: 'parent',
      fileName: 'c.pdf',
      data: PDF,
    });

    expect(
      (await listAttachments({ transactionId: 'child' })).map(a => a.file_name),
    ).toEqual(['c.pdf']);
  });

  it('returns an empty list when there are none', async () => {
    expect(await listAttachments({ transactionId: 'plain' })).toEqual([]);
    expect(await listAttachments({ transactionId: 'missing' })).toEqual([]);
  });

  it('leaves out removed attachments', async () => {
    const removed = await add('plain');
    const kept = await add('plain');
    await removeAttachment({ id: removed.id });

    expect(
      (await listAttachments({ transactionId: 'plain' })).map(a => a.id),
    ).toEqual([kept.id]);
  });

  it('lists nothing for a deleted transaction until the delete is undone', async () => {
    await add('plain');
    await add('parent');
    db.runQuery(
      "UPDATE transactions SET tombstone = 1 WHERE id IN ('plain', 'parent')",
    );

    expect(await listAttachments({ transactionId: 'plain' })).toEqual([]);
    // A child of a deleted parent
    expect(await listAttachments({ transactionId: 'child' })).toEqual([]);

    db.runQuery(
      "UPDATE transactions SET tombstone = 0 WHERE id IN ('plain', 'parent')",
    );

    expect(await listAttachments({ transactionId: 'plain' })).toHaveLength(1);
    expect(await listAttachments({ transactionId: 'child' })).toHaveLength(1);
  });
});

describe('attachment-remove', () => {
  it('hides the row, keeps the file, and tells the UI', async () => {
    const added = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.pdf',
      data: PDF,
    });
    const kept = await addAttachment({
      transactionId: 'plain',
      fileName: 'other.pdf',
      data: PDF,
    });
    if (!('attachment' in added) || !('attachment' in kept)) {
      throw new Error('setup failed');
    }
    vi.mocked(connection.send).mockClear();
    vi.spyOn(Date, 'now').mockReturnValue(5678);

    expect(await removeAttachment({ id: added.attachment.id })).toEqual({});

    expect(attachmentFiles()).toEqual(
      [added.attachment.id, kept.attachment.id].sort(),
    );
    expect(attachmentRows().map(row => row.id)).toEqual([kept.attachment.id]);
    expect(removedRows()).toEqual([
      { id: added.attachment.id, deleted_at: 5678 },
    ]);
    expect(syncEvents()).toHaveLength(1);

    vi.mocked(Date.now).mockRestore();
  });

  it('succeeds when the attachment is already gone', async () => {
    expect(await removeAttachment({ id: 'unknown' })).toEqual({});
    expect(syncEvents()).toEqual([]);
  });

  it('succeeds when removing twice, and keeps the first removal time', async () => {
    const added = await add('plain');
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1000);
    await removeAttachment({ id: added.id });
    vi.mocked(connection.send).mockClear();
    now.mockReturnValue(2000);

    expect(await removeAttachment({ id: added.id })).toEqual({});

    expect(removedRows()).toEqual([{ id: added.id, deleted_at: 1000 }]);
    expect(syncEvents()).toEqual([]);
    now.mockRestore();
  });

  it('hides the row even when the file is already missing', async () => {
    const added = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.pdf',
      data: PDF,
    });
    if (!('attachment' in added)) {
      throw new Error('setup failed');
    }
    nativeFs.rmSync(path.join(documentDir, BUDGET_ID, 'attachments'), {
      recursive: true,
    });

    expect(await removeAttachment({ id: added.attachment.id })).toEqual({});
    expect(attachmentRows()).toEqual([]);
  });

  it('needs an open budget, and leaves the attachment in place', async () => {
    const added = await add('plain');
    vi.mocked(connection.send).mockClear();
    prefs.unloadPrefs();

    expect(await removeAttachment({ id: added.id })).toEqual({
      error: { reason: 'no-budget' },
    });
    expect(attachmentRows()).toEqual([
      { id: added.id, transaction_id: 'plain' },
    ]);
    expect(syncEvents()).toEqual([]);
  });
});

describe('attachment-restore', () => {
  it('brings a removed attachment back, and tells the UI', async () => {
    const added = await add('plain', PNG);
    await removeAttachment({ id: added.id });
    vi.mocked(connection.send).mockClear();

    expect(await restoreAttachment({ id: added.id })).toEqual({});

    expect(attachmentRows()).toEqual([
      { id: added.id, transaction_id: 'plain' },
    ]);
    expect(removedRows()).toEqual([]);
    expect(syncEvents()).toEqual([
      ['sync-event', { type: 'applied', tables: ['transaction_attachments'] }],
    ]);
    expect(
      (await listAttachments({ transactionId: 'plain' })).map(a => a.id),
    ).toEqual([added.id]);

    const read = await readAttachment({ id: added.id });
    if (!('data' in read)) {
      throw new Error('expected contents');
    }
    expect(read.attachment).toEqual(added);
    expect(Array.from(read.data)).toEqual(Array.from(PNG));
  });

  it('succeeds without changes when the attachment is not removed', async () => {
    const added = await add('plain');

    expect(await restoreAttachment({ id: added.id })).toEqual({});
    expect(syncEvents().length).toBe(1); // only the add
  });

  it('refuses an unknown attachment', async () => {
    expect(await restoreAttachment({ id: 'unknown' })).toEqual({
      error: { reason: 'not-found' },
    });
  });

  it('refuses when the file is no longer on this device', async () => {
    const added = await add('plain');
    await removeAttachment({ id: added.id });
    nativeFs.rmSync(path.join(documentDir, BUDGET_ID, 'attachments', added.id));

    expect(await restoreAttachment({ id: added.id })).toEqual({
      error: { reason: 'not-found' },
    });
    expect(attachmentRows()).toEqual([]);
  });

  it.each(['plain', 'child'])(
    'refuses when the transaction was deleted since (%s)',
    async transactionId => {
      const added = await add(transactionId);
      await removeAttachment({ id: added.id });
      // A child's attachment is on its parent, so delete that
      const ownerId = transactionId === 'child' ? 'parent' : transactionId;
      db.runQuery('UPDATE transactions SET tombstone = 1 WHERE id = ?', [
        ownerId,
      ]);

      expect(await restoreAttachment({ id: added.id })).toEqual({
        error: { reason: 'transaction-not-found' },
      });
      expect(removedRows().map(row => row.id)).toEqual([added.id]);
    },
  );

  it('needs an open budget', async () => {
    prefs.unloadPrefs();

    expect(await restoreAttachment({ id: 'unknown' })).toEqual({
      error: { reason: 'no-budget' },
    });
  });
});

describe('attachment-read', () => {
  it('returns the attachment and its contents', async () => {
    const added = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.png',
      data: PNG,
    });
    if (!('attachment' in added)) {
      throw new Error('setup failed');
    }

    const result = await readAttachment({ id: added.attachment.id });

    if (!('data' in result)) {
      throw new Error('expected contents');
    }
    expect(result.attachment).toEqual(added.attachment);
    expect(Array.from(result.data)).toEqual(Array.from(PNG));
  });

  it('reports a file that is no longer on this device as missing', async () => {
    const added = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.pdf',
      data: PDF,
    });
    if (!('attachment' in added)) {
      throw new Error('setup failed');
    }
    nativeFs.rmSync(
      path.join(documentDir, BUDGET_ID, 'attachments', added.attachment.id),
    );

    expect(await readAttachment({ id: added.attachment.id })).toEqual({
      error: { reason: 'missing' },
    });
  });

  it("reports the type found in the file, not the row's", async () => {
    // An imported budget could hold a row with any type
    const added = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.png',
      data: PNG,
    });
    if (!('attachment' in added)) {
      throw new Error('setup failed');
    }
    db.runQuery(
      "UPDATE transaction_attachments SET mime_type = 'text/html' WHERE id = ?",
      [added.attachment.id],
    );

    const result = await readAttachment({ id: added.attachment.id });

    expect('attachment' in result && result.attachment.mime_type).toBe(
      'image/png',
    );
  });

  it('refuses to return a file that is not an allowed type', async () => {
    const added = await addAttachment({
      transactionId: 'plain',
      fileName: 'receipt.pdf',
      data: PDF,
    });
    if (!('attachment' in added)) {
      throw new Error('setup failed');
    }
    nativeFs.writeFileSync(
      path.join(documentDir, BUDGET_ID, 'attachments', added.attachment.id),
      '<script>alert(1)</script>',
    );

    expect(await readAttachment({ id: added.attachment.id })).toEqual({
      error: { reason: 'read-failed' },
    });
  });

  it('reports a file that cannot be read as read-failed', async () => {
    const added = await add('plain');
    const error = new Error('EIO: i/o error');
    const read = vi
      .spyOn(storage, 'readAttachmentFile')
      .mockRejectedValue(error);
    // Keeps the expected error out of the test output
    const logError = vi.spyOn(logger, 'error').mockReturnValue(undefined);
    const capture = vi.spyOn(exceptions, 'captureException');

    expect(await readAttachment({ id: added.id })).toEqual({
      error: { reason: 'read-failed' },
    });
    // The failure is logged and sent to error reporting
    expect(logError).toHaveBeenCalledWith(expect.any(String), error);
    expect(capture).toHaveBeenCalledWith(error);

    read.mockRestore();
    logError.mockRestore();
    capture.mockRestore();
  });

  it('needs an open budget', async () => {
    const added = await add('plain');
    prefs.unloadPrefs();

    expect(await readAttachment({ id: added.id })).toEqual({
      error: { reason: 'no-budget' },
    });
  });

  it('reports an unknown attachment as not found', async () => {
    expect(await readAttachment({ id: 'unknown' })).toEqual({
      error: { reason: 'not-found' },
    });
  });

  it('reports a removed attachment as not found', async () => {
    const added = await add('plain');
    await removeAttachment({ id: added.id });

    expect(await readAttachment({ id: added.id })).toEqual({
      error: { reason: 'not-found' },
    });
  });

  it("hides a deleted transaction's attachment until the delete is undone", async () => {
    const added = await add('plain');
    db.runQuery("UPDATE transactions SET tombstone = 1 WHERE id = 'plain'");

    expect(await readAttachment({ id: added.id })).toEqual({
      error: { reason: 'not-found' },
    });

    db.runQuery("UPDATE transactions SET tombstone = 0 WHERE id = 'plain'");

    expect('data' in (await readAttachment({ id: added.id }))).toBe(true);
  });
});

describe('transactionAttachmentsQuery', () => {
  // The modal's list, which filters on the `transaction_id` ref. AQL joins
  // live transactions for refs, which is what hides a deleted transaction's
  // attachments; this guards against a rewrite dropping that.
  async function listed(transactionId: string) {
    const { data } = await aqlQuery(transactionAttachmentsQuery(transactionId));
    return (data as TransactionAttachmentEntity[]).map(row => row.id);
  }

  it('lists live attachments only', async () => {
    const kept = await add('plain');
    const removed = await add('plain');
    await removeAttachment({ id: removed.id });

    expect(await listed('plain')).toEqual([kept.id]);
  });

  it('returns nothing for a deleted transaction until the delete is undone', async () => {
    const added = await add('plain');
    db.runQuery("UPDATE transactions SET tombstone = 1 WHERE id = 'plain'");

    expect(await listed('plain')).toEqual([]);

    db.runQuery("UPDATE transactions SET tombstone = 0 WHERE id = 'plain'");

    expect(await listed('plain')).toEqual([added.id]);
  });
});

describe('transactionAttachmentCountsQuery', () => {
  async function counts() {
    const { data } = await aqlQuery(transactionAttachmentCountsQuery());
    return (data as TransactionAttachmentCount[])
      .filter(row => row.transaction_id != null)
      .sort((a, b) =>
        (a.transaction_id ?? '').localeCompare(b.transaction_id ?? ''),
      );
  }

  it('counts the attachments on each transaction', async () => {
    const first = await add('plain');
    await add('plain');
    // A split child's attachment is counted on its parent
    await add('child');

    expect(await counts()).toEqual([
      { transaction_id: 'parent', count: 1 },
      { transaction_id: 'plain', count: 2 },
    ]);

    await removeAttachment({ id: first.id });

    expect(await counts()).toEqual([
      { transaction_id: 'parent', count: 1 },
      { transaction_id: 'plain', count: 1 },
    ]);
  });

  it('leaves out attachments on deleted transactions', async () => {
    await add('plain');
    await add('parent');
    db.runQuery("UPDATE transactions SET tombstone = 1 WHERE id = 'plain'");

    expect(await counts()).toEqual([{ transaction_id: 'parent', count: 1 }]);
  });

  it('returns nothing when there are no attachments', async () => {
    expect(await counts()).toEqual([]);
  });
});

describe('moveAttachments', () => {
  it('moves live attachments and tells the UI', async () => {
    const added = await add('plain');
    vi.mocked(connection.send).mockClear();

    await moveAttachments('plain', 'parent');

    expect(attachmentRows()).toEqual([
      { id: added.id, transaction_id: 'parent' },
    ]);
    expect(syncEvents()).toHaveLength(1);
  });

  it("puts them on a split child's parent", async () => {
    const added = await add('plain');

    await moveAttachments('plain', 'child');

    expect(attachmentRows()).toEqual([
      { id: added.id, transaction_id: 'parent' },
    ]);
  });

  it('sends no event when there is nothing to move', async () => {
    await moveAttachments('plain', 'parent');

    expect(syncEvents()).toEqual([]);
  });
});
