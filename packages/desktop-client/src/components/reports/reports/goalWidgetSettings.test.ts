import type {
  GoalCardWidget,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildGoalWidgetSettings,
  toComparableGoalSettings,
} from './goalWidgetSettings';
import type { GoalWidgetSettings } from './goalWidgetSettings';

type Meta = NonNullable<GoalCardWidget['meta']>;

const CONDITION = {
  field: 'category',
  op: 'is',
  value: 'cat-1',
} as RuleConditionEntity;

const SAVED_META: Meta = {
  name: 'Emergency fund',
  conditions: [CONDITION],
  conditionsOp: 'or',
  targetAmount: 500000,
  linkedTag: 'savings',
  timeFrame: { start: '2016-01-01', end: '2016-06-30', mode: 'static' },
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildGoalWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  targetAmount: 500000,
  linkedTag: 'savings',
  start: '2016-01-01',
  end: '2016-06-30',
  mode: 'static',
});

// One different value for every setting "Save widget" writes.
const CHANGES: { [K in keyof GoalWidgetSettings]-?: GoalWidgetSettings[K] } = {
  conditions: [],
  conditionsOp: 'and',
  targetAmount: 600000,
  linkedTag: 'vacation',
  timeFrame: { start: '2016-02-01', end: '2016-06-30', mode: 'static' },
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableGoalSettings(saved),
    current: toComparableGoalSettings(current),
  });
}

describe('Goal widget settings', () => {
  it('checks exactly the settings "Save widget" writes', () => {
    expect(Object.keys(UNCHANGED).sort()).toEqual(Object.keys(CHANGES).sort());
  });

  it('is unchanged right after opening the widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
  });

  it.each(Object.entries(CHANGES))('notices a change to %s', (key, value) => {
    expect(isModified(SAVED_META, { ...UNCHANGED, [key]: value })).toBe(true);
  });

  it('notices when the linked tag is cleared', () => {
    expect(isModified(SAVED_META, { ...UNCHANGED, linkedTag: undefined })).toBe(
      true,
    );
  });

  it('ignores the name, which the title editor saves right away', () => {
    expect(isModified({ ...SAVED_META, name: 'Renamed' }, UNCHANGED)).toBe(
      false,
    );
  });

  it('matches the defaults when nothing is saved', () => {
    const defaults = buildGoalWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      targetAmount: 0,
      linkedTag: undefined,
      start: '2015-03-01',
      end: '2017-01-15',
      mode: 'full',
    });
    expect(isModified(null, defaults)).toBe(false);
  });
});
