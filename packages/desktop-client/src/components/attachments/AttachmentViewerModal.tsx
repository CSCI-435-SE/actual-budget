import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Paragraph } from '@actual-app/components/paragraph';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { isElectron } from '@actual-app/core/shared/environment';
import type { Handlers } from '@actual-app/core/types/handlers';
import type { TransactionAttachmentEntity } from '@actual-app/core/types/models';

import { Error as ErrorAlert } from '#components/alerts';
import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { popModal } from '#modals/modalsSlice';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

import {
  formatAttachmentSize,
  useConfirmRemoveAttachment,
} from './attachmentUtils';

type AttachmentViewerModalProps = Extract<
  ModalType,
  { name: 'attachment-viewer' }
>['options'];

type ReadResult = Awaited<ReturnType<Handlers['attachment-read']>>;
type ReadErrorReason =
  | Extract<ReadResult, { error: unknown }>['error']['reason']
  | 'unexpected';

type ViewState =
  | { status: 'loading' }
  | {
      status: 'loaded';
      attachment: TransactionAttachmentEntity;
      data: Uint8Array;
      url: string;
    }
  | { status: 'failed'; reason: ReadErrorReason };

export function AttachmentViewerModal({
  attachment,
}: AttachmentViewerModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const confirmRemoveAttachment = useConfirmRemoveAttachment();

  // Bumped to load the file again after a failure
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewState>({ status: 'loading' });
  const [removeFailed, setRemoveFailed] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let url: string | null = null;
    setView({ status: 'loading' });

    void readAttachment(attachment.id).then(result => {
      if (isCancelled) {
        return;
      }
      if ('reason' in result) {
        setView({ status: 'failed', reason: result.reason });
        return;
      }
      // The type comes from the file's contents, checked by the server, so
      // this is only ever an image or a PDF
      url = URL.createObjectURL(
        new Blob([result.data as Uint8Array<ArrayBuffer>], {
          type: result.attachment.mime_type,
        }),
      );
      setView({ status: 'loaded', ...result, url });
    });

    return () => {
      isCancelled = true;
      if (url != null) {
        URL.revokeObjectURL(url);
      }
    };
  }, [attachment.id, attempt]);

  function onRemove() {
    confirmRemoveAttachment(attachment, removed => {
      if (removed) {
        // The confirmation has closed by now, so this closes the viewer
        dispatch(popModal());
      } else {
        setRemoveFailed(true);
      }
    });
  }

  function onSaveCopy(loaded: Extract<ViewState, { status: 'loaded' }>) {
    // Copy into a buffer of exactly the file's size: the desktop app writes
    // out the whole underlying buffer
    void window.Actual.saveFile(
      new Uint8Array(loaded.data),
      loaded.attachment.file_name,
      t('Save attachment'),
    );
  }

  function onOpenInNewTab(url: string) {
    window.open(url, '_blank', 'noopener');
  }

  return (
    <Modal name="attachment-viewer" containerProps={{ style: { width: 760 } }}>
      {({ state }) => (
        <>
          <ModalHeader
            title={attachment.file_name}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ gap: 12, lineHeight: 1.5 }}>
            {view.status === 'loading' && (
              <View
                aria-label={t('Loading')}
                style={{ padding: 40, alignItems: 'center' }}
              >
                <AnimatedLoading style={{ width: 20, height: 20 }} />
              </View>
            )}

            {view.status === 'loaded' &&
              (view.attachment.mime_type === 'application/pdf' ? (
                <View
                  style={{
                    padding: 30,
                    alignItems: 'center',
                    gap: 6,
                    textAlign: 'center',
                  }}
                >
                  <Text style={{ fontWeight: 600 }}>
                    <Trans>PDF document</Trans> (
                    {formatAttachmentSize(view.data.byteLength)})
                  </Text>
                  <Text style={{ color: theme.pageTextSubdued }}>
                    {isElectron() ? (
                      <Trans>Save a copy to open it in your PDF viewer.</Trans>
                    ) : (
                      <Trans>PDFs open in a new tab.</Trans>
                    )}
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <img
                    src={view.url}
                    alt={view.attachment.file_name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '65vh',
                      objectFit: 'contain',
                    }}
                  />
                </View>
              ))}

            {view.status === 'failed' && (
              <ReadFailure
                reason={view.reason}
                onRetry={() => setAttempt(current => current + 1)}
                onRemove={onRemove}
              />
            )}

            {removeFailed && (
              <ErrorAlert>
                <Trans>The attachment couldn't be removed. Try again.</Trans>
              </ErrorAlert>
            )}

            {view.status === 'loaded' && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: 8,
                }}
              >
                <Button onPress={() => onSaveCopy(view)}>
                  <Trans>Save a copy</Trans>
                </Button>
                {view.attachment.mime_type === 'application/pdf' &&
                  !isElectron() && (
                    <Button
                      variant="primary"
                      onPress={() => onOpenInNewTab(view.url)}
                    >
                      <Trans>Open in new tab</Trans>
                    </Button>
                  )}
              </View>
            )}
          </View>
        </>
      )}
    </Modal>
  );
}

type ReadFailureProps = {
  reason: ReadErrorReason;
  onRetry: () => void;
  onRemove: () => void;
};

// Never a blank view: every failure says what happened and what can be done
function ReadFailure({ reason, onRetry, onRemove }: ReadFailureProps) {
  if (reason === 'missing') {
    return (
      <View style={{ gap: 10 }}>
        <ErrorAlert>
          <Trans>
            This file is missing from this device. It may have been deleted, or
            the budget was copied or downloaded without it.
          </Trans>
        </ErrorAlert>
        <Paragraph style={{ margin: 0 }}>
          <Trans>
            You can remove the attachment, then attach the file again if you
            still have it.
          </Trans>
        </Paragraph>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button variant="primary" onPress={onRemove}>
            <Trans>Remove attachment</Trans>
          </Button>
        </View>
      </View>
    );
  }

  if (reason === 'not-found') {
    return (
      <ErrorAlert>
        <Trans>This attachment has already been removed.</Trans>
      </ErrorAlert>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <ErrorAlert>
        <Trans>This file couldn't be opened.</Trans>
      </ErrorAlert>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button onPress={onRetry}>
          <Trans>Try again</Trans>
        </Button>
      </View>
    </View>
  );
}

async function readAttachment(
  id: TransactionAttachmentEntity['id'],
): Promise<
  | { attachment: TransactionAttachmentEntity; data: Uint8Array }
  | { reason: ReadErrorReason }
> {
  try {
    const result = await send('attachment-read', { id });
    if ('error' in result) {
      return { reason: result.error.reason };
    }
    return { attachment: result.attachment, data: toBytes(result.data) };
  } catch {
    return { reason: 'unexpected' };
  }
}

// The desktop app's connection can deliver a Node Buffer in its JSON form
function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (
    typeof data === 'object' &&
    data != null &&
    'data' in data &&
    Array.isArray(data.data)
  ) {
    return new Uint8Array(data.data);
  }
  throw new Error('Unexpected attachment data');
}
