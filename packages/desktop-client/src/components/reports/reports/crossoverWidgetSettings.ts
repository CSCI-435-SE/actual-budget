import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AccountEntity,
  CategoryEntity,
  CrossoverWidget,
  TimeFrame,
} from '@actual-app/core/types/models';

import { calculateTimeRange } from '#components/reports/reportRanges';
import { toComparableTimeFrame } from '#components/reports/widgetModified';

type CrossoverMeta = NonNullable<CrossoverWidget['meta']>;

export const defaultTimeFrame = {
  start: monthUtils.subMonths(monthUtils.currentMonth(), 120),
  end: monthUtils.subMonths(monthUtils.currentMonth(), 1),
  mode: 'full',
} satisfies TimeFrame;

/**
 * Fits a range to the months the report can show. The current month is never
 * included, so sliding windows end last month and "all time" spans every
 * month with data.
 */
export function adjustCrossoverRange(
  start: string,
  end: string,
  mode: TimeFrame['mode'],
  earliestMonth: string,
  latestMonth: string,
): [string, string] {
  const clampMonth = (month: string) => {
    if (monthUtils.isBefore(month, earliestMonth)) return earliestMonth;
    if (monthUtils.isAfter(month, latestMonth)) return latestMonth;
    return month;
  };

  let adjustedStart: string;
  let adjustedEnd: string;
  if (mode === 'sliding-window') {
    adjustedStart = clampMonth(monthUtils.subMonths(start, 1));
    adjustedEnd = clampMonth(monthUtils.subMonths(end, 1));
  } else if (mode === 'full') {
    adjustedStart = earliestMonth;
    adjustedEnd = latestMonth;
  } else {
    adjustedStart = clampMonth(start);
    adjustedEnd = clampMonth(end);
  }
  if (monthUtils.isBefore(adjustedEnd, adjustedStart)) {
    adjustedEnd = adjustedStart;
  }
  return [adjustedStart, adjustedEnd];
}

export type CrossoverRangeContext = {
  earliestMonth: string;
  latestMonth: string;
  latestTransaction: string;
};

/** The range the report shows for a saved time frame. */
export function resolveCrossoverTimeFrame(
  timeFrame: Partial<TimeFrame> | undefined,
  { earliestMonth, latestMonth, latestTransaction }: CrossoverRangeContext,
): TimeFrame {
  const [start, end, mode] = calculateTimeRange(
    timeFrame,
    defaultTimeFrame,
    latestTransaction,
  );
  const [adjustedStart, adjustedEnd] = adjustCrossoverRange(
    start,
    end,
    mode,
    earliestMonth,
    latestMonth,
  );
  return { start: adjustedStart, end: adjustedEnd, mode };
}

export type CrossoverWidgetSettings = Required<
  Pick<
    CrossoverMeta,
    | 'expenseCategoryIds'
    | 'incomeAccountIds'
    | 'safeWithdrawalRate'
    | 'estimatedReturn'
    | 'expectedContribution'
    | 'projectionType'
    | 'expenseAdjustmentFactor'
    | 'showHiddenCategories'
    | 'timeFrame'
  >
>;

/** The settings "Save widget" writes for a Crossover Point widget. */
export function buildCrossoverWidgetSettings({
  selectedExpenseCategories,
  selectedIncomeAccountIds,
  swr,
  useCustomGrowth,
  estimatedReturn,
  expectedContribution,
  projectionType,
  expenseAdjustmentFactor,
  showHiddenCategories,
  start,
  end,
  mode,
}: {
  selectedExpenseCategories: Array<Pick<CategoryEntity, 'id'>>;
  selectedIncomeAccountIds: string[];
  swr: number;
  useCustomGrowth: boolean;
  estimatedReturn: number | null;
  expectedContribution: number | null;
  projectionType: 'hampel' | 'median' | 'mean';
  expenseAdjustmentFactor: number;
  showHiddenCategories: boolean;
  start: string;
  end: string;
  mode: TimeFrame['mode'];
}): CrossoverWidgetSettings {
  return {
    expenseCategoryIds: selectedExpenseCategories.map(c => c.id),
    incomeAccountIds: selectedIncomeAccountIds,
    safeWithdrawalRate: swr,
    estimatedReturn: useCustomGrowth ? (estimatedReturn ?? 0) : null,
    expectedContribution: useCustomGrowth ? (expectedContribution ?? 0) : null,
    projectionType,
    expenseAdjustmentFactor,
    showHiddenCategories,
    timeFrame: { start, end, mode },
  };
}

export type CrossoverComparisonContext = {
  categories: Array<Pick<CategoryEntity, 'id' | 'is_income'>>;
  accounts: Array<Pick<AccountEntity, 'id'>>;
  /** Missing until the months with data have loaded. */
  range?: CrossoverRangeContext;
};

export function toComparableCrossoverSettings(
  meta: Partial<CrossoverMeta> | null | undefined,
  { categories, accounts, range }: CrossoverComparisonContext,
) {
  // Mirrors how the report reads the saved selections: no saved list means
  // everything, and categories that no longer exist are dropped. Reading
  // through the category list also puts both sides in the same order.
  const savedCategoryIds = meta?.expenseCategoryIds;
  const expenseCategoryIds =
    savedCategoryIds !== undefined
      ? categories.filter(c => savedCategoryIds.includes(c.id)).map(c => c.id)
      : categories.filter(c => !c.is_income).map(c => c.id);
  const incomeAccountIds = meta?.incomeAccountIds ?? accounts.map(a => a.id);

  return {
    expenseCategoryIds,
    incomeAccountIds: [...incomeAccountIds].sort(),
    safeWithdrawalRate: meta?.safeWithdrawalRate ?? 0.04,
    estimatedReturn: meta?.estimatedReturn ?? null,
    expectedContribution: meta?.expectedContribution ?? null,
    projectionType: meta?.projectionType ?? 'hampel',
    expenseAdjustmentFactor: meta?.expenseAdjustmentFactor ?? 1.0,
    showHiddenCategories: meta?.showHiddenCategories ?? false,
    timeFrame: toComparableTimeFrame(
      range
        ? resolveCrossoverTimeFrame(meta?.timeFrame, range)
        : meta?.timeFrame,
      defaultTimeFrame,
    ),
  };
}
