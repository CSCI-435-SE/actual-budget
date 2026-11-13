import type {
  RuleConditionEntity,
  SummaryContent,
  SummaryWidget,
} from '@actual-app/core/types/models';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  buildSummaryWidgetSettings,
  parseSummaryContent,
  toComparableSummarySettings,
} from './summaryWidgetSettings';
import type { SummaryWidgetSettings } from './summaryWidgetSettings';

type Meta = NonNullable<SummaryWidget['meta']>;

const CONDITION = {
  field: 'category',
  op: 'is',
  value: 'cat-1',
} as RuleConditionEntity;

const DIVISOR = {
  field: 'category',
  op: 'is',
  value: 'cat-2',
} as RuleConditionEntity;

const PERCENTAGE: SummaryContent = {
  type: 'percentage',
  divisorConditions: [DIVISOR],
  divisorConditionsOp: 'and',
  divisorAllTimeDateRange: true,
};

const SAVED_META: Meta = {
  name: 'My summary',
  conditions: [CONDITION],
  conditionsOp: 'or',
  timeFrame: { start: '2016-01-01', end: '2016-06-30', mode: 'static' },
  content: JSON.stringify(PERCENTAGE),
};

// What the report holds after opening SAVED_META.
const UNCHANGED = buildSummaryWidgetSettings({
  conditions: [CONDITION],
  conditionsOp: 'or',
  start: '2016-01-01',
  end: '2016-06-30',
  mode: 'static',
  content: PERCENTAGE,
});

// One different value for every setting "Save widget" writes.
const CHANGES: {
  [K in keyof SummaryWidgetSettings]: SummaryWidgetSettings[K];
} = {
  conditions: [],
  conditionsOp: 'and',
  timeFrame: { start: '2016-01-01', end: '2016-05-31', mode: 'static' },
  content: JSON.stringify({ ...PERCENTAGE, divisorAllTimeDateRange: false }),
};

function isModified(saved: Partial<Meta> | null, current: Partial<Meta>) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableSummarySettings(saved),
    current: toComparableSummarySettings(current),
  });
}

describe('Summary widget settings', () => {
  it('checks exactly the settings "Save widget" writes', () => {
    expect(Object.keys(UNCHANGED).sort()).toEqual(Object.keys(CHANGES).sort());
  });

  it('is unchanged right after opening the widget', () => {
    expect(isModified(SAVED_META, UNCHANGED)).toBe(false);
  });

  it.each(Object.entries(CHANGES))('notices a change to %s', (key, value) => {
    expect(isModified(SAVED_META, { ...UNCHANGED, [key]: value })).toBe(true);
  });

  it('notices a change to the divisor filters', () => {
    expect(
      isModified(SAVED_META, {
        ...UNCHANGED,
        content: JSON.stringify({ ...PERCENTAGE, divisorConditions: [] }),
      }),
    ).toBe(true);
  });

  it('notices a change to how the total is shown', () => {
    expect(
      isModified(SAVED_META, {
        ...UNCHANGED,
        content: JSON.stringify({ type: 'avgPerMonth' }),
      }),
    ).toBe(true);
  });

  it('ignores the name, which is saved separately', () => {
    expect(isModified({ ...SAVED_META, name: 'Renamed' }, UNCHANGED)).toBe(
      false,
    );
  });

  it('compares the content, not how its JSON is written', () => {
    // The report fills in the divisor fields when it opens, and key order can
    // differ from what was saved.
    const saved = { content: '{"type":"sum"}' };
    const opened = buildSummaryWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      start: '2015-03-01',
      end: '2017-01-15',
      mode: 'full',
      content: {
        divisorConditions: [],
        divisorConditionsOp: 'and',
        type: 'sum',
      } as SummaryContent,
    });
    expect(isModified(saved, opened)).toBe(false);
  });

  it('matches the defaults when nothing is saved', () => {
    const defaults = buildSummaryWidgetSettings({
      conditions: [],
      conditionsOp: 'and',
      start: '2015-03-01',
      end: '2017-01-15',
      mode: 'full',
      content: parseSummaryContent(undefined),
    });
    expect(isModified(null, defaults)).toBe(false);
  });

  it('notices a switch between two kinds of totals', () => {
    expect(
      isModified(
        { ...SAVED_META, content: JSON.stringify({ type: 'sum' }) },
        { ...UNCHANGED, content: JSON.stringify({ type: 'avgPerMonth' }) },
      ),
    ).toBe(true);
  });

  it('ignores divisor filters when the total is not a percentage', () => {
    // The report resets the divisor filters when it opens a non-percentage.
    expect(
      isModified(
        {
          ...SAVED_META,
          content: JSON.stringify({
            type: 'sum',
            divisorConditions: [DIVISOR],
          }),
        },
        {
          ...UNCHANGED,
          content: JSON.stringify({ type: 'sum', divisorConditions: [] }),
        },
      ),
    ).toBe(false);
  });

  it('treats content without a type as a sum', () => {
    expect(
      isModified(
        { ...SAVED_META, content: '{}' },
        { ...UNCHANGED, content: JSON.stringify({ type: 'sum' }) },
      ),
    ).toBe(false);
  });

  it('treats a missing "All time divisor" setting as off', () => {
    const { divisorAllTimeDateRange: _, ...withoutAllTime } = PERCENTAGE as {
      divisorAllTimeDateRange?: boolean;
    };
    expect(
      isModified(
        { ...SAVED_META, content: JSON.stringify(withoutAllTime) },
        {
          ...UNCHANGED,
          content: JSON.stringify({
            ...PERCENTAGE,
            divisorAllTimeDateRange: false,
          }),
        },
      ),
    ).toBe(false);
  });
});

describe('parseSummaryContent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to a sum, without logging, when nothing is saved', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(parseSummaryContent(undefined)).toMatchObject({ type: 'sum' });
    expect(parseSummaryContent('')).toMatchObject({ type: 'sum' });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('falls back to a sum and logs the error when the saved JSON is invalid', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(parseSummaryContent('{not json')).toMatchObject({ type: 'sum' });
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to parse widget meta content:',
      expect.any(SyntaxError),
    );
  });
});
