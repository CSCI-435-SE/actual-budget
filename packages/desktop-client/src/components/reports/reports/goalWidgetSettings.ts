import type {
  GoalCardWidget,
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';

import {
  toComparableConditions,
  toComparableTimeFrame,
} from '#components/reports/widgetModified';

type GoalMeta = NonNullable<GoalCardWidget['meta']>;

export type GoalWidgetSettings = Required<
  Pick<GoalMeta, 'conditions' | 'conditionsOp' | 'targetAmount' | 'timeFrame'>
> &
  Pick<GoalMeta, 'linkedTag'>;

/**
 * The settings "Save widget" writes for a Goal widget. `linkedTag` is
 * `undefined` when no tag is linked, and saving then removes it.
 */
export function buildGoalWidgetSettings({
  conditions,
  conditionsOp,
  targetAmount,
  linkedTag,
  start,
  end,
  mode,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  targetAmount: number;
  linkedTag: string | undefined;
  start: string;
  end: string;
  mode: TimeFrame['mode'];
}): GoalWidgetSettings {
  return {
    conditions,
    conditionsOp,
    targetAmount,
    linkedTag: linkedTag || undefined,
    timeFrame: { start, end, mode },
  };
}

export function toComparableGoalSettings(
  meta: Partial<GoalMeta> | null | undefined,
) {
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    targetAmount: meta?.targetAmount ?? 0,
    linkedTag: meta?.linkedTag || undefined,
    // Without a saved time frame the report shows all time.
    timeFrame: toComparableTimeFrame(meta?.timeFrame, { mode: 'full' }),
  };
}
