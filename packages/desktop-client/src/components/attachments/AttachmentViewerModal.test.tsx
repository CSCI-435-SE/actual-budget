import { initServer } from '@actual-app/core/platform/client/connection';
import type { Handlers } from '@actual-app/core/types/handlers';
import type { TransactionAttachmentEntity } from '@actual-app/core/types/models';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';

import { TestProviders } from '#mocks';
import * as modalsSlice from '#modals/modalsSlice';

import { AttachmentViewerModal } from './AttachmentViewerModal';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = new Uint8Array([...'%PDF-1.7\n'].map(c => c.charCodeAt(0)));

const IMAGE = makeAttachment({ file_name: 'receipt.png' });
const DOCUMENT = makeAttachment({
  file_name: 'invoice.pdf',
  mime_type: 'application/pdf',
});

let readAttachment: Mock<Handlers['attachment-read']>;
let removeAttachment: Mock<Handlers['attachment-remove']>;
let saveFile: Mock;
let originalActual: typeof window.Actual;

function makeAttachment(
  fields: Partial<TransactionAttachmentEntity>,
): TransactionAttachmentEntity {
  return {
    id: 'a1',
    transaction_id: 'txn1',
    file_name: 'receipt.png',
    mime_type: 'image/png',
    size: 8,
    storage: 'local',
    created_at: 1,
    tombstone: false,
    ...fields,
  };
}

function renderViewer(attachment: TransactionAttachmentEntity) {
  return render(
    <TestProviders>
      <AttachmentViewerModal attachment={attachment} />
    </TestProviders>,
  );
}

beforeEach(() => {
  readAttachment = vi.fn<Handlers['attachment-read']>(async () => ({
    attachment: IMAGE,
    data: PNG,
  }));
  removeAttachment = vi.fn<Handlers['attachment-remove']>(async () => ({}));
  initServer({
    'attachment-read': readAttachment,
    'attachment-remove': removeAttachment,
  });

  // jsdom has no object URLs
  let nextUrl = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++nextUrl}`);
  URL.revokeObjectURL = vi.fn();

  saveFile = vi.fn().mockResolvedValue(undefined);
  originalActual = window.Actual;
  window.Actual = { ...window.Actual, saveFile };
});

afterEach(() => {
  window.Actual = originalActual;
  vi.restoreAllMocks();
});

describe('AttachmentViewerModal', () => {
  it('shows an image from its contents', async () => {
    renderViewer(IMAGE);

    const image = await screen.findByRole('img', { name: 'receipt.png' });
    expect(image).toHaveAttribute('src', 'blob:test/1');
    expect(readAttachment).toHaveBeenCalledWith({ id: 'a1' });
    const [blob] = vi.mocked(URL.createObjectURL).mock.calls[0] as [Blob];
    expect(blob.type).toBe('image/png');
  });

  it('releases the image when closed', async () => {
    const { unmount } = renderViewer(IMAGE);
    await screen.findByRole('img', { name: 'receipt.png' });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });

  it('opens a PDF in a new tab', async () => {
    readAttachment.mockResolvedValue({ attachment: DOCUMENT, data: PDF });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderViewer(DOCUMENT);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Open in new tab' }),
    );

    expect(open).toHaveBeenCalledWith('blob:test/1', '_blank', 'noopener');
    const [blob] = vi.mocked(URL.createObjectURL).mock.calls[0] as [Blob];
    expect(blob.type).toBe('application/pdf');
  });

  it('saves a copy of the file', async () => {
    renderViewer(IMAGE);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Save a copy' }),
    );

    expect(saveFile).toHaveBeenCalledTimes(1);
    const [contents, fileName] = saveFile.mock.calls[0];
    expect(Array.from(contents)).toEqual(Array.from(PNG));
    expect(fileName).toBe('receipt.png');
  });

  it('explains a missing file and offers to remove the attachment', async () => {
    readAttachment.mockResolvedValue({ error: { reason: 'missing' } });
    const pushModalSpy = vi.spyOn(modalsSlice, 'pushModal');
    const popModalSpy = vi.spyOn(modalsSlice, 'popModal');
    renderViewer(IMAGE);

    expect(
      await screen.findByText(/This file is missing from this device/),
    ).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove attachment' }),
    );
    const { modal } = pushModalSpy.mock.calls[0][0];
    if (modal.name !== 'confirm-delete') {
      throw new Error(`expected confirm-delete, got ${modal.name}`);
    }
    modal.options.onConfirm();

    await waitFor(() => expect(popModalSpy).toHaveBeenCalled());
    expect(removeAttachment).toHaveBeenCalledWith({ id: 'a1' });
  });

  it('offers to try again when the file could not be read', async () => {
    readAttachment.mockResolvedValueOnce({ error: { reason: 'read-failed' } });
    renderViewer(IMAGE);

    expect(
      await screen.findByText("This file couldn't be opened."),
    ).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('img', { name: 'receipt.png' }),
    ).toBeVisible();
    expect(readAttachment).toHaveBeenCalledTimes(2);
  });

  it('says when the attachment was already removed', async () => {
    readAttachment.mockResolvedValue({ error: { reason: 'not-found' } });
    renderViewer(IMAGE);

    expect(
      await screen.findByText('This attachment has already been removed.'),
    ).toBeVisible();
  });
});
