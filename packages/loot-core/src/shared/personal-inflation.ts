import * as monthUtils from './months';

// Net amount for one category in one month, as stored on transactions
// (spending is negative).
export type CategoryMonthAmount = {
  category: string;
  month: string;
  amount: number;
};

// Inclusive range of months, both in `YYYY-MM` format.
export type MonthPeriod = {
  start: string;
  end: string;
};

export type InflationComparison = 'previous-period' | 'previous-year';

export type CategoryInflation = {
  category: string;
  prior: number;
  current: number;
  // Share of total prior-period spending, 0-1.
  weight: number;
  // Fractional change (0.12 = 12% more). `null` when there was no prior
  // spending to compare against.
  rate: number | null;
  // `weight * rate`; the category's share of the overall rate.
  contribution: number | null;
};

export type PersonalInflation = {
  current: MonthPeriod;
  prior: MonthPeriod;
  priorTotal: number;
  currentTotal: number;
  // Weighted overall change. `null` when there was no prior spending, or
  // not enough history to compare against.
  rate: number | null;
  categories: CategoryInflation[];
  // The prior period starts before the first recorded transaction, so its
  // spending is incomplete. Rates are left out rather than reported against
  // what would look like a drop to zero.
  hasInsufficientHistory: boolean;
};

export type PersonalInflationResult = PersonalInflation & {
  // The current period includes a month that hasn't finished yet, so its
  // spending is likely understated.
  isPartial: boolean;
};

export function getPeriodLength(period: MonthPeriod) {
  return monthUtils.differenceInCalendarMonths(period.end, period.start) + 1;
}

export function getComparisonPeriod(
  period: MonthPeriod,
  comparison: InflationComparison,
): MonthPeriod {
  const offset = comparison === 'previous-year' ? 12 : getPeriodLength(period);
  return {
    start: monthUtils.subMonths(period.start, offset),
    end: monthUtils.subMonths(period.end, offset),
  };
}

// Builds one window of `windowMonths` months ending at each month in
// `range`, used to track the rate over time.
export function getTrailingPeriods(
  range: MonthPeriod,
  windowMonths: number,
): MonthPeriod[] {
  return monthUtils.rangeInclusive(range.start, range.end).map(end => ({
    start: monthUtils.subMonths(end, windowMonths - 1),
    end,
  }));
}

function sumSpending(
  amounts: CategoryMonthAmount[],
  categoryIds: Set<string>,
  period: MonthPeriod,
) {
  const totals = new Map<string, number>();
  for (const { category, month, amount } of amounts) {
    if (
      categoryIds.has(category) &&
      month >= period.start &&
      month <= period.end
    ) {
      totals.set(category, (totals.get(category) ?? 0) + amount);
    }
  }

  // Flip to positive spending; a category whose refunds outweigh its
  // spending counts as no spending rather than negative spending.
  const spending = new Map<string, number>();
  for (const [category, amount] of totals) {
    spending.set(category, Math.max(0, -amount));
  }
  return spending;
}

// Personal inflation using the user's own spending as the basket. Each
// category's change is weighted by its share of prior-period spending
// (base-period weights, as with a Laspeyres index), so a 12% rise in a
// category that made up 20% of spending adds 2.4 points to the rate.
// Categories with no prior spending have no rate and don't contribute.
//
// `historyStart` is the first month with any transactions (`null` when
// there are none); when given, a prior period that starts earlier is
// flagged as having insufficient history.
export function calculatePersonalInflation(
  amounts: CategoryMonthAmount[],
  categoryIds: string[],
  current: MonthPeriod,
  prior: MonthPeriod,
  historyStart?: string | null,
): PersonalInflation {
  const hasInsufficientHistory =
    historyStart === null ||
    (historyStart !== undefined && prior.start < historyStart);
  const ids = new Set(categoryIds);
  const priorSpending = sumSpending(amounts, ids, prior);
  const currentSpending = sumSpending(amounts, ids, current);

  let priorTotal = 0;
  let currentTotal = 0;
  for (const id of categoryIds) {
    priorTotal += priorSpending.get(id) ?? 0;
    currentTotal += currentSpending.get(id) ?? 0;
  }

  let rate: number | null = null;
  const categories: CategoryInflation[] = [];
  for (const id of categoryIds) {
    const priorAmount = priorSpending.get(id) ?? 0;
    const currentAmount = currentSpending.get(id) ?? 0;
    if (priorAmount === 0 && currentAmount === 0) {
      continue;
    }

    const weight = priorTotal === 0 ? 0 : priorAmount / priorTotal;
    let categoryRate: number | null = null;
    let contribution: number | null = null;
    if (priorAmount > 0 && !hasInsufficientHistory) {
      categoryRate = (currentAmount - priorAmount) / priorAmount;
      contribution = weight * categoryRate;
      rate = (rate ?? 0) + contribution;
    }

    categories.push({
      category: id,
      prior: priorAmount,
      current: currentAmount,
      weight,
      rate: categoryRate,
      contribution,
    });
  }

  return {
    current,
    prior,
    priorTotal,
    currentTotal,
    rate,
    categories,
    hasInsufficientHistory,
  };
}
