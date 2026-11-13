import type {
  AgeOfMoneyGranularity,
  AgeOfMoneyWidget,
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';

import {
  toComparableConditions,
  toComparableTimeFrame,
} from '#components/reports/widgetModified';

type AgeOfMoneyMeta = NonNullable<AgeOfMoneyWidget['meta']>;

export type AgeOfMoneyWidgetSettings = Required<
  Pick<
    AgeOfMoneyMeta,
    'conditions' | 'conditionsOp' | 'timeFrame' | 'granularity'
  >
>;

/** The settings "Save widget" writes for an Age of Money widget. */
export function buildAgeOfMoneyWidgetSettings({
  conditions,
  conditionsOp,
  start,
  end,
  mode,
  granularity,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  start: string;
  end: string;
  mode: TimeFrame['mode'];
  granularity: AgeOfMoneyGranularity;
}): AgeOfMoneyWidgetSettings {
  return {
    conditions,
    conditionsOp,
    timeFrame: { start, end, mode },
    granularity,
  };
}

export function toComparableAgeOfMoneySettings(
  meta: Partial<AgeOfMoneyMeta> | null | undefined,
) {
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    // No default time frame: the report falls back to the last six months.
    timeFrame: toComparableTimeFrame(meta?.timeFrame),
    granularity: meta?.granularity ?? 'monthly',
  };
}
