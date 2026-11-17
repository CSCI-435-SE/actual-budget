import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as fs from '#platform/server/fs';

import {
  getAttachmentPath,
  getAttachmentsDir,
  readAttachmentFile,
  removeAttachmentFile,
  writeAttachmentFile,
} from './storage';

const BUDGET_ID = 'My-Budget-abc1234';

let documentDir: string;

beforeEach(() => {
  documentDir = nativeFs.mkdtempSync(
    path.join(os.tmpdir(), 'actual-attachments-'),
  );
  fs._setDocumentDir(documentDir);
  nativeFs.mkdirSync(path.join(documentDir, BUDGET_ID));
});

afterEach(() => {
  nativeFs.rmSync(documentDir, { recursive: true, force: true });
});

function listAttachmentsDir(): string[] {
  const dir = path.join(documentDir, BUDGET_ID, 'attachments');
  return nativeFs.existsSync(dir) ? nativeFs.readdirSync(dir).sort() : [];
}

describe('attachment storage', () => {
  it('stores files under <budgetDir>/attachments/<id>', () => {
    expect(getAttachmentsDir(BUDGET_ID)).toBe(
      path.join(documentDir, BUDGET_ID, 'attachments'),
    );
    expect(getAttachmentPath(BUDGET_ID, 'att-1')).toBe(
      path.join(documentDir, BUDGET_ID, 'attachments', 'att-1'),
    );
  });

  it('writes and reads back the same bytes, creating the folder', async () => {
    const data = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff]);

    await writeAttachmentFile(BUDGET_ID, 'att-1', data);

    expect(listAttachmentsDir()).toEqual(['att-1']);
    const read = await readAttachmentFile(BUDGET_ID, 'att-1');
    expect(read && Array.from(read)).toEqual(Array.from(data));
  });

  it('writes only the bytes a view covers', async () => {
    const buffer = new Uint8Array([9, 9, 1, 2, 3, 9]);

    await writeAttachmentFile(BUDGET_ID, 'att-1', buffer.subarray(2, 5));

    const read = await readAttachmentFile(BUDGET_ID, 'att-1');
    expect(read && Array.from(read)).toEqual([1, 2, 3]);
  });

  it('removes the temporary file when the rename fails', async () => {
    // A non-empty folder where the file should go makes the rename fail.
    // (The fs module can't be mocked here: the test setup has already
    // loaded this module through cloud-storage.)
    const blocker = path.join(documentDir, BUDGET_ID, 'attachments', 'att-1');
    nativeFs.mkdirSync(blocker, { recursive: true });
    nativeFs.writeFileSync(path.join(blocker, 'file'), 'x');

    await expect(
      writeAttachmentFile(BUDGET_ID, 'att-1', new Uint8Array([1, 2, 3])),
    ).rejects.toThrow();

    expect(listAttachmentsDir()).toEqual(['att-1']);
    expect(nativeFs.readdirSync(blocker)).toEqual(['file']);
  });

  it('reports a missing file as null', async () => {
    expect(await readAttachmentFile(BUDGET_ID, 'missing')).toBeNull();
  });

  it('removes a file, and removing it again does nothing', async () => {
    await writeAttachmentFile(BUDGET_ID, 'att-1', new Uint8Array([1]));
    await writeAttachmentFile(BUDGET_ID, 'att-2', new Uint8Array([2]));

    await removeAttachmentFile(BUDGET_ID, 'att-1');
    await removeAttachmentFile(BUDGET_ID, 'att-1');

    expect(listAttachmentsDir()).toEqual(['att-2']);
    expect(await readAttachmentFile(BUDGET_ID, 'att-1')).toBeNull();
  });

  it('rejects ids that could reach outside the attachments folder', async () => {
    for (const id of ['../db.sqlite', 'a/b', '', '..', 'a b']) {
      expect(() => getAttachmentPath(BUDGET_ID, id)).toThrow(
        'Invalid attachment id',
      );
      await expect(readAttachmentFile(BUDGET_ID, id)).rejects.toThrow(
        'Invalid attachment id',
      );
    }
  });
});
