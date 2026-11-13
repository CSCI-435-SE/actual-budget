import {
  initServer,
  serverPush,
} from '@actual-app/core/platform/client/connection';
import type { Handlers } from '@actual-app/core/types/handlers';
import type { TransactionAttachmentEntity } from '@actual-app/core/types/models';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';

import { TestProviders } from '#mocks';
import * as modalsSlice from '#modals/modalsSlice';

import { TransactionAttachmentsModal } from './TransactionAttachmentsModal';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let attachments: TransactionAttachmentEntity[];
let addAttachment: Mock<Handlers['attachment-add']>;
let removeAttachment: Mock<Handlers['attachment-remove']>;

function makeAttachment(
  fields: Partial<TransactionAttachmentEntity>,
): TransactionAttachmentEntity {
  return {
    id: 'a1',
    transaction_id: 'txn1',
    file_name: 'receipt.png',
    mime_type: 'image/png',
    size: 2048,
    storage: 'local',
    created_at: 1,
    tombstone: false,
    ...fields,
  };
}

// Mirrors what the real server does after a change, so live queries refresh
function notifyChanged() {
  serverPush('sync-event', {
    type: 'applied',
    tables: ['transaction_attachments'],
  });
}

function renderModal() {
  return render(
    <TestProviders>
      <TransactionAttachmentsModal transactionId="txn1" />
    </TestProviders>,
  );
}

function fileInput() {
  return screen.getByTestId<HTMLInputElement>('attachment-file-input');
}

function attachedFiles() {
  return within(screen.getByRole('list', { name: 'Attached files' }));
}

beforeEach(() => {
  attachments = [];
  addAttachment = vi.fn<Handlers['attachment-add']>(
    async ({ fileName, data }) => {
      const attachment = makeAttachment({
        id: `a${attachments.length + 1}`,
        file_name: fileName,
        size: data.byteLength,
      });
      attachments = [...attachments, attachment];
      notifyChanged();
      return { attachment };
    },
  );

  removeAttachment = vi.fn<Handlers['attachment-remove']>(async ({ id }) => {
    attachments = attachments.filter(attachment => attachment.id !== id);
    notifyChanged();
    return {};
  });

  initServer({
    query: async (query: { table: string }) => {
      if (query.table !== 'transaction_attachments') {
        throw new Error(`queried unknown table: ${query.table}`);
      }
      return {
        data: attachments,
        dependencies: ['transaction_attachments'],
      };
    },
    'attachment-add': addAttachment,
    'attachment-remove': removeAttachment,
  });
});

describe('TransactionAttachmentsModal', () => {
  it('lists the attached files with their sizes', async () => {
    attachments = [
      makeAttachment({ id: 'a1', file_name: 'receipt.png', size: 2048 }),
      makeAttachment({
        id: 'a2',
        file_name: 'invoice.pdf',
        size: 3 * 1024 ** 2,
      }),
    ];
    renderModal();

    expect(await attachedFiles().findByText('receipt.png')).toBeVisible();
    expect(attachedFiles().getByText('2 KB')).toBeVisible();
    expect(attachedFiles().getByText('invoice.pdf')).toBeVisible();
    expect(attachedFiles().getByText('3 MB')).toBeVisible();
  });

  it('says when nothing is attached, and warns that files stay in this browser', async () => {
    renderModal();

    expect(await screen.findByText('No files attached yet.')).toBeVisible();
    expect(screen.getByText(/stored in this browser only/)).toBeVisible();
  });

  it('attaches a picked file and shows it in the list', async () => {
    renderModal();
    await screen.findByText('No files attached yet.');

    await userEvent.upload(
      fileInput(),
      new File([PNG], 'photo.png', { type: 'image/png' }),
    );

    expect(await attachedFiles().findByText('photo.png')).toBeVisible();
    expect(addAttachment).toHaveBeenCalledTimes(1);
    const [args] = addAttachment.mock.calls[0];
    expect(args.transactionId).toBe('txn1');
    expect(args.fileName).toBe('photo.png');
    expect(Array.from(new Uint8Array(args.data))).toEqual(Array.from(PNG));
  });

  it('rejects a file that is not an allowed type without sending it', async () => {
    renderModal();
    await screen.findByText('No files attached yet.');

    // The file picker's `accept` filter is only a hint, so check anyway
    await userEvent.upload(
      fileInput(),
      new File(['hello'], 'notes.png', { type: 'image/png' }),
      { applyAccept: false },
    );

    expect(
      await screen.findByText(/Only JPEG, PNG, WebP and PDF files/),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(addAttachment).not.toHaveBeenCalled();
  });

  it('rejects an empty file without sending it', async () => {
    renderModal();
    await screen.findByText('No files attached yet.');

    await userEvent.upload(fileInput(), new File([], 'empty.png'), {
      applyAccept: false,
    });

    expect(await screen.findByText('This file is empty.')).toBeVisible();
    expect(addAttachment).not.toHaveBeenCalled();
  });

  it('offers to try again when saving fails', async () => {
    addAttachment.mockResolvedValueOnce({ error: { reason: 'save-failed' } });
    renderModal();
    await screen.findByText('No files attached yet.');

    await userEvent.upload(
      fileInput(),
      new File([PNG], 'photo.png', { type: 'image/png' }),
    );

    expect(
      await screen.findByText("The file couldn't be saved."),
    ).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await attachedFiles().findByText('photo.png')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByText("The file couldn't be saved.")).toBeNull(),
    );
    expect(addAttachment).toHaveBeenCalledTimes(2);
  });

  it('opens a file in the viewer', async () => {
    const attachment = makeAttachment({ id: 'a1', file_name: 'receipt.png' });
    attachments = [attachment];
    const pushModalSpy = vi.spyOn(modalsSlice, 'pushModal');
    renderModal();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Open receipt.png' }),
    );

    expect(pushModalSpy).toHaveBeenCalledWith({
      modal: { name: 'attachment-viewer', options: { attachment } },
    });
    pushModalSpy.mockRestore();
  });

  describe('removing', () => {
    // Presses "Remove" and returns the confirmation it asked for
    async function pressRemove(name: string) {
      const pushModalSpy = vi.spyOn(modalsSlice, 'pushModal');
      await userEvent.click(
        await screen.findByRole('button', { name: `Remove ${name}` }),
      );
      expect(pushModalSpy).toHaveBeenCalledTimes(1);
      const { modal } = pushModalSpy.mock.calls[0][0];
      pushModalSpy.mockRestore();
      if (modal.name !== 'confirm-delete') {
        throw new Error(`expected confirm-delete, got ${modal.name}`);
      }
      return modal.options;
    }

    it('asks first, then removes the file', async () => {
      attachments = [
        makeAttachment({ id: 'a1', file_name: 'receipt.png' }),
        makeAttachment({ id: 'a2', file_name: 'invoice.pdf' }),
      ];
      renderModal();

      const confirmation = await pressRemove('receipt.png');
      expect(confirmation.message).toContain('"receipt.png"');
      expect(removeAttachment).not.toHaveBeenCalled();

      confirmation.onConfirm();

      await waitFor(() =>
        expect(attachedFiles().queryByText('receipt.png')).toBeNull(),
      );
      expect(removeAttachment).toHaveBeenCalledWith({ id: 'a1' });
      expect(attachedFiles().getByText('invoice.pdf')).toBeVisible();
    });

    it('says so when removing fails', async () => {
      attachments = [makeAttachment({ id: 'a1', file_name: 'receipt.png' })];
      removeAttachment.mockRejectedValueOnce(new Error('disk full'));
      renderModal();

      (await pressRemove('receipt.png')).onConfirm();

      expect(
        await screen.findByText(/Couldn't remove receipt.png/),
      ).toBeVisible();
      expect(attachedFiles().getByText('receipt.png')).toBeVisible();
    });
  });
});
