import type {
  AgeOfMoneyWidget,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildAgeOfMoneyWidgetSettings,
  toComparableAgeOfMoneySettings,
} from './ageOfMoneyWidgetSettings';
import type { AgeOfMoneyWidgetSettings } from './ageOfMoneyWidgetSettings';

type Meta = NonNullable<AgeOfMoneyWidget['meta']>;

const CONDITION = {
  field: 'account',
  op: 'is',
  value: 'acct-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'My age of money',
  conditions: [CONDITION],
  conditionsOp: 'or',
  timeFrame: { start: '2016-01', end: '2016-06', mode: 'static' },
  granularity: 'weekly',
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildAgeOfMoneyWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  start: '2016-01',
  end: '2016-06',
  mode: 'static',
  granularity: 'weekly',
});

// One different value for every setting "Save widget" writes.
const CHANGES: {
  [K in keyof AgeOfMoneyWidgetSettings]: AgeOfMoneyWidgetSettings[K];
} = {
  conditions: [],
  conditionsOp: 'and',
  timeFrame: { start: '2015-12', end: '2016-06', mode: 'static' },
  granularity: 'daily',
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableAgeOfMoneySettings(saved),
    current: toComparableAgeOfMoneySettings(current),
  });
}

describe('Age of Money widget settings', () => {
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
    const defaults = buildAgeOfMoneyWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      start: '2016-08',
      end: '2017-01',
      mode: 'sliding-window',
      granularity: 'monthly',
    });
    expect(isModified(null, defaults)).toBe(false);
  });
});
