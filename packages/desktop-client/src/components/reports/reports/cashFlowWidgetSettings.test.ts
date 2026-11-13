import type {
  CashFlowWidget,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildCashFlowWidgetSettings,
  toComparableCashFlowSettings,
} from './cashFlowWidgetSettings';
import type { CashFlowWidgetSettings } from './cashFlowWidgetSettings';

type Meta = NonNullable<CashFlowWidget['meta']>;

const CONDITION = {
  field: 'payee',
  op: 'is',
  value: 'payee-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'My cash flow',
  conditions: [CONDITION],
  conditionsOp: 'or',
  timeFrame: { start: '2016-01', end: '2016-06', mode: 'static' },
  showBalance: false,
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildCashFlowWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  start: '2016-01',
  end: '2016-06',
  mode: 'static',
  showBalance: false,
});

// One different value for every setting "Save widget" writes.
const CHANGES: {
  [K in keyof CashFlowWidgetSettings]: CashFlowWidgetSettings[K];
} = {
  conditions: [],
  conditionsOp: 'and',
  timeFrame: { start: '2016-01', end: '2016-06', mode: 'yearToDate' },
  showBalance: true,
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableCashFlowSettings(saved),
    current: toComparableCashFlowSettings(current),
  });
}

describe('Cash Flow widget settings', () => {
  it('checks exactly the settings "Save widget" writes', () => {
    expect(Object.keys(UNCHANGED).sort()).toEqual(Object.keys(CHANGES).sort());
  });

  it('is unchanged right after opening the widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
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
    const defaults = buildCashFlowWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      start: '2017-01',
      end: '2017-01',
      mode: 'sliding-window',
      showBalance: true,
    });
    expect(isModified(null, defaults)).toBe(false);
  });
});
