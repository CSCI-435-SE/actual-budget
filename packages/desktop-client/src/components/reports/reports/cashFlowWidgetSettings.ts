import * as monthUtils from '@actual-app/core/shared/months';
import type {
  CashFlowWidget,
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';

import {
  toComparableConditions,
  toComparableTimeFrame,
} from '#components/reports/widgetModified';

type CashFlowMeta = NonNullable<CashFlowWidget['meta']>;

// Month-shaped so the range means the whole current month (the query clamps
// to today); day-shaped values here would slide by days instead.
export const defaultTimeFrame = {
  start: monthUtils.currentMonth(),
  end: monthUtils.currentMonth(),
  mode: 'sliding-window',
} satisfies TimeFrame;

export type CashFlowWidgetSettings = Required<
  Pick<
    CashFlowMeta,
    'conditions' | 'conditionsOp' | 'timeFrame' | 'showBalance'
  >
>;

/** The settings "Save widget" writes for a Cash Flow widget. */
export function buildCashFlowWidgetSettings({
  conditions,
  conditionsOp,
  start,
  end,
  mode,
  showBalance,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  start: string;
  end: string;
  mode: TimeFrame['mode'];
  showBalance: boolean;
}): CashFlowWidgetSettings {
  return {
    conditions,
    conditionsOp,
    timeFrame: { start, end, mode },
    showBalance,
  };
}

export function toComparableCashFlowSettings(
  meta: Partial<CashFlowMeta> | null | undefined,
) {
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    timeFrame: toComparableTimeFrame(meta?.timeFrame, defaultTimeFrame),
    showBalance: meta?.showBalance ?? true,
  };
}
