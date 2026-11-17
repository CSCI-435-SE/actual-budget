import type { CrossoverWidget } from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  adjustCrossoverRange,
  buildCrossoverWidgetSettings,
  resolveCrossoverTimeFrame,
  toComparableCrossoverSettings,
} from './crossoverWidgetSettings';
import type {
  CrossoverComparisonContext,
  CrossoverWidgetSettings,
} from './crossoverWidgetSettings';

type Meta = NonNullable<CrossoverWidget['meta']>;

// In test mode, monthUtils.currentMonth() returns '2017-01'.
const CONTEXT: CrossoverComparisonContext = {
  categories: [
    { id: 'food', is_income: false },
    { id: 'rent', is_income: false },
    { id: 'salary', is_income: true },
  ],
  accounts: [{ id: 'checking' }, { id: 'savings' }],
  range: {
    earliestMonth: '2014-01',
    latestMonth: '2016-12',
    latestTransaction: '2016-12-31',
  },
};

const SAVED_META: Meta = {
  name: 'Retirement',
  expenseCategoryIds: ['rent', 'food'],
  incomeAccountIds: ['savings'],
  safeWithdrawalRate: 0.035,
  estimatedReturn: 0.05,
  expectedContribution: 100000,
  projectionType: 'median',
  expenseAdjustmentFactor: 1.2,
  showHiddenCategories: true,
  timeFrame: { start: '2015-01', end: '2016-06', mode: 'static' },
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildCrossoverWidgetSettings({
  selectedExpenseCategories: [{ id: 'food' }, { id: 'rent' }],
  selectedIncomeAccountIds: ['savings'],
  swr: 0.035,
  useCustomGrowth: true,
  estimatedReturn: 0.05,
  expectedContribution: 100000,
  projectionType: 'median',
  expenseAdjustmentFactor: 1.2,
  showHiddenCategories: true,
  start: '2015-01',
  end: '2016-06',
  mode: 'static',
});

// One different value for every setting "Save widget" writes.
const CHANGES: {
  [K in keyof CrossoverWidgetSettings]: CrossoverWidgetSettings[K];
} = {
  expenseCategoryIds: ['food'],
  incomeAccountIds: ['checking', 'savings'],
  safeWithdrawalRate: 0.04,
  estimatedReturn: 0.06,
  expectedContribution: 0,
  projectionType: 'hampel',
  expenseAdjustmentFactor: 1,
  showHiddenCategories: false,
  timeFrame: { start: '2015-02', end: '2016-06', mode: 'static' },
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableCrossoverSettings(saved, CONTEXT),
    current: toComparableCrossoverSettings(current, CONTEXT),
  });
}

describe('Crossover widget settings', () => {
  it('checks exactly the settings "Save widget" writes', () => {
    expect(Object.keys(UNCHANGED).sort()).toEqual(Object.keys(CHANGES).sort());
  });

  it('is unchanged right after opening the widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
  });

  it.each(Object.entries(CHANGES))('notices a change to %s', (key, value) => {
    expect(isModified(SAVED_META, { ...UNCHANGED, [key]: value })).toBe(true);
  });

  it('notices turning custom growth off', () => {
    const withoutGrowth = buildCrossoverWidgetSettings({
      selectedExpenseCategories: [{ id: 'food' }, { id: 'rent' }],
      selectedIncomeAccountIds: ['savings'],
      swr: 0.035,
      useCustomGrowth: false,
      estimatedReturn: 0.05,
      expectedContribution: 100000,
      projectionType: 'median',
      expenseAdjustmentFactor: 1.2,
      showHiddenCategories: true,
      start: '2015-01',
      end: '2016-06',
      mode: 'static',
    });
    expect(isModified(SAVED_META, withoutGrowth)).toBe(true);
  });

  it('ignores the name, which is saved separately', () => {
    expect(isModified({ ...SAVED_META, name: 'Renamed' }, UNCHANGED)).toBe(
      false,
    );
  });

  it('ignores saved categories that no longer exist', () => {
    expect(
      isModified(
        { ...SAVED_META, expenseCategoryIds: ['food', 'rent', 'deleted'] },
        UNCHANGED,
      ),
    ).toBe(false);
  });

  it('matches the defaults when nothing is saved', () => {
    if (!CONTEXT.range) throw new Error('missing range');
    const { start, end, mode } = resolveCrossoverTimeFrame(
      undefined,
      CONTEXT.range,
    );
    const defaults = buildCrossoverWidgetSettings({
      selectedExpenseCategories: [{ id: 'food' }, { id: 'rent' }],
      selectedIncomeAccountIds: ['checking', 'savings'],
      swr: 0.04,
      useCustomGrowth: false,
      estimatedReturn: null,
      expectedContribution: null,
      projectionType: 'hampel',
      expenseAdjustmentFactor: 1,
      showHiddenCategories: false,
      start,
      end,
      mode,
    });
    expect(isModified(null, defaults)).toBe(false);
  });

  it('does not flag a sliding window the report moved back a month', () => {
    if (!CONTEXT.range) throw new Error('missing range');
    const savedTimeFrame = {
      start: '2015-07',
      end: '2016-06',
      mode: 'sliding-window' as const,
    };
    const opened = resolveCrossoverTimeFrame(savedTimeFrame, CONTEXT.range);
    expect(opened).toEqual({
      start: '2016-01',
      end: '2016-12',
      mode: 'sliding-window',
    });
    expect(
      isModified(
        { ...SAVED_META, timeFrame: savedTimeFrame },
        { ...UNCHANGED, timeFrame: opened },
      ),
    ).toBe(false);
  });

  it('does not flag a range the report clamped to the months with data', () => {
    if (!CONTEXT.range) throw new Error('missing range');
    const savedTimeFrame = {
      start: '2010-01',
      end: '2016-06',
      mode: 'static' as const,
    };
    const opened = resolveCrossoverTimeFrame(savedTimeFrame, CONTEXT.range);
    expect(opened.start).toBe('2014-01');
    expect(
      isModified(
        { ...SAVED_META, timeFrame: savedTimeFrame },
        { ...UNCHANGED, timeFrame: opened },
      ),
    ).toBe(false);
  });
});

describe('Crossover widget settings, more cases', () => {
  it('ignores the order of the selected income accounts', () => {
    expect(
      isModified(
        { ...SAVED_META, incomeAccountIds: ['savings', 'checking'] },
        { ...UNCHANGED, incomeAccountIds: ['checking', 'savings'] },
      ),
    ).toBe(false);
  });

  it('opens a widget without a saved range on all time', () => {
    if (!CONTEXT.range) throw new Error('missing range');
    expect(resolveCrossoverTimeFrame(undefined, CONTEXT.range)).toEqual({
      start: '2014-01',
      end: '2016-12',
      mode: 'full',
    });
  });

  it('can compare before the months with data have loaded', () => {
    const withoutRange = { ...CONTEXT, range: undefined };
    expect(toComparableCrossoverSettings(null, withoutRange).timeFrame).toEqual(
      {
        mode: 'full',
      },
    );
  });
});

describe('adjustCrossoverRange', () => {
  it('moves a sliding window back to end last month', () => {
    expect(
      adjustCrossoverRange(
        '2016-07',
        '2017-01',
        'sliding-window',
        '2014-01',
        '2016-12',
      ),
    ).toEqual(['2016-06', '2016-12']);
  });

  it('spans every month with data for all time', () => {
    expect(
      adjustCrossoverRange('2010-01', '2011-01', 'full', '2014-01', '2016-12'),
    ).toEqual(['2014-01', '2016-12']);
  });

  it('clamps a fixed range to the months with data', () => {
    expect(
      adjustCrossoverRange(
        '2013-06',
        '2017-03',
        'static',
        '2014-01',
        '2016-12',
      ),
    ).toEqual(['2014-01', '2016-12']);
  });

  it('never ends a range before it starts', () => {
    expect(
      adjustCrossoverRange(
        '2016-05',
        '2016-03',
        'static',
        '2014-01',
        '2016-12',
      ),
    ).toEqual(['2016-05', '2016-05']);
  });
});
