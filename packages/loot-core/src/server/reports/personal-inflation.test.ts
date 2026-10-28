import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as db from '#server/db';

import {
  getPersonalInflation,
  getPersonalInflationSeries,
} from './personal-inflation';

beforeEach(global.emptyDatabase());
afterEach(() => {
  global.currentMonth = null;
});

// `openedOn` is the starting balance date, i.e. where the budget's history
// begins.
async function setupDatabase({
  openedOn = '2023-01-01',
}: { openedOn?: string | null } = {}) {
  await db.insertAccount({ id: 'checking', name: 'Checking' });
  await db.insertAccount({ id: 'brokerage', name: 'Brokerage', offbudget: 1 });

  await db.insertCategoryGroup({ id: 'income', name: 'Income', is_income: 1 });
  await db.insertCategory({
    id: 'salary',
    name: 'Salary',
    cat_group: 'income',
    is_income: 1,
  });

  await db.insertCategoryGroup({ id: 'bills', name: 'Bills', is_income: 0 });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'bills',
  });
  await db.insertCategory({ id: 'rent', name: 'Rent', cat_group: 'bills' });
  await db.insertCategory({
    id: 'old',
    name: 'Old',
    cat_group: 'bills',
    hidden: 1,
  });

  await db.insertCategoryGroup({
    id: 'archive',
    name: 'Archive',
    is_income: 0,
    hidden: 1,
  });
  await db.insertCategory({
    id: 'archived',
    name: 'Archived',
    cat_group: 'archive',
  });

  if (openedOn) {
    await addTransaction(openedOn, 100000, 'salary');
  }
}

let nextId = 0;
function addTransaction(
  date: string,
  amount: number,
  category: string | null,
  account = 'checking',
) {
  return db.insertTransaction({
    id: `tx${nextId++}`,
    date,
    account,
    amount,
    category,
  });
}

describe('getPersonalInflation', () => {
  it('compares on-budget expense spending against the previous year', async () => {
    await setupDatabase();
    global.currentMonth = '2026-01';

    await addTransaction('2024-06-10', -20000, 'groceries');
    await addTransaction('2024-06-01', -80000, 'rent');
    await addTransaction('2025-06-10', -22400, 'groceries');
    await addTransaction('2025-06-01', -80000, 'rent');

    // None of these count towards spending
    await addTransaction('2024-06-15', 500000, 'salary');
    await addTransaction('2025-06-15', 900000, 'salary');
    await addTransaction('2025-06-20', -70000, 'groceries', 'brokerage');
    await addTransaction('2025-06-21', -5000, null);
    await addTransaction('2024-06-22', -1000, 'old');
    await addTransaction('2025-06-22', -9000, 'old');
    await addTransaction('2025-06-23', -9000, 'archived');

    const result = await getPersonalInflation({
      start: '2025-01',
      end: '2025-12',
    });

    expect(result.prior).toEqual({ start: '2024-01', end: '2024-12' });
    expect(result.priorTotal).toBe(100000);
    expect(result.currentTotal).toBe(102400);
    expect(result.rate).toBeCloseTo(0.024);
    expect(result.isPartial).toBe(false);
    expect(result.categories.map(c => c.category).sort()).toEqual([
      'groceries',
      'rent',
    ]);
  });

  it('includes hidden categories when asked', async () => {
    await setupDatabase();

    await addTransaction('2024-06-22', -1000, 'old');
    await addTransaction('2025-06-22', -3000, 'old');
    await addTransaction('2025-06-23', -9000, 'archived');

    const result = await getPersonalInflation({
      start: '2025-06',
      end: '2025-06',
      includeHidden: true,
    });

    expect(result.categories.map(c => c.category).sort()).toEqual([
      'archived',
      'old',
    ]);
    expect(result.rate).toBeCloseTo(2);
  });

  it('supports short windows against the previous period', async () => {
    await setupDatabase();

    await addTransaction('2025-04-05', -10000, 'groceries');
    await addTransaction('2025-06-30', -5000, 'groceries');
    await addTransaction('2025-07-01', -9000, 'groceries');
    await addTransaction('2025-09-30', -9000, 'groceries');

    const result = await getPersonalInflation({
      start: '2025-07',
      end: '2025-09',
      comparison: 'previous-period',
    });

    expect(result.prior).toEqual({ start: '2025-04', end: '2025-06' });
    expect(result.priorTotal).toBe(15000);
    expect(result.currentTotal).toBe(18000);
    expect(result.rate).toBeCloseTo(0.2);
  });

  it('flags periods that include the current month as partial', async () => {
    await setupDatabase();
    global.currentMonth = '2025-09';

    const result = await getPersonalInflation({
      start: '2025-07',
      end: '2025-09',
    });
    expect(result.isPartial).toBe(true);
  });

  it('flags comparisons that start before the budget history', async () => {
    await setupDatabase({ openedOn: '2024-03-15' });

    await addTransaction('2024-06-10', -10000, 'groceries');
    await addTransaction('2025-06-10', -12000, 'groceries');

    const result = await getPersonalInflation({
      start: '2025-01',
      end: '2025-12',
    });
    expect(result.hasInsufficientHistory).toBe(true);
    expect(result.rate).toBeNull();
    expect(result.categories[0]).toMatchObject({
      prior: 10000,
      current: 12000,
      rate: null,
      contribution: null,
    });

    // A comparison that starts within the history is fine
    const recent = await getPersonalInflation({
      start: '2025-03',
      end: '2025-12',
    });
    expect(recent.hasInsufficientHistory).toBe(false);
  });

  it('flags every comparison when there are no transactions', async () => {
    await setupDatabase({ openedOn: null });

    const result = await getPersonalInflation({
      start: '2025-01',
      end: '2025-12',
    });
    expect(result.hasInsufficientHistory).toBe(true);
    expect(result.rate).toBeNull();
  });

  it('ignores off-budget accounts when finding where history starts', async () => {
    await setupDatabase({ openedOn: '2025-01-01' });
    await addTransaction('2020-01-01', 500000, null, 'brokerage');

    const result = await getPersonalInflation({
      start: '2025-06',
      end: '2025-06',
    });
    expect(result.hasInsufficientHistory).toBe(true);
  });

  it('rejects invalid periods', async () => {
    await setupDatabase();

    await expect(
      getPersonalInflation({ start: '2025-09', end: '2025-07' }),
    ).rejects.toThrow('Start month must not be after end month');
    await expect(
      getPersonalInflation({ start: '2025-9', end: '2025-10' }),
    ).rejects.toThrow('YYYY-MM');
  });
});

describe('getPersonalInflationSeries', () => {
  it('returns a trailing window for each month', async () => {
    await setupDatabase();

    await addTransaction('2024-01-10', -10000, 'groceries');
    await addTransaction('2024-02-10', -10000, 'groceries');
    await addTransaction('2025-01-10', -11000, 'groceries');
    await addTransaction('2025-02-10', -13000, 'groceries');

    const series = await getPersonalInflationSeries({
      start: '2025-01',
      end: '2025-02',
      windowMonths: 1,
    });

    expect(series.map(s => s.current)).toEqual([
      { start: '2025-01', end: '2025-01' },
      { start: '2025-02', end: '2025-02' },
    ]);
    expect(series[0].rate).toBeCloseTo(0.1);
    expect(series[1].rate).toBeCloseTo(0.3);
  });

  it('flags only the points whose comparison predates the history', async () => {
    await setupDatabase({ openedOn: '2024-02-01' });

    await addTransaction('2024-02-10', -10000, 'groceries');
    await addTransaction('2025-01-10', -11000, 'groceries');
    await addTransaction('2025-02-10', -13000, 'groceries');

    const series = await getPersonalInflationSeries({
      start: '2025-01',
      end: '2025-02',
      windowMonths: 1,
    });

    expect(series.map(s => s.hasInsufficientHistory)).toEqual([true, false]);
    expect(series[0].rate).toBeNull();
    expect(series[1].rate).toBeCloseTo(0.3);
  });

  it('rejects a window shorter than one month', async () => {
    await setupDatabase();

    await expect(
      getPersonalInflationSeries({
        start: '2025-01',
        end: '2025-02',
        windowMonths: 0,
      }),
    ).rejects.toThrow('windowMonths');
  });
});
