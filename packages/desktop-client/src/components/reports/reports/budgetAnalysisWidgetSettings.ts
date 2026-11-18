import type {
  BudgetAnalysisWidget,
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';

import {
  toComparableConditions,
  toComparableTimeFrame,
} from '#components/reports/widgetModified';

type BudgetAnalysisMeta = NonNullable<BudgetAnalysisWidget['meta']>;
type BudgetAnalysisGraphType = NonNullable<BudgetAnalysisMeta['graphType']>;

export type BudgetAnalysisWidgetSettings = Required<
  Pick<
    BudgetAnalysisMeta,
    | 'conditions'
    | 'conditionsOp'
    | 'timeFrame'
    | 'graphType'
    | 'showBalance'
    | 'balanceOnly'
    | 'showHiddenCategories'
  >
>;

/** The settings "Save widget" writes for a Budget Analysis widget. */
export function buildBudgetAnalysisWidgetSettings({
  conditions,
  conditionsOp,
  start,
  end,
  mode,
  graphType,
  showBalance,
  showCategories,
  showHiddenCategories,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  start: string;
  end: string;
  mode: TimeFrame['mode'];
  graphType: BudgetAnalysisGraphType;
  showBalance: boolean;
  showCategories: boolean;
  showHiddenCategories: boolean;
}): BudgetAnalysisWidgetSettings {
  return {
    conditions,
    conditionsOp,
    timeFrame: { start, end, mode },
    graphType,
    showBalance,
    balanceOnly: !showCategories,
    showHiddenCategories,
  };
}

export function toComparableBudgetAnalysisSettings(
  meta: Partial<BudgetAnalysisMeta> | null | undefined,
) {
  // Same fallbacks the report uses when it opens a widget.
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    timeFrame: toComparableTimeFrame(meta?.timeFrame),
    graphType: meta?.graphType || 'Bar',
    showBalance: meta?.showBalance ?? true,
    balanceOnly: meta?.balanceOnly ?? false,
    showHiddenCategories: meta?.showHiddenCategories ?? false,
  };
}
