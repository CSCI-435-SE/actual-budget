import * as monthUtils from '@actual-app/core/shared/months';
import type {
  BalanceForecastWidget,
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';
import type { ForecastSource } from '@actual-app/core/types/models/forecast';

import { toComparableConditions } from '#components/reports/widgetModified';

type BalanceForecastMeta = NonNullable<BalanceForecastWidget['meta']>;
type BalanceForecastGranularity = NonNullable<
  BalanceForecastMeta['granularity']
>;
type BudgetType = 'envelope' | 'tracking';

/**
 * The range a widget opens with. Unlike the other reports, Balance Forecast
 * shows the saved dates as they are, without re-resolving relative modes,
 * and still reads the `startDate`/`endDate` fields older widgets saved.
 */
export function getInitialBalanceForecastTimeFrame(
  meta: Partial<BalanceForecastMeta> | null | undefined,
): TimeFrame {
  const currentMonth = monthUtils.currentMonth();
  return {
    start: meta?.timeFrame?.start ?? meta?.startDate ?? currentMonth,
    end:
      meta?.timeFrame?.end ??
      meta?.endDate ??
      monthUtils.addMonths(currentMonth, 11),
    mode: meta?.timeFrame?.mode ?? 'static',
  };
}

/** The tracking-budget forecast is only offered on tracking budgets. */
export function getBalanceForecastSource(
  source: ForecastSource | undefined,
  budgetType: BudgetType,
): ForecastSource {
  return source === 'tracking-budget' && budgetType === 'tracking'
    ? 'tracking-budget'
    : 'schedules';
}

export type BalanceForecastWidgetSettings = Required<
  Pick<
    BalanceForecastMeta,
    | 'conditions'
    | 'conditionsOp'
    | 'startDate'
    | 'endDate'
    | 'granularity'
    | 'source'
    | 'timeFrame'
  >
>;

/** The settings "Save widget" writes for a Balance Forecast widget. */
export function buildBalanceForecastWidgetSettings({
  conditions,
  conditionsOp,
  start,
  end,
  mode,
  granularity,
  source,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  start: string;
  end: string;
  mode: TimeFrame['mode'];
  granularity: BalanceForecastGranularity;
  source: ForecastSource;
}): BalanceForecastWidgetSettings {
  return {
    conditions,
    conditionsOp,
    // Kept for older versions that read these instead of `timeFrame`.
    startDate: start,
    endDate: end,
    // The tracking-budget forecast only has monthly data.
    granularity: source === 'tracking-budget' ? 'Monthly' : granularity,
    source,
    timeFrame: { start, end, mode },
  };
}

export function toComparableBalanceForecastSettings(
  meta: Partial<BalanceForecastMeta> | null | undefined,
  { budgetType }: { budgetType: BudgetType },
) {
  // Same fallbacks the report uses when it opens a widget. `startDate` and
  // `endDate` only mirror the time frame, so they are not compared apart.
  const source = getBalanceForecastSource(meta?.source, budgetType);
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    granularity:
      source === 'tracking-budget'
        ? 'Monthly'
        : (meta?.granularity ?? 'Monthly'),
    source,
    timeFrame: getInitialBalanceForecastTimeFrame(meta),
  };
}
