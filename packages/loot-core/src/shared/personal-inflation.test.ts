import { describe, expect, it } from 'vitest';

import {
  calculatePersonalInflation,
  getComparisonPeriod,
  getPeriodLength,
  getTrailingPeriods,
} from './personal-inflation';
import type { CategoryMonthAmount } from './personal-inflation';

const yearNow = { start: '2025-01', end: '2025-12' };
const yearBefore = { start: '2024-01', end: '2024-12' };

function spend(
  category: string,
  month: string,
  amount: number,
): CategoryMonthAmount {
  // Spending is stored as negative amounts
  return { category, month, amount: -amount };
}

describe('getComparisonPeriod', () => {
  it('shifts back by the period length for previous-period', () => {
    expect(
      getComparisonPeriod(
        { start: '2025-07', end: '2025-09' },
        'previous-period',
      ),
    ).toEqual({ start: '2025-04', end: '2025-06' });
    expect(
      getComparisonPeriod(
        { start: '2025-03', end: '2025-03' },
        'previous-period',
      ),
    ).toEqual({ start: '2025-02', end: '2025-02' });
  });

  it('shifts back a year for previous-year', () => {
    expect(
      getComparisonPeriod(
        { start: '2025-07', end: '2025-09' },
        'previous-year',
      ),
    ).toEqual({ start: '2024-07', end: '2024-09' });
  });
});

describe('getPeriodLength', () => {
  it('counts months inclusively', () => {
    expect(getPeriodLength({ start: '2025-01', end: '2025-01' })).toBe(1);
    expect(getPeriodLength({ start: '2024-11', end: '2025-02' })).toBe(4);
  });
});

describe('getTrailingPeriods', () => {
  it('builds one window ending at each month', () => {
    expect(getTrailingPeriods({ start: '2025-01', end: '2025-03' }, 3)).toEqual(
      [
        { start: '2024-11', end: '2025-01' },
        { start: '2024-12', end: '2025-02' },
        { start: '2025-01', end: '2025-03' },
      ],
    );
  });
});

describe('calculatePersonalInflation', () => {
  it('weights each category by its share of prior spending', () => {
    // Groceries are 20% of spending and rise 12%; rent is 80% and flat
    const result = calculatePersonalInflation(
      [
        spend('groceries', '2024-06', 20000),
        spend('rent', '2024-06', 80000),
        spend('groceries', '2025-06', 22400),
        spend('rent', '2025-06', 80000),
      ],
      ['groceries', 'rent'],
      yearNow,
      yearBefore,
    );

    const groceries = result.categories.find(c => c.category === 'groceries');
    expect(groceries?.weight).toBeCloseTo(0.2);
    expect(groceries?.rate).toBeCloseTo(0.12);
    expect(groceries?.contribution).toBeCloseTo(0.024);
    expect(result.rate).toBeCloseTo(0.024);
    expect(result.priorTotal).toBe(100000);
    expect(result.currentTotal).toBe(102400);
  });

  it('gives the same category change less weight when it is a smaller share', () => {
    const result = calculatePersonalInflation(
      [
        spend('groceries', '2024-06', 5000),
        spend('rent', '2024-06', 95000),
        spend('groceries', '2025-06', 5600),
        spend('rent', '2025-06', 95000),
      ],
      ['groceries', 'rent'],
      yearNow,
      yearBefore,
    );
    expect(result.rate).toBeCloseTo(0.006);
  });

  it('sums the category contributions into the overall rate', () => {
    const result = calculatePersonalInflation(
      [
        spend('a', '2024-01', 30000),
        spend('b', '2024-02', 50000),
        spend('c', '2024-03', 20000),
        spend('a', '2025-01', 36000),
        spend('b', '2025-02', 45000),
        spend('c', '2025-03', 30000),
      ],
      ['a', 'b', 'c'],
      yearNow,
      yearBefore,
    );
    const total = result.categories.reduce(
      (sum, c) => sum + (c.contribution ?? 0),
      0,
    );
    expect(result.rate).toBeCloseTo(total);
    expect(result.rate).toBeCloseTo((111000 - 100000) / 100000);
  });

  it('sums every month in each period', () => {
    const result = calculatePersonalInflation(
      [
        spend('a', '2024-01', 1000),
        spend('a', '2024-12', 1000),
        spend('a', '2025-01', 1500),
        spend('a', '2025-12', 1500),
        // Outside both periods
        spend('a', '2023-12', 99999),
        spend('a', '2026-01', 99999),
      ],
      ['a'],
      yearNow,
      yearBefore,
    );
    expect(result.priorTotal).toBe(2000);
    expect(result.currentTotal).toBe(3000);
    expect(result.rate).toBeCloseTo(0.5);
  });

  it('gives new categories no rate and leaves them out of the overall rate', () => {
    const result = calculatePersonalInflation(
      [
        spend('a', '2024-05', 10000),
        spend('a', '2025-05', 11000),
        spend('new', '2025-05', 5000),
      ],
      ['a', 'new'],
      yearNow,
      yearBefore,
    );
    const newCategory = result.categories.find(c => c.category === 'new');
    expect(newCategory).toMatchObject({
      prior: 0,
      current: 5000,
      weight: 0,
      rate: null,
      contribution: null,
    });
    expect(result.rate).toBeCloseTo(0.1);
    expect(result.currentTotal).toBe(16000);
  });

  it('reports -100% for a category with no current spending', () => {
    const result = calculatePersonalInflation(
      [spend('a', '2024-05', 10000), spend('b', '2024-05', 10000)],
      ['a', 'b'],
      yearNow,
      yearBefore,
    );
    expect(result.categories.every(c => c.rate === -1)).toBe(true);
    expect(result.rate).toBeCloseTo(-1);
  });

  it('has no overall rate without prior spending', () => {
    const result = calculatePersonalInflation(
      [spend('a', '2025-05', 10000)],
      ['a'],
      yearNow,
      yearBefore,
    );
    expect(result.rate).toBeNull();

    const empty = calculatePersonalInflation([], ['a'], yearNow, yearBefore);
    expect(empty.rate).toBeNull();
    expect(empty.categories).toEqual([]);
  });

  it('treats a period where refunds outweigh spending as no spending', () => {
    const result = calculatePersonalInflation(
      [
        spend('a', '2024-05', 10000),
        // Net refund in the prior period
        spend('refunds', '2024-05', -2000),
        spend('a', '2025-05', 10000),
        spend('refunds', '2025-05', 1000),
      ],
      ['a', 'refunds'],
      yearNow,
      yearBefore,
    );
    expect(result.priorTotal).toBe(10000);
    expect(
      result.categories.find(c => c.category === 'refunds')?.rate,
    ).toBeNull();
    expect(result.rate).toBeCloseTo(0);
  });

  it('ignores categories that are not in the basket', () => {
    const result = calculatePersonalInflation(
      [
        spend('a', '2024-05', 10000),
        spend('a', '2025-05', 12000),
        spend('other', '2024-05', 50000),
        spend('other', '2025-05', 0),
      ],
      ['a'],
      yearNow,
      yearBefore,
    );
    expect(result.categories.map(c => c.category)).toEqual(['a']);
    expect(result.rate).toBeCloseTo(0.2);
  });

  it('leaves out rates when the prior period predates the history', () => {
    const amounts = [
      spend('a', '2024-06', 10000),
      spend('a', '2025-06', 12000),
    ];

    const result = calculatePersonalInflation(
      amounts,
      ['a'],
      yearNow,
      yearBefore,
      '2024-03',
    );
    expect(result.hasInsufficientHistory).toBe(true);
    expect(result.rate).toBeNull();
    expect(result.priorTotal).toBe(10000);
    expect(result.categories[0]).toMatchObject({
      rate: null,
      contribution: null,
    });

    // History starting exactly at the prior period is enough
    const covered = calculatePersonalInflation(
      amounts,
      ['a'],
      yearNow,
      yearBefore,
      '2024-01',
    );
    expect(covered.hasInsufficientHistory).toBe(false);
    expect(covered.rate).toBeCloseTo(0.2);
  });

  it('treats having no history at all as insufficient', () => {
    const result = calculatePersonalInflation(
      [],
      ['a'],
      yearNow,
      yearBefore,
      null,
    );
    expect(result.hasInsufficientHistory).toBe(true);
  });

  it('skips the history check when no start is given', () => {
    const result = calculatePersonalInflation(
      [spend('a', '2024-06', 10000), spend('a', '2025-06', 12000)],
      ['a'],
      yearNow,
      yearBefore,
    );
    expect(result.hasInsufficientHistory).toBe(false);
  });

  it('works for a single month against the previous month', () => {
    const current = { start: '2025-03', end: '2025-03' };
    const result = calculatePersonalInflation(
      [
        spend('a', '2025-02', 10000),
        spend('a', '2025-03', 9000),
        spend('a', '2024-03', 50000),
      ],
      ['a'],
      current,
      getComparisonPeriod(current, 'previous-period'),
    );
    expect(result.prior).toEqual({ start: '2025-02', end: '2025-02' });
    expect(result.rate).toBeCloseTo(-0.1);
  });
});
