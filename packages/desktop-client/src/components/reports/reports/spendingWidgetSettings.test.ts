import type {
  RuleConditionEntity,
  SpendingWidget,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { calculateSpendingReportTimeRange } from '#components/reports/reportRanges';
import { DEFAULT_SPENDING_AVERAGE_RANGE } from '#components/reports/spendingAverageRange';
import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildSpendingWidgetSettings,
  toComparableSpendingSettings,
} from './spendingWidgetSettings';
import type { SpendingWidgetSettings } from './spendingWidgetSettings';

type Meta = NonNullable<SpendingWidget['meta']>;

const CONDITION = {
  field: 'category',
  op: 'is',
  value: 'cat-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'My spending',
  conditions: [CONDITION],
  conditionsOp: 'or',
  compare: '2016-06',
  compareTo: '2016-03',
  averageRange: { mode: 'last-n-months', months: 6 },
  isLive: false,
  mode: 'single-month',
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildSpendingWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  compare: '2016-06',
  compareTo: '2016-03',
  averageRange: { mode: 'last-n-months', months: 6 },
  isLive: false,
  reportMode: 'single-month',
});

// One different value for every setting "Save" writes.
const CHANGES: {
  [K in keyof SpendingWidgetSettings]: SpendingWidgetSettings[K];
} = {
  conditions: [],
  conditionsOp: 'and',
  compare: '2016-07',
  compareTo: '2016-02',
  averageRange: { mode: 'year-to-date' },
  isLive: true,
  mode: 'budget',
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableSpendingSettings(saved),
    current: toComparableSpendingSettings(current),
  });
}

function openedState(meta: Partial<Meta>) {
  // Mirrors how the report fills its state from a saved widget.
  const [compare, compareTo] = calculateSpendingReportTimeRange(meta);
  return buildSpendingWidgetSettings({
    conditions: meta.conditions ?? [],
    conditionsOp: meta.conditionsOp ?? 'and',
    compare,
    compareTo,
    averageRange: meta.averageRange ?? DEFAULT_SPENDING_AVERAGE_RANGE,
    isLive: meta.isLive ?? true,
    reportMode: meta.mode ?? 'single-month',
  });
}

describe('Spending widget settings', () => {
  it('checks exactly the settings "Save" writes', () => {
    expect(Object.keys(UNCHANGED).sort()).toEqual(Object.keys(CHANGES).sort());
  });

  it('is unchanged right after opening the widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
    expect(isModified(SAVED_META, openedState(SAVED_META))).toBe(false);
  });

  it.each(Object.entries(CHANGES))('notices a change to %s', (key, value) => {
    expect(isModified(SAVED_META, { ...UNCHANGED, [key]: value })).toBe(true);
  });

  it('ignores the name, which is saved separately', () => {
    expect(isModified({ ...SAVED_META, name: 'Renamed' }, UNCHANGED)).toBe(
      false,
    );
  });

  it('matches the defaults when nothing is saved', () => {
    expect(isModified(null, openedState({}))).toBe(false);
  });

  it('compares a live budget comparison by its first month only', () => {
    const saved: Partial<Meta> = {
      compare: '2016-06',
      compareTo: '2016-05',
      isLive: true,
      mode: 'budget',
    };
    // Opening a live budget comparison sets both months to the first one.
    expect(isModified(saved, openedState(saved))).toBe(false);
  });

  it('notices a change to the second month of a live single-month comparison', () => {
    const saved: Partial<Meta> = {
      compare: '2016-06',
      compareTo: '2016-03',
      isLive: true,
      mode: 'single-month',
    };
    expect(
      isModified(saved, { ...openedState(saved), compareTo: '2016-04' }),
    ).toBe(true);
  });

  it('treats an unsupported average range as the default', () => {
    expect(
      isModified(
        {
          ...SAVED_META,
          averageRange: { mode: 'last-n-months', months: 5 as 6 },
        },
        { ...UNCHANGED, averageRange: DEFAULT_SPENDING_AVERAGE_RANGE },
      ),
    ).toBe(false);
  });
});
