import type {
  NetWorthWidget,
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';

import {
  toComparableConditions,
  toComparableTimeFrame,
} from '#components/reports/widgetModified';

type NetWorthMeta = NonNullable<NetWorthWidget['meta']>;
type NetWorthInterval = NonNullable<NetWorthMeta['interval']>;
type NetWorthGraphMode = NonNullable<NetWorthMeta['mode']>;

export type NetWorthWidgetSettings = Required<
  Pick<
    NetWorthMeta,
    'conditions' | 'conditionsOp' | 'interval' | 'mode' | 'timeFrame'
  >
>;

export function getDefaultNetWorthInterval(
  mode: TimeFrame['mode'],
): NetWorthInterval {
  // A single month reads better week by week than as one monthly point.
  return mode === 'lastMonth' ? 'Weekly' : 'Monthly';
}

/** The settings "Save widget" writes for a Net Worth widget. */
export function buildNetWorthWidgetSettings({
  conditions,
  conditionsOp,
  interval,
  graphMode,
  start,
  end,
  mode,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  interval: NetWorthInterval;
  graphMode: NetWorthGraphMode;
  start: string;
  end: string;
  mode: TimeFrame['mode'];
}): NetWorthWidgetSettings {
  return {
    conditions,
    conditionsOp,
    interval,
    mode: graphMode,
    timeFrame: { start, end, mode },
  };
}

export function toComparableNetWorthSettings(
  meta: Partial<NetWorthMeta> | null | undefined,
) {
  const timeFrame = toComparableTimeFrame(meta?.timeFrame);
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    interval: meta?.interval ?? getDefaultNetWorthInterval(timeFrame.mode),
    mode: meta?.mode ?? 'trend',
    timeFrame,
  };
}
