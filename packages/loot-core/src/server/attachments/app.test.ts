import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as connection from '#platform/server/connection';
import * as fs from '#platform/server/fs';
import * as db from '#server/db';
import * as prefs from '#server/prefs';
import {
  ATTACHMENT_MAX_SIZE,
  ATTACHMENT_MIME_TYPES,
} from '#shared/attachments';

import { app } from './app';
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

let documentDir: string;

function attachmentFiles(): string[] {
  const dir = path.join(documentDir, BUDGET_ID, 'attachments');
  return nativeFs.existsSync(dir) ? nativeFs.readdirSync(dir).sort() : [];
}

function attachmentRows() {
  return db.runQuery<{ id: string; transaction_id: string }>(
    'SELECT id, transaction_id FROM transaction_attachments ORDER BY id',
    [],
    true,
  );
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
              ('orphan-child', 0, 1, 'acct1', -500, 20261113, 'deleted', 5, 0)`,
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

  it.each(['missing', 'deleted', 'orphan-child'])(
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
});

describe('attachment-remove', () => {
  it('removes the row and the file, and tells the UI', async () => {
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

    expect(await removeAttachment({ id: added.attachment.id })).toEqual({});

    expect(attachmentFiles()).toEqual([kept.attachment.id]);
    expect(attachmentRows().map(row => row.id)).toEqual([kept.attachment.id]);
    expect(syncEvents()).toHaveLength(1);
  });

  it('succeeds when the attachment is already gone', async () => {
    expect(await removeAttachment({ id: 'unknown' })).toEqual({});
    expect(syncEvents()).toEqual([]);
  });

  it('removes the row even when the file is already missing', async () => {
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

  it('reports an unknown attachment as not found', async () => {
    expect(await readAttachment({ id: 'unknown' })).toEqual({
      error: { reason: 'not-found' },
    });
  });
});
