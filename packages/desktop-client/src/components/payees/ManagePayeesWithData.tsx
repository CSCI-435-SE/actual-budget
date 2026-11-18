import React, { useCallback, useEffect } from 'react';

import { listen, send } from '@actual-app/core/platform/client/connection';
import * as undo from '@actual-app/core/platform/client/undo';
import type { UndoState } from '@actual-app/core/server/undo';
import { applyChanges } from '@actual-app/core/shared/util';
import type { Diff } from '@actual-app/core/shared/util';
import type { NewRuleEntity, PayeeEntity } from '@actual-app/core/types/models';
import { useQueryClient } from '@tanstack/react-query';

import { useOrphanedPayees } from '#hooks/useOrphanedPayees';
import { usePayeeRuleCounts } from '#hooks/usePayeeRuleCounts';
import { usePayees } from '#hooks/usePayees';
import { usePayeeUsageStats } from '#hooks/usePayeeUsageStats';
import { pushModal } from '#modals/modalsSlice';
import { payeeQueries } from '#payees';
import { useDispatch } from '#redux';

import { ManagePayees } from './ManagePayees';

// Changes to these tables can change a payee's transaction count, last-used
// date, or whether it is unused
const USAGE_TABLES = ['transactions', 'payees', 'payee_mapping'];

type ManagePayeesWithDataProps = {
  initialSelectedIds: string[];
};

export function ManagePayeesWithData({
  initialSelectedIds,
}: ManagePayeesWithDataProps) {
  const queryClient = useQueryClient();
  const { data: payees = [], refetch: refetchPayees } = usePayees();
  const { data: orphanedPayees = [], refetch: refetchOrphanedPayees } =
    useOrphanedPayees();
  const dispatch = useDispatch();
  const { data: ruleCounts = new Map(), refetch: refetchRuleCounts } =
    usePayeeRuleCounts();
  // Undefined until the first load finishes; the cells show a placeholder
  const { data: usageStats, refetch: refetchUsageStats } = usePayeeUsageStats();

  // The unused-payees list and the usage stats read the same transactions
  // view, so they are always refetched together to keep them consistent.
  // useCallback: the effects below re-subscribe whenever this changes
  const refetchPayeeUsage = useCallback(async () => {
    await Promise.all([refetchOrphanedPayees(), refetchUsageStats()]);
  }, [refetchOrphanedPayees, refetchUsageStats]);

  useEffect(() => {
    const unlisten = listen('sync-event', async event => {
      if (event.type === 'applied') {
        if (
          event.tables.includes('rules') ||
          event.tables.includes('schedules')
        ) {
          await refetchRuleCounts();
        }
        if (USAGE_TABLES.some(table => event.tables.includes(table))) {
          await refetchPayeeUsage();
        }
      }
    });

    return () => {
      unlisten();
    };
  }, [dispatch, refetchRuleCounts, refetchPayeeUsage]);

  useEffect(() => {
    async function onUndo({ tables, messages, meta }: UndoState) {
      // Undo is global, so this can also be undoing a transaction change
      // made on another page before the user came here
      if (!USAGE_TABLES.some(table => tables.includes(table))) {
        return;
      }

      await refetchPayeeUsage();

      const targetId =
        meta && typeof meta === 'object' && 'targetId' in meta
          ? meta.targetId
          : null;

      if (targetId || messages.find(msg => msg.dataset === 'rules')) {
        await refetchRuleCounts();
      }

      undo.setUndoState('undoEvent', null);
    }

    const lastUndoEvent = undo.getUndoState('undoEvent');
    if (lastUndoEvent) {
      void onUndo(lastUndoEvent);
    }

    return listen('undo-event', onUndo);
  }, [dispatch, refetchRuleCounts, refetchPayeeUsage]);

  function onViewRules(id: PayeeEntity['id']) {
    dispatch(
      pushModal({ modal: { name: 'manage-rules', options: { payeeId: id } } }),
    );
  }

  function onCreateRule(id: PayeeEntity['id']) {
    const rule: NewRuleEntity = {
      stage: null,
      conditionsOp: 'and',
      conditions: [
        {
          field: 'payee',
          op: 'is',
          value: id,
          type: 'id',
        },
      ],
      actions: [
        {
          op: 'set',
          field: 'category',
          value: null,
          type: 'id',
        },
      ],
    };
    dispatch(pushModal({ modal: { name: 'edit-rule', options: { rule } } }));
  }

  return (
    <ManagePayees
      payees={payees}
      ruleCounts={ruleCounts}
      usageStats={usageStats}
      orphanedPayees={orphanedPayees}
      initialSelectedIds={initialSelectedIds}
      onBatchChange={async (changes: Diff<PayeeEntity>) => {
        await send('payees-batch-change', changes);
        queryClient.setQueryData(
          payeeQueries.listOrphaned().queryKey,
          existing => applyChanges(changes, existing ?? []),
        );
      }}
      onMerge={async ([targetId, ...mergeIds]) => {
        await send('payees-merge', { targetId, mergeIds });

        // Refetched from the server instead of patched locally, so the
        // unused-payees list and the target's new count can't disagree
        await Promise.all([refetchRuleCounts(), refetchPayeeUsage()]);

        void refetchPayees();
      }}
      onViewRules={onViewRules}
      onCreateRule={onCreateRule}
    />
  );
}
