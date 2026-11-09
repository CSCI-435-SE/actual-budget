import type { RuleConditionEntity } from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { calculateTimeRange } from './reportRanges';
import {
  isWidgetModified,
  toComparableConditions,
  toComparableTimeFrame,
} from './widgetModified';

// In test mode, monthUtils.currentMonth() returns '2017-01'.
describe('toComparableTimeFrame', () => {
  it('compares a static range by its dates', () => {
    expect(
      toComparableTimeFrame({
        start: '2016-03',
        end: '2016-05',
        mode: 'static',
      }),
    ).toEqual({ mode: 'static', start: '2016-03', end: '2016-05' });
  });

  it('compares a month sliding window by its width, not its dates', () => {
    const savedLastYear = toComparableTimeFrame({
      start: '2015-08',
      end: '2016-01',
      mode: 'sliding-window',
    });
    const [start, end, mode] = calculateTimeRange({
      start: '2015-08',
      end: '2016-01',
      mode: 'sliding-window',
    });

    expect(savedLastYear).toEqual({
      mode: 'sliding-window',
      shape: 'month',
      width: 5,
    });
    expect(toComparableTimeFrame({ start, end, mode })).toEqual(savedLastYear);
  });

  it('compares a day sliding window by its width in days', () => {
    expect(
      toComparableTimeFrame({
        start: '2016-12-01',
        end: '2016-12-31',
        mode: 'sliding-window',
      }),
    ).toEqual({ mode: 'sliding-window', shape: 'day', width: 30 });
  });

  it('tells month and day sliding windows apart', () => {
    expect(
      toComparableTimeFrame({
        start: '2016-12',
        end: '2017-01',
        mode: 'sliding-window',
      }),
    ).not.toEqual(
      toComparableTimeFrame({
        start: '2016-12-01',
        end: '2017-01-01',
        mode: 'sliding-window',
      }),
    );
  });

  it('treats a window with only one day-shaped bound as month-shaped', () => {
    // Same rule as calculateTimeRange, which only slides by days when both
    // bounds are days.
    expect(
      toComparableTimeFrame({
        start: '2016-12-01',
        end: '2017-01',
        mode: 'sliding-window',
      }),
    ).toEqual({ mode: 'sliding-window', shape: 'month', width: 1 });
  });

  it.each([
    'full',
    'lastMonth',
    'lastYear',
    'yearToDate',
    'priorYearToDate',
    'currentQuarter',
    'previousQuarter',
  ] as const)('compares a %s range by its mode only', mode => {
    expect(
      toComparableTimeFrame({ start: '2014-01', end: '2014-02', mode }),
    ).toEqual(
      toComparableTimeFrame({ start: '2016-06', end: '2017-01', mode }),
    );
  });

  it('uses the default time frame when none is saved', () => {
    expect(toComparableTimeFrame(undefined, { mode: 'full' })).toEqual({
      mode: 'full',
    });
    // Same fallback as calculateTimeRange: a six-month sliding window.
    expect(toComparableTimeFrame(undefined)).toEqual({
      mode: 'sliding-window',
      shape: 'month',
      width: 5,
    });
  });
});

describe('toComparableConditions', () => {
  it('treats missing conditions as no filters joined with "and"', () => {
    expect(toComparableConditions(undefined, undefined)).toEqual({
      conditions: [],
      conditionsOp: 'and',
    });
  });
});

describe('isWidgetModified', () => {
  const condition = {
    field: 'amount',
    op: 'gt',
    value: 100,
  } as RuleConditionEntity;

  it('is false without a widget', () => {
    expect(
      isWidgetModified({
        hasWidget: false,
        isReady: true,
        saved: { a: 1 },
        current: { a: 2 },
      }),
    ).toBe(false);
  });

  it('is false until the report is ready', () => {
    expect(
      isWidgetModified({
        hasWidget: true,
        isReady: false,
        saved: { a: 1 },
        current: { a: 2 },
      }),
    ).toBe(false);
  });

  it('is true when a setting differs', () => {
    expect(
      isWidgetModified({
        hasWidget: true,
        isReady: true,
        saved: { conditions: [] },
        current: { conditions: [condition] },
      }),
    ).toBe(true);
  });

  it('compares settings that are entirely missing', () => {
    expect(
      isWidgetModified({
        hasWidget: true,
        isReady: true,
        saved: undefined,
        current: undefined,
      }),
    ).toBe(false);
    expect(
      isWidgetModified({
        hasWidget: true,
        isReady: true,
        saved: undefined,
        current: { a: 1 },
      }),
    ).toBe(true);
  });

  it('ignores keys that are undefined, as saving does', () => {
    expect(
      isWidgetModified({
        hasWidget: true,
        isReady: true,
        saved: { conditions: [{ ...condition }] },
        current: { conditions: [{ ...condition, options: undefined }] },
      }),
    ).toBe(false);
  });
});
