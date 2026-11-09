import * as monthUtils from '@actual-app/core/shared/months';
import type {
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';
import { isEqual } from 'es-toolkit';

/**
 * A time frame reduced to the setting the user chose, not the dates it
 * currently resolves to. Relative ranges (for example a sliding window or
 * "year to date") are re-resolved every time a report opens, so comparing
 * their dates would flag a widget as modified just because time has passed.
 */
export type ComparableTimeFrame =
  | { mode: 'static'; start: string; end: string }
  | { mode: 'sliding-window'; shape: 'day' | 'month'; width: number }
  | { mode: Exclude<TimeFrame['mode'], 'static' | 'sliding-window'> };

export function toComparableTimeFrame(
  timeFrame?: Partial<TimeFrame> | null,
  defaultTimeFrame?: Partial<TimeFrame>,
): ComparableTimeFrame {
  // Mirrors the fallbacks in `calculateTimeRange` so a widget without a
  // saved time frame compares equal to the range the report opens with.
  const start =
    timeFrame?.start ??
    defaultTimeFrame?.start ??
    monthUtils.subMonths(monthUtils.currentMonth(), 5);
  const end =
    timeFrame?.end ?? defaultTimeFrame?.end ?? monthUtils.currentMonth();
  const mode = timeFrame?.mode ?? defaultTimeFrame?.mode ?? 'sliding-window';

  if (mode === 'static') {
    return { mode, start, end };
  }

  if (mode === 'sliding-window') {
    if (
      monthUtils.isValidYearMonthDay(start) &&
      monthUtils.isValidYearMonthDay(end)
    ) {
      return {
        mode,
        shape: 'day',
        width: Math.max(monthUtils.differenceInCalendarDays(end, start), 0),
      };
    }
    return {
      mode,
      shape: 'month',
      width: monthUtils.differenceInCalendarMonths(end, start),
    };
  }

  return { mode };
}

export type ComparableConditions = {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
};

export function toComparableConditions(
  conditions?: RuleConditionEntity[] | null,
  conditionsOp?: 'and' | 'or' | null,
): ComparableConditions {
  // Same defaults as `useRuleConditionFilters`.
  return {
    conditions: conditions ?? [],
    conditionsOp: conditionsOp ?? 'and',
  };
}

// Drops keys whose value is `undefined`, the same way saving the widget
// does, so `{ a: undefined }` and `{}` compare equal.
function toSavedShape(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

type IsWidgetModifiedArgs<T> = {
  /** False when the report was opened without a widget. */
  hasWidget: boolean;
  /** False until the report has finished loading its saved settings. */
  isReady: boolean;
  /** The saved widget settings, in comparable form. */
  saved: T;
  /** The settings "Save widget" would write now, in comparable form. */
  current: T;
};

export function isWidgetModified<T>({
  hasWidget,
  isReady,
  saved,
  current,
}: IsWidgetModifiedArgs<T>): boolean {
  if (!hasWidget || !isReady) {
    return false;
  }
  return !isEqual(toSavedShape(saved), toSavedShape(current));
}
