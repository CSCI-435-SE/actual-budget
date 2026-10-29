import { theme } from '@actual-app/components/theme';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { getPeriodLength } from '@actual-app/core/shared/personal-inflation';
import type {
  CategoryInflation,
  InflationComparison,
  MonthPeriod,
  PersonalInflationResult,
} from '@actual-app/core/shared/personal-inflation';
import type { TimeFrame } from '@actual-app/core/types/models';
import type { Locale } from 'date-fns';

import type { useSpreadsheet } from '#hooks/useSpreadsheet';

// How many months of history the trend graph covers
export const TREND_MONTHS = 12;

export const DEFAULT_COMPARISON: InflationComparison = 'previous-year';

// Last calendar year, so the default never includes a partial month
export const defaultTimeFrame = {
  start: monthUtils.getYearStart(
    monthUtils.prevYear(monthUtils.currentMonth()),
  ),
  end: monthUtils.getYearEnd(monthUtils.prevYear(monthUtils.currentMonth())),
  mode: 'lastYear',
} satisfies TimeFrame;

export type PersonalInflationTrendPoint = {
  month: string;
  date: string;
  rate: number | null;
  hasInsufficientHistory: boolean;
};

export type PersonalInflationData = {
  // Result for the selected comparison
  summary: PersonalInflationResult;
  // Results for both comparisons, for showing them side by side
  byComparison: Record<InflationComparison, PersonalInflationResult>;
  trend: PersonalInflationTrendPoint[];
};

// One category across both comparisons. An entry is `null` when the
// category had no spending in either period of that comparison.
export type PersonalInflationCategoryRow = {
  category: string;
  current: number;
  previousPeriod: CategoryInflation | null;
  previousYear: CategoryInflation | null;
  // The entry for the selected comparison, which share and contribution
  // are based on
  selected: CategoryInflation | null;
};

// Some date range presets produce day-shaped bounds; the calculation works
// in whole months.
export function toMonthPeriod(start: string, end: string): MonthPeriod {
  return { start: monthUtils.getMonth(start), end: monthUtils.getMonth(end) };
}

// Each trend point uses a window the same length as the selected period,
// so the final point always matches the headline rate.
export function getTrendRange(period: MonthPeriod) {
  return {
    start: monthUtils.subMonths(period.end, TREND_MONTHS - 1),
    end: period.end,
    windowMonths: getPeriodLength(period),
  };
}

export function formatPeriod({ start, end }: MonthPeriod, locale: Locale) {
  if (start === end) {
    return monthUtils.format(start, 'MMMM yyyy', locale);
  }
  return `${monthUtils.format(start, 'MMM yyyy', locale)} – ${monthUtils.format(end, 'MMM yyyy', locale)}`;
}

export function formatRate(rate: number, language: string) {
  return new Intl.NumberFormat(language, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(rate);
}

export function formatShare(share: number, language: string) {
  return new Intl.NumberFormat(language, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(share);
}

// Joins both comparisons into one row per category, biggest movers in the
// selected comparison first. Categories without a contribution (new
// spending, or not enough history) go last, largest spending first.
export function getCategoryRows(
  byComparison: PersonalInflationData['byComparison'],
  comparison: InflationComparison,
): PersonalInflationCategoryRow[] {
  const previousPeriod = new Map(
    byComparison['previous-period'].categories.map(c => [c.category, c]),
  );
  const previousYear = new Map(
    byComparison['previous-year'].categories.map(c => [c.category, c]),
  );
  const ids = new Set([...previousPeriod.keys(), ...previousYear.keys()]);

  const rows = [...ids].map(id => {
    const row = {
      category: id,
      current: (previousPeriod.get(id) ?? previousYear.get(id))?.current ?? 0,
      previousPeriod: previousPeriod.get(id) ?? null,
      previousYear: previousYear.get(id) ?? null,
    };
    return {
      ...row,
      selected:
        comparison === 'previous-period'
          ? row.previousPeriod
          : row.previousYear,
    };
  });

  return rows.sort((a, b) => {
    const aContribution = a.selected?.contribution ?? null;
    const bContribution = b.selected?.contribution ?? null;
    if (aContribution === null || bContribution === null) {
      if (aContribution !== bContribution) {
        return aContribution === null ? 1 : -1;
      }
      return b.current - a.current;
    }
    return Math.abs(bContribution) - Math.abs(aContribution);
  });
}

// Spending more is shown as the unfavourable direction
export function getRateColor(rate: number | null) {
  if (rate === null) {
    return theme.pageTextSubdued;
  }
  if (rate === 0) {
    return theme.tableText;
  }
  return rate > 0 ? theme.reportsNumberNegative : theme.reportsNumberPositive;
}

export function createPersonalInflationSpreadsheet({
  start,
  end,
  comparison,
  locale,
}: {
  start: string;
  end: string;
  comparison: InflationComparison;
  locale: Locale;
}) {
  return async (
    _spreadsheet: ReturnType<typeof useSpreadsheet>,
    setData: (data: PersonalInflationData) => void,
  ) => {
    const period = toMonthPeriod(start, end);
    const [previousPeriod, previousYear, series] = await Promise.all([
      send('reports/personal-inflation', {
        ...period,
        comparison: 'previous-period',
      }),
      send('reports/personal-inflation', {
        ...period,
        comparison: 'previous-year',
      }),
      send('reports/personal-inflation-series', {
        ...getTrendRange(period),
        comparison,
      }),
    ]);

    setData({
      summary: comparison === 'previous-period' ? previousPeriod : previousYear,
      byComparison: {
        'previous-period': previousPeriod,
        'previous-year': previousYear,
      },
      trend: series.map(point => ({
        month: point.current.end,
        date: monthUtils.format(point.current.end, "MMM ''yy", locale),
        rate: point.rate,
        hasInsufficientHistory: point.hasInsufficientHistory,
      })),
    });
  };
}
