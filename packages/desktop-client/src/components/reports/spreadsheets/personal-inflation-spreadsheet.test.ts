import type {
  CategoryInflation,
  PersonalInflationResult,
} from '@actual-app/core/shared/personal-inflation';
import { enUS } from 'date-fns/locale';
import { describe, expect, it } from 'vitest';

import {
  formatPeriod,
  formatRate,
  formatShare,
  getCategoryRows,
  getTrendRange,
  toMonthPeriod,
} from './personal-inflation-spreadsheet';

function category(
  id: string,
  contribution: number | null,
  current = 0,
): CategoryInflation {
  return {
    category: id,
    prior: 0,
    current,
    weight: 0,
    rate: contribution,
    contribution,
  };
}

function result(categories: CategoryInflation[]): PersonalInflationResult {
  return {
    current: { start: '2025-07', end: '2025-09' },
    prior: { start: '2025-04', end: '2025-06' },
    priorTotal: 0,
    currentTotal: 0,
    rate: null,
    categories,
    hasInsufficientHistory: false,
    isPartial: false,
  };
}

describe('toMonthPeriod', () => {
  it('collapses day-shaped bounds to months', () => {
    expect(toMonthPeriod('2025-01-01', '2025-10-28')).toEqual({
      start: '2025-01',
      end: '2025-10',
    });
    expect(toMonthPeriod('2025-01', '2025-12')).toEqual({
      start: '2025-01',
      end: '2025-12',
    });
  });
});

describe('getTrendRange', () => {
  it('covers the last 12 months with windows the length of the period', () => {
    expect(getTrendRange({ start: '2025-07', end: '2025-09' })).toEqual({
      start: '2024-10',
      end: '2025-09',
      windowMonths: 3,
    });
  });
});

describe('formatPeriod', () => {
  it('names a single month in full', () => {
    expect(formatPeriod({ start: '2025-06', end: '2025-06' }, enUS)).toBe(
      'June 2025',
    );
  });

  it('shows both ends of a longer period', () => {
    expect(formatPeriod({ start: '2025-04', end: '2025-06' }, enUS)).toBe(
      'Apr 2025 – Jun 2025',
    );
  });
});

describe('formatRate', () => {
  it('shows a sign and one decimal place', () => {
    expect(formatRate(0.024, 'en-US')).toBe('+2.4%');
    expect(formatRate(-0.1, 'en-US')).toBe('-10.0%');
    expect(formatRate(0, 'en-US')).toBe('0.0%');
  });
});

describe('formatShare', () => {
  it('shows no sign', () => {
    expect(formatShare(0.2, 'en-US')).toBe('20.0%');
  });
});

describe('getCategoryRows', () => {
  it('joins both comparisons into one row per category', () => {
    const rows = getCategoryRows(
      {
        'previous-period': result([category('a', 0.1, 500)]),
        // Only spent on 'b' in the same months last year
        'previous-year': result([
          category('a', -0.2, 500),
          { ...category('b', -1), prior: 300 },
        ]),
      },
      'previous-period',
    );

    expect(rows).toEqual([
      expect.objectContaining({
        category: 'a',
        current: 500,
        previousPeriod: expect.objectContaining({ rate: 0.1 }),
        previousYear: expect.objectContaining({ rate: -0.2 }),
        selected: expect.objectContaining({ rate: 0.1 }),
      }),
      expect.objectContaining({
        category: 'b',
        current: 0,
        previousPeriod: null,
        previousYear: expect.objectContaining({ rate: -1 }),
        selected: null,
      }),
    ]);
  });

  it('orders by the selected comparison, with new categories last', () => {
    const categories = [
      category('small', 0.01),
      category('new-small', null, 100),
      category('big-drop', -0.05),
      category('new-big', null, 500),
      category('big-rise', 0.03),
    ];
    const rows = getCategoryRows(
      {
        'previous-period': result([]),
        'previous-year': result(categories),
      },
      'previous-year',
    );
    expect(rows.map(row => row.category)).toEqual([
      'big-drop',
      'big-rise',
      'small',
      'new-big',
      'new-small',
    ]);
  });
});
