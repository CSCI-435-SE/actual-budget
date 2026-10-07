import React from 'react';

import { theme } from '@actual-app/components/theme';
import { render, screen } from '@testing-library/react';

import { TestProviders } from '#mocks';

import { getGoalProgress, GoalProgress } from './GoalProgress';

function renderGoalProgress(currentAmount: number, targetAmount: number) {
  const result = render(
    <TestProviders>
      <GoalProgress currentAmount={currentAmount} targetAmount={targetAmount} />
    </TestProviders>,
  );
  const fill = result.container.querySelector(
    '[aria-hidden="true"]',
  )?.firstElementChild;
  if (!(fill instanceof HTMLElement)) {
    throw new Error('Progress bar not found');
  }
  return { ...result, fill };
}

describe('GoalProgress', () => {
  describe('in progress', () => {
    it('shows a yellow bar and no congratulations message', () => {
      const { fill } = renderGoalProgress(250000, 1000000);

      expect(getComputedStyle(fill).backgroundColor).toBe(theme.warningBorder);
      expect(getComputedStyle(fill).width).toBe('25%');
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.queryByText(/Congratulations/)).not.toBeInTheDocument();
    });

    it('does not round up to 100% before the goal is reached', () => {
      const { fill } = renderGoalProgress(999999, 1000000);

      expect(screen.getByText('99%')).toBeInTheDocument();
      expect(getComputedStyle(fill).backgroundColor).toBe(theme.warningBorder);
      expect(screen.queryByText(/Congratulations/)).not.toBeInTheDocument();
    });
  });

  describe('complete', () => {
    it.each([
      { label: 'reached exactly', currentAmount: 1000000, expected: 100 },
      { label: 'exceeded', currentAmount: 1500000, expected: 150 },
    ])(
      'shows a full green bar and congratulates the user when the goal is $label',
      ({ currentAmount, expected }) => {
        const { fill } = renderGoalProgress(currentAmount, 1000000);

        expect(getComputedStyle(fill).backgroundColor).toBe(theme.reportsGreen);
        expect(getComputedStyle(fill).width).toBe('100%');
        expect(screen.getByText(`${expected}%`)).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent(
          'Congratulations! You reached your goal.',
        );
      },
    );

    it('keeps updating the percentage as the goal is exceeded further', () => {
      const { fill, rerender } = renderGoalProgress(1200000, 1000000);
      expect(screen.getByText('120%')).toBeInTheDocument();

      rerender(
        <TestProviders>
          <GoalProgress currentAmount={2500000} targetAmount={1000000} />
        </TestProviders>,
      );

      expect(screen.getByText('250%')).toBeInTheDocument();
      expect(getComputedStyle(fill).width).toBe('100%');
      expect(getComputedStyle(fill).backgroundColor).toBe(theme.reportsGreen);
    });
  });

  it('does not treat a goal with no target as complete', () => {
    const { fill } = renderGoalProgress(50000, 0);

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(getComputedStyle(fill).backgroundColor).toBe(theme.warningBorder);
    expect(screen.queryByText(/Congratulations/)).not.toBeInTheDocument();
  });
});

describe('getGoalProgress', () => {
  it.each([
    { current: 0, target: 1000, percent: 0, isComplete: false },
    { current: 1000, target: 3000, percent: 33, isComplete: false },
    { current: 2000, target: 3000, percent: 67, isComplete: false },
    { current: 9996, target: 10000, percent: 99, isComplete: false },
    { current: 10000, target: 10000, percent: 100, isComplete: true },
    { current: 10004, target: 10000, percent: 100, isComplete: true },
    { current: 15000, target: 10000, percent: 150, isComplete: true },
    { current: 30000, target: 10000, percent: 300, isComplete: true },
    { current: -500, target: 10000, percent: 0, isComplete: false },
    { current: 500, target: 0, percent: 0, isComplete: false },
  ])(
    '$current of $target is $percent% (complete: $isComplete)',
    ({ current, target, percent, isComplete }) => {
      expect(getGoalProgress(current, target)).toEqual({
        percent,
        barPercent: Math.min(percent, 100),
        isComplete,
      });
    },
  );
});
