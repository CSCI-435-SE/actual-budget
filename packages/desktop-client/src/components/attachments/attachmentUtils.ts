import { useTranslation } from 'react-i18next';

import { send } from '@actual-app/core/platform/client/connection';
import type { Handlers } from '@actual-app/core/types/handlers';
import type { TransactionAttachmentEntity } from '@actual-app/core/types/models';

import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

type AddResult = Awaited<ReturnType<Handlers['attachment-add']>>;

// Why attaching a file failed: the server's reasons, plus the ones that can
// only happen in the UI (reading the picked file, or the request itself)
export type AttachmentUploadError =
  | Extract<AddResult, { error: unknown }>['error']
  | { reason: 'read-failed' }
  | { reason: 'unexpected' };

// A short, human-readable size, e.g. "512 B", "3.4 KB", "10 MB"
export function formatAttachmentSize(bytes: number): string {
  const units = ['B', 'KB', 'MB'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: unit === 0 || value >= 10 ? 0 : 1,
  }).format(value);
  return `${formatted} ${units[unit]}`;
}

// Failures that might go away if the user tries again
export function canRetryAttachmentError(error: AttachmentUploadError) {
  return (
    error.reason === 'save-failed' ||
    error.reason === 'read-failed' ||
    error.reason === 'unexpected'
  );
}

export function useAttachmentErrorMessage() {
  const { t } = useTranslation();

  return (error: AttachmentUploadError): string => {
    switch (error.reason) {
      case 'empty':
        return t('This file is empty.');
      case 'too-large':
        return t('This file is larger than {{size}}.', {
          size: formatAttachmentSize(error.maxSize),
        });
      case 'unsupported-type':
        return t('Only JPEG, PNG, WebP and PDF files can be attached.');
      case 'transaction-not-found':
        return t('This transaction no longer exists.');
      case 'no-budget':
        return t('No budget is open.');
      case 'read-failed':
        return t("The file couldn't be read.");
      case 'save-failed':
      case 'unexpected':
      default:
        return t("The file couldn't be saved.");
    }
  };
}

// Asks the user to confirm, then removes the attachment. `onDone` is called
// after a confirmed removal with whether it worked; it isn't called if the
// user cancels.
export function useConfirmRemoveAttachment() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  return (
    attachment: TransactionAttachmentEntity,
    onDone: (removed: boolean) => void,
  ) => {
    dispatch(
      pushModal({
        modal: {
          name: 'confirm-delete',
          options: {
            message: t(
              'Remove "{{name}}"? The file will be deleted from this device and can\'t be recovered.',
              { name: attachment.file_name },
            ),
            onConfirm: () => {
              void removeAttachment(attachment.id).then(onDone);
            },
          },
        },
      }),
    );
  };
}

async function removeAttachment(
  id: TransactionAttachmentEntity['id'],
): Promise<boolean> {
  try {
    const result = await send('attachment-remove', { id });
    return result.error == null;
  } catch {
    return false;
  }
}
