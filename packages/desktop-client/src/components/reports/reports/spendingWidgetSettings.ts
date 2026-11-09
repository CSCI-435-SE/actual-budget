import type {
  RuleConditionEntity,
  SpendingAverageRange,
  SpendingWidget,
} from '@actual-app/core/types/models';

import { calculateSpendingReportTimeRange } from '#components/reports/reportRanges';
import { normalizeSpendingAverageRange } from '#components/reports/spendingAverageRange';
import { toComparableConditions } from '#components/reports/widgetModified';

type SpendingMeta = NonNullable<SpendingWidget['meta']>;
type SpendingMode = NonNullable<SpendingMeta['mode']>;

export type SpendingWidgetSettings = Required<
  Pick<
    SpendingMeta,
    | 'conditions'
    | 'conditionsOp'
    | 'compare'
    | 'compareTo'
    | 'averageRange'
    | 'isLive'
    | 'mode'
  >
>;

/** The settings "Save" writes for a Monthly Spending widget. */
export function buildSpendingWidgetSettings({
  conditions,
  conditionsOp,
  compare,
  compareTo,
  averageRange,
  isLive,
  reportMode,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  compare: string;
  compareTo: string;
  averageRange: SpendingAverageRange;
  isLive: boolean;
  reportMode: SpendingMode;
}): SpendingWidgetSettings {
  return {
    conditions,
    conditionsOp,
    compare,
    compareTo,
    averageRange,
    isLive,
    mode: reportMode,
  };
}

export function toComparableSpendingSettings(
  meta: Partial<SpendingMeta> | null | undefined,
) {
  const isLive = meta?.isLive ?? true;
  const mode = meta?.mode ?? 'single-month';
  // Resolve the months the same way the report does when it opens, so a
  // widget without saved months compares equal to the defaults it shows.
  // This also ignores the second month of a live budget or average
  // comparison, which the report replaces with the first one.
  const [compare, compareTo] = calculateSpendingReportTimeRange(meta ?? {});
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    compare,
    compareTo,
    averageRange: normalizeSpendingAverageRange(meta?.averageRange),
    isLive,
    mode,
  };
}
