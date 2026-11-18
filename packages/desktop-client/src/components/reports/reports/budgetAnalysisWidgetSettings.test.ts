import * as monthUtils from '@actual-app/core/shared/months';
import type {
  BudgetAnalysisWidget,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildBudgetAnalysisWidgetSettings,
  toComparableBudgetAnalysisSettings,
} from './budgetAnalysisWidgetSettings';
import type { BudgetAnalysisWidgetSettings } from './budgetAnalysisWidgetSettings';

type Meta = NonNullable<BudgetAnalysisWidget['meta']>;

const CONDITION = {
  field: 'category',
  op: 'is',
  value: 'cat-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'Food budget',
  conditions: [CONDITION],
  conditionsOp: 'or',
  timeFrame: { start: '2024-01', end: '2024-06', mode: 'static' },
  graphType: 'Line',
  showBalance: false,
  balanceOnly: true,
  showHiddenCategories: true,
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildBudgetAnalysisWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  start: '2024-01',
  end: '2024-06',
  mode: 'static',
  graphType: 'Line',
  showBalance: false,
  showCategories: false,
  showHiddenCategories: true,
});

// One different value for every setting "Save widget" writes.
const CHANGES: BudgetAnalysisWidgetSettings = {
  conditions: [],
  conditionsOp: 'and',
  timeFrame: { start: '2024-02', end: '2024-06', mode: 'static' },
  graphType: 'Bar',
  showBalance: true,
  balanceOnly: false,
  showHiddenCategories: false,
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableBudgetAnalysisSettings(saved),
    current: toComparableBudgetAnalysisSettings(current),
  });
}

describe('Budget Analysis widget settings', () => {
  it('is not modified when the settings match the saved widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
  });

  it.each(Object.keys(CHANGES) as Array<keyof BudgetAnalysisWidgetSettings>)(
    'is modified when %s changes',
    key => {
      expect(
        isModified(SAVED_META, { ...UNCHANGED, [key]: CHANGES[key] }),
      ).toBe(true);
    },
  );

  it('saves "Show categories" as its inverse', () => {
    expect(
      buildBudgetAnalysisWidgetSettings({
        conditions: [],
        conditionsOp: 'and',
        start: '2024-01',
        end: '2024-06',
        mode: 'static',
        graphType: 'Bar',
        showBalance: true,
        showCategories: true,
        showHiddenCategories: false,
      }).balanceOnly,
    ).toBe(false);
  });

  it('treats a widget without saved settings as the defaults the report opens with', () => {
    const defaults = buildBudgetAnalysisWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      start: monthUtils.subMonths(monthUtils.currentMonth(), 5),
      end: monthUtils.currentMonth(),
      mode: 'sliding-window',
      graphType: 'Bar',
      showBalance: true,
      showCategories: true,
      showHiddenCategories: false,
    });
    expect(isModified(null, defaults)).toBe(false);
    expect(isModified({ name: 'Budget Analysis' }, defaults)).toBe(false);
  });

  it('keeps the label after a rename that does not save the settings', () => {
    const current = { ...UNCHANGED, graphType: 'Bar' as const };
    const afterRename: Meta = { ...SAVED_META, name: 'Renamed' };
    expect(isModified(afterRename, current)).toBe(true);

    const afterSave: Meta = { ...afterRename, ...current };
    expect(isModified(afterSave, current)).toBe(false);
  });
});
