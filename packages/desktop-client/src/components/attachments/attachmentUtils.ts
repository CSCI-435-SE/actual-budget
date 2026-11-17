import { useTranslation } from 'react-i18next';

import { send } from '@actual-app/core/platform/client/connection';
import type { Handlers } from '@actual-app/core/types/handlers';
import type { TransactionAttachmentEntity } from '@actual-app/core/types/models';

import { pushModal } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
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
// user cancels. A successful removal shows a notification with an "Undo"
// button, which restores the attachment. (The app's own undo can't, because
// attachment rows aren't on its undo stack.)
export function useConfirmRemoveAttachment() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  function restoreFailedMessage(
    reason: RestoreError['reason'] | 'unexpected',
    name: string,
  ) {
    switch (reason) {
      case 'transaction-not-found':
        return t(
          'Couldn\'t restore "{{name}}" because its transaction has been deleted.',
          { name },
        );
      case 'not-found':
        return t(
          'Couldn\'t restore "{{name}}". It\'s no longer on this device.',
          { name },
        );
      default:
        return t('Couldn\'t restore "{{name}}".', { name });
    }
  }

  async function undoRemove(attachment: TransactionAttachmentEntity) {
    const reason = await restoreAttachment(attachment.id);
    if (reason != null) {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: restoreFailedMessage(reason, attachment.file_name),
          },
        }),
      );
    }
  }

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
              'Remove "{{name}}"? You can undo this for a short while afterwards.',
              { name: attachment.file_name },
            ),
            onConfirm: () => {
              void removeAttachment(attachment.id).then(removed => {
                if (removed) {
                  dispatch(
                    addNotification({
                      notification: {
                        type: 'message',
                        message: t('Removed "{{name}}".', {
                          name: attachment.file_name,
                        }),
                        timeout: 10000,
                        button: {
                          title: t('Undo'),
                          action: () => undoRemove(attachment),
                        },
                      },
                    }),
                  );
                }
                onDone(removed);
              });
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

type RestoreError = NonNullable<
  Awaited<ReturnType<Handlers['attachment-restore']>>['error']
>;

// Returns why restoring failed, or null if it worked
async function restoreAttachment(
  id: TransactionAttachmentEntity['id'],
): Promise<RestoreError['reason'] | 'unexpected' | null> {
  try {
    const result = await send('attachment-restore', { id });
    return result.error?.reason ?? null;
  } catch {
    return 'unexpected';
  }
}
