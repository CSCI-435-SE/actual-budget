import React from 'react';
import { MemoryRouter } from 'react-router';

import { fireEvent, render, screen } from '@testing-library/react';

import { useBudgetMonthCount } from './BudgetMonthCountContext';
import { MonthCountSelector } from './MonthCountSelector';

vi.mock('./BudgetMonthCountContext', () => ({
  useBudgetMonthCount: vi.fn(),
}));

function renderSelector(maxMonths: number, onChange: (value: number) => void) {
  return render(
    <MemoryRouter>
      <MonthCountSelector maxMonths={maxMonths} onChange={onChange} />
    </MemoryRouter>,
  );
}

describe('MonthCountSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders nothing when only one month fits on screen', () => {
    vi.mocked(useBudgetMonthCount).mockReturnValue({
      displayMax: 1,
      setDisplayMax: vi.fn(),
    });

    const { container } = renderSelector(1, vi.fn());

    expect(container).toBeEmptyDOMElement();
  });

  test('renders one calendar button per month that can be displayed', () => {
    vi.mocked(useBudgetMonthCount).mockReturnValue({
      displayMax: 3,
      setDisplayMax: vi.fn(),
    });

    renderSelector(2, vi.fn());

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    // Each icon is a real, focusable button so it picks up the app's
    // standard pointer-cursor/hover-background button styling.
    for (const button of buttons) {
      expect(button.tagName).toBe('BUTTON');
    }
  });

  test('calls onChange with the 1-based index of the clicked month', () => {
    vi.mocked(useBudgetMonthCount).mockReturnValue({
      displayMax: 3,
      setDisplayMax: vi.fn(),
    });
    const onChange = vi.fn();

    renderSelector(1, onChange);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]);

    expect(onChange).toHaveBeenCalledWith(3);
  });

  test('highlights months up to maxMonths and dims the rest', () => {
    vi.mocked(useBudgetMonthCount).mockReturnValue({
      displayMax: 3,
      setDisplayMax: vi.fn(),
    });

    renderSelector(2, vi.fn());

    const icons = screen
      .getAllByRole('button')
      .map(button => button.querySelector('svg'));

    expect(icons[0]).toHaveStyle({ color: 'var(--color-pageTextLight)' });
    expect(icons[1]).toHaveStyle({ color: 'var(--color-pageTextLight)' });
    expect(icons[2]).toHaveStyle({ color: 'var(--color-pageTextSubdued)' });
  });
});
