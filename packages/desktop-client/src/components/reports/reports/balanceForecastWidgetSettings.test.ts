import * as monthUtils from '@actual-app/core/shared/months';
import type {
  BalanceForecastWidget,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildBalanceForecastWidgetSettings,
  getBalanceForecastSource,
  getInitialBalanceForecastTimeFrame,
  toComparableBalanceForecastSettings,
} from './balanceForecastWidgetSettings';

type Meta = NonNullable<BalanceForecastWidget['meta']>;
type BudgetType = 'envelope' | 'tracking';

const CONDITION = {
  field: 'account',
  op: 'is',
  value: 'acct-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'Checking forecast',
  accounts: ['acct-1'],
  conditions: [CONDITION],
  conditionsOp: 'or',
  startDate: '2025-01',
  endDate: '2025-12',
  granularity: 'Daily',
  source: 'schedules',
  timeFrame: { start: '2025-01', end: '2025-12', mode: 'static' },
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildBalanceForecastWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  start: '2025-01',
  end: '2025-12',
  mode: 'static',
  granularity: 'Daily',
  source: 'schedules',
});

function isModified(
  saved: Partial<Meta> | null,
  current: Partial<Meta>,
  budgetType: BudgetType = 'tracking',
) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableBalanceForecastSettings(saved, { budgetType }),
    current: toComparableBalanceForecastSettings(current, { budgetType }),
  });
}

describe('Balance Forecast widget settings', () => {
  it('is not modified when the settings match the saved widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
  });

  it.each([
    ['conditions', { conditions: [] }],
    ['conditionsOp', { conditionsOp: 'and' }],
    ['granularity', { granularity: 'Monthly' }],
    ['source', { source: 'tracking-budget', granularity: 'Monthly' }],
    [
      'timeFrame',
      {
        startDate: '2025-02',
        timeFrame: { start: '2025-02', end: '2025-12', mode: 'static' },
      },
    ],
  ] as Array<[string, Partial<Meta>]>)(
    'is modified when %s changes',
    (_, change) => {
      expect(isModified(SAVED_META, { ...UNCHANGED, ...change })).toBe(true);
    },
  );

  it('writes the legacy date fields alongside the time frame', () => {
    expect(UNCHANGED).toMatchObject({
      startDate: '2025-01',
      endDate: '2025-12',
      timeFrame: { start: '2025-01', end: '2025-12', mode: 'static' },
    });
  });

  it('opens older widgets from their legacy date fields', () => {
    const legacy: Meta = { startDate: '2024-03', endDate: '2024-09' };
    expect(getInitialBalanceForecastTimeFrame(legacy)).toEqual({
      start: '2024-03',
      end: '2024-09',
      mode: 'static',
    });
    const opened = buildBalanceForecastWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      start: '2024-03',
      end: '2024-09',
      mode: 'static',
      granularity: 'Monthly',
      source: 'schedules',
    });
    expect(isModified(legacy, opened)).toBe(false);
  });

  it('treats a widget without saved settings as the defaults the report opens with', () => {
    const currentMonth = monthUtils.currentMonth();
    const defaults = buildBalanceForecastWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      start: currentMonth,
      end: monthUtils.addMonths(currentMonth, 11),
      mode: 'static',
      granularity: 'Monthly',
      source: 'schedules',
    });
    expect(isModified(null, defaults)).toBe(false);
    expect(isModified({ name: 'Balance Forecast' }, defaults)).toBe(false);
  });

  it('opens a tracking-budget widget on schedules when the budget is not a tracking budget', () => {
    expect(getBalanceForecastSource('tracking-budget', 'envelope')).toBe(
      'schedules',
    );
    const saved: Meta = { ...SAVED_META, source: 'tracking-budget' };
    expect(isModified(saved, UNCHANGED, 'envelope')).toBe(false);
    expect(isModified(saved, UNCHANGED, 'tracking')).toBe(true);
  });

  it('saves the tracking-budget forecast as monthly', () => {
    const current = buildBalanceForecastWidgetSettings({
      conditions: [CONDITION],
      conditionsOp: 'or',
      start: '2025-01',
      end: '2025-12',
      mode: 'static',
      granularity: 'Daily',
      source: 'tracking-budget',
    });
    expect(current.granularity).toBe('Monthly');
    expect(
      isModified({ ...SAVED_META, source: 'tracking-budget' }, current),
    ).toBe(false);
  });

  describe('when more than one place writes the widget', () => {
    it('keeps the label after renaming, which saves only the name', () => {
      const current = { ...UNCHANGED, granularity: 'Monthly' as const };
      expect(isModified(SAVED_META, current)).toBe(true);

      const afterRename: Meta = { ...SAVED_META, name: 'Renamed' };
      expect(isModified(afterRename, current)).toBe(true);
    });

    it('clears the label once "Save widget" writes the current settings', () => {
      const current = { ...UNCHANGED, granularity: 'Monthly' as const };
      const afterRename: Meta = { ...SAVED_META, name: 'Renamed' };
      const afterSave: Meta = { ...afterRename, ...current };
      expect(isModified(afterSave, current)).toBe(false);

      // A later rename keeps the newly saved settings, so it stays clear.
      const afterSecondRename: Meta = { ...afterSave, name: 'Renamed again' };
      expect(isModified(afterSecondRename, current)).toBe(false);
    });

    it('ignores the selected accounts, which the report never changes', () => {
      expect(isModified({ ...SAVED_META, accounts: [] }, UNCHANGED)).toBe(
        false,
      );
    });
  });
});
