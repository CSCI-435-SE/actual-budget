import { transactionAttachmentCountsQuery } from '@actual-app/core/shared/attachments';
import type { TransactionAttachmentCount } from '@actual-app/core/shared/attachments';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { useQuery } from './useQuery';

const EMPTY_COUNTS: ReadonlyMap<TransactionEntity['id'], number> = new Map();

// The number of attachments on each transaction, keyed by transaction id.
// Attachments on a split belong to the parent, so only parents and plain
// transactions appear. Updates live when attachments are added or removed.
export function useTransactionAttachmentCounts(): ReadonlyMap<
  TransactionEntity['id'],
  number
> {
  const { data } = useQuery<TransactionAttachmentCount>(
    () => transactionAttachmentCountsQuery(),
    [],
  );

  if (data == null || data.length === 0) {
    return EMPTY_COUNTS;
  }

  const counts = new Map<TransactionEntity['id'], number>();
  for (const row of data) {
    if (row.transaction_id != null && row.count > 0) {
      counts.set(row.transaction_id, row.count);
    }
  }
  return counts;
}
