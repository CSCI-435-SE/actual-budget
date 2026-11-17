import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as fs from '#platform/server/fs';
import { handlers } from '#server/main';

vi.mock('#server/post');

let documentDir: string;

beforeEach(() => {
  documentDir = nativeFs.mkdtempSync(
    path.join(os.tmpdir(), 'actual-delete-budget-'),
  );
  fs._setDocumentDir(documentDir);
});

afterEach(() => {
  fs._setDocumentDir(null);
  nativeFs.rmSync(documentDir, { recursive: true, force: true });
});

describe('delete-budget', () => {
  it("removes the budget's attachment files", async () => {
    const budgetDir = path.join(documentDir, 'budget-to-delete');
    const attachmentsDir = path.join(budgetDir, 'attachments');
    nativeFs.mkdirSync(attachmentsDir, { recursive: true });
    nativeFs.writeFileSync(
      path.join(attachmentsDir, '0b7c1b3e-6c9d-4b8e-9f3a-2d5e8c1a4f60'),
      'receipt',
    );

    expect(await handlers['delete-budget']({ id: 'budget-to-delete' })).toBe(
      'ok',
    );

    expect(nativeFs.existsSync(budgetDir)).toBe(false);
  });
});
