import React, { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import {
  ATTACHMENT_FILE_ACCEPT,
  ATTACHMENT_MAX_SIZE,
  checkAttachmentSize,
  transactionAttachmentsQuery,
  validateAttachment,
} from '@actual-app/core/shared/attachments';
import { isElectron } from '@actual-app/core/shared/environment';
import type { TransactionAttachmentEntity } from '@actual-app/core/types/models';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { Error as ErrorAlert, Warning } from '#components/alerts';
import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { useQuery } from '#hooks/useQuery';
import { pushModal } from '#modals/modalsSlice';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

import {
  canRetryAttachmentError,
  formatAttachmentSize,
  useAttachmentErrorMessage,
} from './attachmentUtils';
import type { AttachmentUploadError } from './attachmentUtils';

type TransactionAttachmentsModalProps = Extract<
  ModalType,
  { name: 'transaction-attachments' }
>['options'];

type PendingUpload = { key: number; name: string };
type FailedUpload = { key: number; file: File; error: AttachmentUploadError };

export function TransactionAttachmentsModal({
  transactionId,
}: TransactionAttachmentsModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const errorMessage = useAttachmentErrorMessage();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);

  const { data: attachments, isLoading } =
    useQuery<TransactionAttachmentEntity>(
      () => transactionAttachmentsQuery(transactionId),
      [transactionId],
    );

  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [failures, setFailures] = useState<FailedUpload[]>([]);
  const [removeFailure, setRemoveFailure] = useState<string | null>(null);

  async function attachFiles(files: File[]) {
    // One at a time, so a large batch doesn't hold every file in memory
    for (const file of files) {
      const key = nextKey.current++;
      setPending(current => [...current, { key, name: file.name }]);

      const error = await attachFile(transactionId, file);

      setPending(current => current.filter(upload => upload.key !== key));
      if (error) {
        setFailures(current => [...current, { key, file, error }]);
      }
    }
  }

  function onFilesPicked(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Clear the input so picking the same file again still fires `change`
    event.target.value = '';
    if (files.length > 0) {
      void attachFiles(files);
    }
  }

  function dismissFailure(key: number) {
    setFailures(current => current.filter(failure => failure.key !== key));
  }

  function retry(failure: FailedUpload) {
    dismissFailure(failure.key);
    void attachFiles([failure.file]);
  }

  function confirmRemove(attachment: TransactionAttachmentEntity) {
    dispatch(
      pushModal({
        modal: {
          name: 'confirm-delete',
          options: {
            message: t(
              'Remove "{{name}}"? The file will be deleted from this device and can\'t be recovered.',
              { name: attachment.file_name },
            ),
            onConfirm: () => void remove(attachment),
          },
        },
      }),
    );
  }

  async function remove(attachment: TransactionAttachmentEntity) {
    setRemoveFailure(null);
    let failed: boolean;
    try {
      const result = await send('attachment-remove', { id: attachment.id });
      failed = result.error != null;
    } catch {
      failed = true;
    }
    if (failed) {
      setRemoveFailure(attachment.file_name);
    }
  }

  const maxSize = formatAttachmentSize(ATTACHMENT_MAX_SIZE);
  const hasAttachments = attachments != null && attachments.length > 0;

  return (
    <Modal
      name="transaction-attachments"
      containerProps={{ style: { width: 520 } }}
    >
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Attachments')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ gap: 12, lineHeight: 1.5 }}>
            {isElectron() ? (
              <Text style={{ color: theme.pageTextSubdued }}>
                <Trans>
                  Files are stored on this device only. They aren't synced to
                  your other devices.
                </Trans>
              </Text>
            ) : (
              <Warning>
                <Trans>
                  Files are stored in this browser only. They aren't synced to
                  your other devices, and they are lost if this browser's data
                  is cleared.
                </Trans>
              </Warning>
            )}

            <View
              role="list"
              aria-label={t('Attached files')}
              style={{
                border: `1px solid ${theme.tableBorder}`,
                borderRadius: 4,
              }}
            >
              {isLoading ? (
                <View style={{ padding: 12, alignItems: 'center' }}>
                  <AnimatedLoading style={{ width: 16, height: 16 }} />
                </View>
              ) : !hasAttachments && pending.length === 0 ? (
                <Text style={{ padding: 12, color: theme.pageTextSubdued }}>
                  <Trans>No files attached yet.</Trans>
                </Text>
              ) : null}
              {attachments?.map(attachment => (
                <AttachmentRow
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={() => confirmRemove(attachment)}
                />
              ))}
              {pending.map(upload => (
                <View
                  key={upload.key}
                  role="listitem"
                  style={{ ...rowStyle, color: theme.pageTextSubdued }}
                >
                  <AnimatedLoading style={{ width: 12, height: 12 }} />
                  <Text style={fileNameStyle}>{upload.name}</Text>
                  <Text>
                    <Trans>Saving...</Trans>
                  </Text>
                </View>
              ))}
            </View>

            {removeFailure != null && (
              <ErrorAlert>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text style={{ flex: 1 }}>
                    <Trans>
                      Couldn't remove{' '}
                      {{ name: removeFailure } as TransObjectLiteral}. Try
                      again.
                    </Trans>
                  </Text>
                  <Button variant="bare" onPress={() => setRemoveFailure(null)}>
                    <Trans>Dismiss</Trans>
                  </Button>
                </View>
              </ErrorAlert>
            )}

            {failures.map(failure => (
              <ErrorAlert key={failure.key}>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontWeight: 600, ...fileNameStyle }}>
                    <Trans>
                      Couldn't attach{' '}
                      {{ name: failure.file.name } as TransObjectLiteral}
                    </Trans>
                  </Text>
                  <Text>{errorMessage(failure.error)}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {canRetryAttachmentError(failure.error) && (
                      <Button onPress={() => retry(failure)}>
                        <Trans>Try again</Trans>
                      </Button>
                    )}
                    <Button
                      variant="bare"
                      onPress={() => dismissFailure(failure.key)}
                    >
                      <Trans>Dismiss</Trans>
                    </Button>
                  </View>
                </View>
              </ErrorAlert>
            ))}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <Text style={{ color: theme.pageTextSubdued }}>
                <Trans>JPEG, PNG, WebP or PDF, up to {{ maxSize }}.</Trans>
              </Text>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ATTACHMENT_FILE_ACCEPT}
                data-testid="attachment-file-input"
                style={{ display: 'none' }}
                onChange={onFilesPicked}
              />
              <Button
                variant="primary"
                onPress={() => inputRef.current?.click()}
              >
                <Trans>Attach files</Trans>
              </Button>
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}

type AttachmentRowProps = {
  attachment: TransactionAttachmentEntity;
  onRemove: () => void;
};

function AttachmentRow({ attachment, onRemove }: AttachmentRowProps) {
  const { t } = useTranslation();

  return (
    <View role="listitem" style={rowStyle}>
      <Text style={fileNameStyle} title={attachment.file_name}>
        {attachment.file_name}
      </Text>
      <Text style={{ color: theme.pageTextSubdued, flexShrink: 0 }}>
        {formatAttachmentSize(attachment.size)}
      </Text>
      <Button
        variant="bare"
        aria-label={t('Remove {{name}}', { name: attachment.file_name })}
        onPress={onRemove}
      >
        <Trans>Remove</Trans>
      </Button>
    </View>
  );
}

// Checks the file the same way the server will, so most problems show up
// before the file is sent, then saves it. Returns why it failed, if it did.
async function attachFile(
  transactionId: string,
  file: File,
): Promise<AttachmentUploadError | null> {
  const sizeError = checkAttachmentSize(file.size);
  if (sizeError) {
    return sizeError;
  }

  let data: Uint8Array;
  try {
    data = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { reason: 'read-failed' };
  }

  const validation = validateAttachment(data);
  if ('error' in validation) {
    return validation.error;
  }

  try {
    const result = await send('attachment-add', {
      transactionId,
      fileName: file.name,
      data,
    });
    return 'error' in result ? result.error : null;
  } catch {
    return { reason: 'unexpected' };
  }
}

const rowStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  borderTop: `1px solid ${theme.tableBorder}`,
  ':first-child': { borderTop: 0 },
} as const;

const fileNameStyle = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;
