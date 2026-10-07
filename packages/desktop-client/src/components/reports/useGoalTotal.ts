import { useEffect, useMemo, useState } from 'react';

import { listen } from '@actual-app/core/platform/client/connection';
import type {
  RuleConditionEntity,
  SummaryContent,
} from '@actual-app/core/types/models';

import { summarySpreadsheet } from '#components/reports/spreadsheets/summary-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useLocale } from '#hooks/useLocale';

type UseGoalTotalArgs = {
  start: string;
  end: string;
  conditions?: RuleConditionEntity[];
  conditionsOp?: 'and' | 'or';
  linkedTag?: string;
};

/**
 * Sums the transactions tagged with `linkedTag` that match `conditions`
 * between `start` and `end`. Returns 0 when no tag is linked.
 *
 * The total is live: it recalculates whenever transactions change, locally
 * or through a sync.
 */
export function useGoalTotal({
  start,
  end,
  conditions,
  conditionsOp,
  linkedTag,
}: UseGoalTotalArgs) {
  const locale = useLocale();
  const [refreshCount, setRefreshCount] = useState(0);
  const [lastTotal, setLastTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!linkedTag) {
      return;
    }
    // Same signal `liveQuery` uses to refetch after local edits and syncs.
    return listen('sync-event', event => {
      if (
        (event.type === 'applied' || event.type === 'success') &&
        event.tables.includes('transactions')
      ) {
        setRefreshCount(count => count + 1);
      }
    });
  }, [linkedTag]);

  // `refreshCount` is a dependency only so a transaction change produces a new
  // function, which makes `useReport` run the query again.
  const params = useMemo(() => {
    if (!linkedTag) {
      // Without a tag nothing counts toward the goal, so skip the query.
      return async () => undefined;
    }
    return summarySpreadsheet(
      start,
      end,
      conditions,
      conditionsOp,
      SUM_CONTENT,
      locale,
      [goalTagCondition(linkedTag)],
    );
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- refreshCount forces a re-run
  }, [start, end, conditions, conditionsOp, linkedTag, locale, refreshCount]);

  const data = useReport<{ total: number }>('goal', params);

  // `useReport` clears its result while re-running, so keep showing the last
  // total until the new one arrives instead of flickering to 0.
  if (data && data.total !== lastTotal) {
    setLastTotal(data.total);
  }

  if (!linkedTag) {
    return 0;
  }
  return data?.total ?? lastTotal ?? 0;
}

/**
 * The condition that limits a goal to transactions tagged with its tag. It is
 * always ANDed with the goal's own conditions.
 */
export function goalTagCondition(linkedTag: string): RuleConditionEntity {
  return {
    field: 'notes',
    op: 'hasTags',
    value: `#${linkedTag}`,
    type: 'string',
  };
}

const SUM_CONTENT: SummaryContent = { type: 'sum' };
