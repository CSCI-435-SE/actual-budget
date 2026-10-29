import * as db from '#server/db';
import { ValidationError } from '#server/errors';
import * as monthUtils from '#shared/months';
import {
  calculatePersonalInflation,
  getComparisonPeriod,
  getTrailingPeriods,
} from '#shared/personal-inflation';
import type {
  CategoryMonthAmount,
  InflationComparison,
  MonthPeriod,
  PersonalInflation,
  PersonalInflationResult,
} from '#shared/personal-inflation';

type PersonalInflationOptions = {
  comparison?: InflationComparison;
  includeHidden?: boolean;
};

// Spending per category per month. The filters match the budget's
// `sum-amount` cells (see `createCategory` in `server/budget/base.ts`) so
// these numbers line up with the spent column on the budget page.
async function getCategoryMonthAmounts(
  start: string,
  end: string,
): Promise<CategoryMonthAmount[]> {
  const rows = await db.all<{
    category: string;
    month: number;
    amount: number | null;
  }>(
    `SELECT t.category AS category,
            t.date / 100 AS month,
            SUM(t.amount) AS amount
       FROM v_transactions_internal_alive t
       LEFT JOIN accounts a ON a.id = t.account
      WHERE t.date >= ? AND t.date <= ?
        AND t.category IS NOT NULL
        AND a.offbudget = 0
      GROUP BY t.category, t.date / 100`,
    [monthUtils.bounds(start).start, monthUtils.bounds(end).end],
  );

  return rows.map(row => {
    const month = String(row.month);
    return {
      category: row.category,
      month: `${month.slice(0, 4)}-${month.slice(4)}`,
      amount: row.amount ?? 0,
    };
  });
}

// The month of the first on-budget transaction, or `null` when there are
// none. Months before this have no data, not zero spending.
async function getHistoryStart(): Promise<string | null> {
  const row = await db.first<{ date: number | null }>(
    `SELECT MIN(t.date) AS date
       FROM v_transactions_internal_alive t
       LEFT JOIN accounts a ON a.id = t.account
      WHERE a.offbudget = 0`,
  );
  if (!row?.date) {
    return null;
  }
  const date = String(row.date);
  return `${date.slice(0, 4)}-${date.slice(4, 6)}`;
}

// Expense categories to include in the basket. Income is never spending;
// hidden categories (or ones under a hidden group or parent) are left out
// unless asked for.
async function getExpenseCategoryIds(includeHidden: boolean) {
  const groups = await db.getCategoriesGrouped();
  const ids: string[] = [];
  for (const group of groups) {
    if (group.is_income || (!includeHidden && group.hidden)) {
      continue;
    }
    const hiddenIds = new Set(
      group.categories.filter(cat => cat.hidden).map(cat => cat.id),
    );
    for (const cat of group.categories) {
      const isHidden =
        hiddenIds.has(cat.id) ||
        (cat.parent_id != null && hiddenIds.has(cat.parent_id));
      if (!cat.is_income && (includeHidden || !isHidden)) {
        ids.push(cat.id);
      }
    }
  }
  return ids;
}

function validatePeriod({ start, end }: MonthPeriod) {
  if (
    !monthUtils.isValidYearMonth(start) ||
    !monthUtils.isValidYearMonth(end)
  ) {
    throw new ValidationError('Months must be in YYYY-MM format');
  }
  if (start > end) {
    throw new ValidationError('Start month must not be after end month');
  }
}

function withPartial(result: PersonalInflation): PersonalInflationResult {
  return {
    ...result,
    isPartial: result.current.end >= monthUtils.currentMonth(),
  };
}

export async function getPersonalInflation({
  start,
  end,
  comparison = 'previous-year',
  includeHidden = false,
}: MonthPeriod & PersonalInflationOptions): Promise<PersonalInflationResult> {
  const current = { start, end };
  validatePeriod(current);
  const prior = getComparisonPeriod(current, comparison);

  const [amounts, categoryIds, historyStart] = await Promise.all([
    getCategoryMonthAmounts(prior.start, current.end),
    getExpenseCategoryIds(includeHidden),
    getHistoryStart(),
  ]);

  return withPartial(
    calculatePersonalInflation(
      amounts,
      categoryIds,
      current,
      prior,
      historyStart,
    ),
  );
}

// The rate for a trailing window of `windowMonths` ending at each month
// from `start` to `end`.
export async function getPersonalInflationSeries({
  start,
  end,
  windowMonths = 12,
  comparison = 'previous-year',
  includeHidden = false,
}: MonthPeriod &
  PersonalInflationOptions & {
    windowMonths?: number;
  }): Promise<PersonalInflationResult[]> {
  validatePeriod({ start, end });
  if (!Number.isInteger(windowMonths) || windowMonths < 1) {
    throw new ValidationError('windowMonths must be a positive integer');
  }

  const periods = getTrailingPeriods({ start, end }, windowMonths).map(
    current => ({
      current,
      prior: getComparisonPeriod(current, comparison),
    }),
  );

  const [amounts, categoryIds, historyStart] = await Promise.all([
    getCategoryMonthAmounts(periods[0].prior.start, end),
    getExpenseCategoryIds(includeHidden),
    getHistoryStart(),
  ]);

  return periods.map(({ current, prior }) =>
    withPartial(
      calculatePersonalInflation(
        amounts,
        categoryIds,
        current,
        prior,
        historyStart,
      ),
    ),
  );
}
