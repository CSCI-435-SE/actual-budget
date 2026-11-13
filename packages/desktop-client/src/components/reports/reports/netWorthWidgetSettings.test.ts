import type {
  NetWorthWidget,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildNetWorthWidgetSettings,
  toComparableNetWorthSettings,
} from './netWorthWidgetSettings';
import type { NetWorthWidgetSettings } from './netWorthWidgetSettings';

type Meta = NonNullable<NetWorthWidget['meta']>;

const CONDITION = {
  field: 'account',
  op: 'is',
  value: 'acct-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'My net worth',
  conditions: [CONDITION],
  conditionsOp: 'or',
  interval: 'Yearly',
  mode: 'stacked',
  timeFrame: { start: '2016-01', end: '2016-06', mode: 'static' },
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildNetWorthWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  interval: 'Yearly',
  graphMode: 'stacked',
  start: '2016-01',
  end: '2016-06',
  mode: 'static',
});

// One different value for every setting "Save widget" writes.
const CHANGES: {
  [K in keyof NetWorthWidgetSettings]: NetWorthWidgetSettings[K];
} = {
  conditions: [],
  conditionsOp: 'and',
  interval: 'Monthly',
  mode: 'trend',
  timeFrame: { start: '2016-01', end: '2016-07', mode: 'static' },
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableNetWorthSettings(saved),
    current: toComparableNetWorthSettings(current),
  });
}

describe('Net Worth widget settings', () => {
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
    const defaults = buildNetWorthWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      interval: 'Monthly',
      graphMode: 'trend',
      start: '2016-08',
      end: '2017-01',
      mode: 'sliding-window',
    });
    expect(isModified(null, defaults)).toBe(false);
  });

  it('defaults to a weekly interval for last month', () => {
    const lastMonth = buildNetWorthWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      interval: 'Weekly',
      graphMode: 'trend',
      start: '2016-12',
      end: '2016-12',
      mode: 'lastMonth',
    });
    expect(
      isModified(
        { timeFrame: { start: '2016-11', end: '2016-11', mode: 'lastMonth' } },
        lastMonth,
      ),
    ).toBe(false);
  });

  it('does not flag a sliding window saved in an earlier month', () => {
    const reopened = buildNetWorthWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      interval: 'Monthly',
      graphMode: 'trend',
      start: '2016-08',
      end: '2017-01',
      mode: 'sliding-window',
    });
    expect(
      isModified(
        {
          timeFrame: {
            start: '2016-02',
            end: '2016-07',
            mode: 'sliding-window',
          },
        },
        reopened,
      ),
    ).toBe(false);
  });
});
