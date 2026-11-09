import type {
  CalendarWidget,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildCalendarWidgetSettings,
  toComparableCalendarSettings,
} from './calendarWidgetSettings';
import type { CalendarWidgetSettings } from './calendarWidgetSettings';

type Meta = NonNullable<CalendarWidget['meta']>;

const CONDITION = {
  field: 'category',
  op: 'is',
  value: 'cat-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'My calendar',
  conditions: [CONDITION],
  conditionsOp: 'or',
  timeFrame: { start: '2016-01-01', end: '2016-06-30', mode: 'static' },
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildCalendarWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  start: '2016-01-01',
  end: '2016-06-30',
  mode: 'static',
});

// One different value for every setting "Save widget" writes.
const CHANGES: {
  [K in keyof CalendarWidgetSettings]: CalendarWidgetSettings[K];
} = {
  conditions: [],
  conditionsOp: 'and',
  timeFrame: { start: '2016-01-01', end: '2016-06-30', mode: 'full' },
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableCalendarSettings(saved),
    current: toComparableCalendarSettings(current),
  });
}

describe('Calendar widget settings', () => {
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
    const defaults = buildCalendarWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      start: '2015-03-01',
      end: '2017-01-15',
      mode: 'full',
    });
    expect(isModified(null, defaults)).toBe(false);
  });

  it('notices a day filter added by opening a day from the card', () => {
    const dayFilter = {
      field: 'date',
      op: 'is',
      value: '2016-03-04',
    } as RuleConditionEntity;
    expect(
      isModified(SAVED_META, {
        ...UNCHANGED,
        conditions: [CONDITION, dayFilter],
        conditionsOp: 'and',
      }),
    ).toBe(true);
  });
});
