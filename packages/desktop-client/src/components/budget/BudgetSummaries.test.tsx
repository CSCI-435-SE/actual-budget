import React from 'react';

import { fireEvent, render } from '@testing-library/react';

import { BudgetSummaries } from './BudgetSummaries';
import { MonthsContext } from './MonthsContext';

vi.mock('#hooks/useResizeObserver', () => ({
  useResizeObserver: () => () => undefined,
}));

vi.mock('.', () => ({
  useBudgetComponents: () => ({
    SummaryComponent: () => null,
  }),
}));

const MONTHS = ['2024-01', '2024-02', '2024-03'];

function renderSummaries(startMonth: string, onMonthSelect: () => void) {
  const { container } = render(
    <MonthsContext.Provider value={{ months: MONTHS, type: 'envelope' }}>
      <BudgetSummaries startMonth={startMonth} onMonthSelect={onMonthSelect} />
    </MonthsContext.Provider>,
  );
  return container.firstChild as HTMLElement;
}

describe('BudgetSummaries wheel navigation', () => {
  test('ignores wheel events where the vertical delta dominates', () => {
    const onMonthSelect = vi.fn();
    const el = renderSummaries('2024-02', onMonthSelect);

    fireEvent.wheel(el, { deltaX: 0, deltaY: 300 });

    expect(onMonthSelect).not.toHaveBeenCalled();
  });

  test('steps to the next month once accumulated horizontal delta crosses the threshold', () => {
    const onMonthSelect = vi.fn();
    const el = renderSummaries('2024-02', onMonthSelect);

    fireEvent.wheel(el, { deltaX: 120, deltaY: 0 });
    expect(onMonthSelect).not.toHaveBeenCalled();

    fireEvent.wheel(el, { deltaX: 120, deltaY: 0 });
    expect(onMonthSelect).toHaveBeenCalledTimes(1);
    expect(onMonthSelect).toHaveBeenCalledWith('2024-03');
  });

  test('steps to the previous month on a negative horizontal swipe', () => {
    const onMonthSelect = vi.fn();
    const el = renderSummaries('2024-02', onMonthSelect);

    fireEvent.wheel(el, { deltaX: -220, deltaY: 0 });

    expect(onMonthSelect).toHaveBeenCalledWith('2024-01');
  });

  test('locks out further steps for a fixed window after a step fires', () => {
    const onMonthSelect = vi.fn();
    const el = renderSummaries('2024-02', onMonthSelect);

    fireEvent.wheel(el, { deltaX: 220, deltaY: 0 });
    expect(onMonthSelect).toHaveBeenCalledTimes(1);

    // Date.now() is frozen in tests (see setupTests.ts), so these extra
    // events land within the lockout window — standing in for a swipe's
    // trailing momentum, which should not trigger extra steps.
    fireEvent.wheel(el, { deltaX: 220, deltaY: 0 });
    fireEvent.wheel(el, { deltaX: 220, deltaY: 0 });

    expect(onMonthSelect).toHaveBeenCalledTimes(1);
  });

  test('allows another step once the lockout window has elapsed', () => {
    const onMonthSelect = vi.fn();
    const el = renderSummaries('2024-02', onMonthSelect);

    fireEvent.wheel(el, { deltaX: 220, deltaY: 0 });
    expect(onMonthSelect).toHaveBeenCalledTimes(1);

    const originalNow = Date.now;
    Date.now = () => originalNow() + 1000;
    try {
      fireEvent.wheel(el, { deltaX: 220, deltaY: 0 });
    } finally {
      Date.now = originalNow;
    }

    expect(onMonthSelect).toHaveBeenCalledTimes(2);
    expect(onMonthSelect).toHaveBeenLastCalledWith('2024-03');
  });
});
