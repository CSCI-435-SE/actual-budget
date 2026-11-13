import type {
  CalendarWidget,
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';

import {
  toComparableConditions,
  toComparableTimeFrame,
} from '#components/reports/widgetModified';

type CalendarMeta = NonNullable<CalendarWidget['meta']>;

export type CalendarWidgetSettings = Required<
  Pick<CalendarMeta, 'conditions' | 'conditionsOp' | 'timeFrame'>
>;

/** The settings "Save widget" writes for a Calendar widget. */
export function buildCalendarWidgetSettings({
  conditions,
  conditionsOp,
  start,
  end,
  mode,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  start: string;
  end: string;
  mode: TimeFrame['mode'];
}): CalendarWidgetSettings {
  return {
    conditions,
    conditionsOp,
    timeFrame: { start, end, mode },
  };
}

export function toComparableCalendarSettings(
  meta: Partial<CalendarMeta> | null | undefined,
) {
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    // Without a saved time frame the report shows all time.
    timeFrame: toComparableTimeFrame(meta?.timeFrame, { mode: 'full' }),
  };
}
