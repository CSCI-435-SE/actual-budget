import type { TransactionEntity } from './transaction';

export type AttachmentMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf';

// Where the attachment's file is stored. Only 'local' (this device) exists
// today; the column leaves room for server storage later.
export type AttachmentStorage = 'local';

export type TransactionAttachmentEntity = {
  id: string;
  // Always a non-child transaction: attachments on a split belong to the parent
  transaction_id: TransactionEntity['id'];
  file_name: string;
  mime_type: AttachmentMimeType;
  // Bytes
  size: number;
  storage: AttachmentStorage;
  // Milliseconds since the epoch
  created_at: number;
  tombstone?: boolean;
};
