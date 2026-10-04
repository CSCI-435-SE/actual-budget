import React from 'react';

import type { GoalCardWidget } from '@actual-app/core/types/models';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ContextMenuItem } from '#contextmenu/types';
import { useNavigate } from '#hooks/useNavigate';
import { createTestAppStore, TestProviders } from '#mocks';

import { GoalCard } from './GoalCard';

vi.mock('#hooks/useNavigate');
// jsdom has no IntersectionObserver; treat the card as always on screen so
// ReportCard renders its children.
vi.mock('#hooks/useIsInViewport', () => ({
  useIsInViewport: () => true,
}));

const WIDGET_ID = 'goal-widget-1';

type Meta = GoalCardWidget['meta'];

function renderGoalCard({
  meta,
  isEditing = false,
  onMetaChange = vi.fn(),
  store = createTestAppStore(),
}: {
  meta?: Meta;
  isEditing?: boolean;
  onMetaChange?: (newMeta: Meta) => void;
  store?: ReturnType<typeof createTestAppStore>;
} = {}) {
  const result = render(
    <TestProviders store={store}>
      <GoalCard
        widgetId={WIDGET_ID}
        isEditing={isEditing}
        meta={meta}
        onMetaChange={onMetaChange}
      />
    </TestProviders>,
  );
  return { ...result, onMetaChange, store };
}

function getProgressFill(container: HTMLElement) {
  const track = container.querySelector('[aria-hidden="true"]');
  const fill = track?.firstElementChild;
  if (!(fill instanceof HTMLElement)) {
    throw new Error('Progress bar not found');
  }
  return fill;
}

describe('GoalCard', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  describe('name', () => {
    it('shows the goal name from meta', () => {
      renderGoalCard({ meta: { name: 'Emergency fund' } });

      expect(
        screen.getByRole('heading', { name: 'Emergency fund' }),
      ).toBeInTheDocument();
    });

    it('falls back to a default name when none is set', () => {
      renderGoalCard({ meta: {} });

      expect(
        screen.getByRole('heading', { name: 'Personal goal' }),
      ).toBeInTheDocument();
    });
  });

  describe('amounts', () => {
    it('shows the current and target amounts', () => {
      renderGoalCard({
        meta: { currentAmount: 250000, targetAmount: 1000000 },
      });

      expect(screen.getByText('2,500.00')).toBeInTheDocument();
      expect(screen.getByText(/10,000\.00/)).toBeInTheDocument();
    });

    it('shows zero amounts when meta is missing', () => {
      renderGoalCard({ meta: null });

      expect(screen.getAllByText(/0\.00/)).toHaveLength(2);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('progress', () => {
    it.each([
      {
        label: 'partway to the goal',
        currentAmount: 250000,
        targetAmount: 1000000,
        expected: 25,
      },
      {
        label: 'nothing saved yet',
        currentAmount: 0,
        targetAmount: 1000000,
        expected: 0,
      },
      {
        label: 'goal reached exactly',
        currentAmount: 1000000,
        targetAmount: 1000000,
        expected: 100,
      },
      {
        label: 'rounding down to a whole percent',
        currentAmount: 1000,
        targetAmount: 3000,
        expected: 33,
      },
      {
        label: 'rounding up to a whole percent',
        currentAmount: 2000,
        targetAmount: 3000,
        expected: 67,
      },
      {
        label: 'goal exceeded (capped at 100%)',
        currentAmount: 1500000,
        targetAmount: 1000000,
        expected: 100,
      },
      {
        label: 'negative balance (floored at 0%)',
        currentAmount: -50000,
        targetAmount: 1000000,
        expected: 0,
      },
      {
        label: 'no target set (no divide by zero)',
        currentAmount: 50000,
        targetAmount: 0,
        expected: 0,
      },
    ])(
      'shows $expected% when $label',
      ({ currentAmount, targetAmount, expected }) => {
        const { container } = renderGoalCard({
          meta: { currentAmount, targetAmount },
        });

        expect(screen.getByText(`${expected}%`)).toBeInTheDocument();
        expect(getComputedStyle(getProgressFill(container)).width).toBe(
          `${expected}%`,
        );
      },
    );

    it('updates when the goal amounts change', () => {
      const store = createTestAppStore();
      const { rerender, container } = renderGoalCard({
        meta: { currentAmount: 100000, targetAmount: 1000000 },
        store,
      });
      expect(screen.getByText('10%')).toBeInTheDocument();

      rerender(
        <TestProviders store={store}>
          <GoalCard
            widgetId={WIDGET_ID}
            meta={{ currentAmount: 600000, targetAmount: 1000000 }}
            onMetaChange={vi.fn()}
          />
        </TestProviders>,
      );

      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(getComputedStyle(getProgressFill(container)).width).toBe('60%');
    });
  });

  describe('navigation', () => {
    it('opens the goal report for this widget when clicked', async () => {
      const user = userEvent.setup();
      renderGoalCard({ meta: { name: 'Vacation' } });

      await user.click(screen.getByRole('button'));

      expect(mockNavigate).toHaveBeenCalledWith(`/reports/goal/${WIDGET_ID}`, {
        state: { goBack: true },
      });
    });

    it('does not navigate while the dashboard is being edited', async () => {
      const user = userEvent.setup();
      renderGoalCard({ meta: { name: 'Vacation' }, isEditing: true });

      await user.click(screen.getByRole('heading', { name: 'Vacation' }));

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('renaming', () => {
    it('saves the new name and keeps the goal amounts', async () => {
      const user = userEvent.setup();
      const meta: Meta = {
        name: 'Vacation',
        currentAmount: 250000,
        targetAmount: 1000000,
      };
      const { onMetaChange, store } = renderGoalCard({ meta });

      // Open the card's context menu and choose "Rename".
      fireEvent.contextMenu(screen.getByRole('heading', { name: 'Vacation' }));
      const renameItem = store
        .getState()
        .contextMenu.items.find(
          (item): item is Exclude<ContextMenuItem, symbol> =>
            typeof item === 'object' && item.name === 'rename',
        );
      expect(renameItem).toBeDefined();
      act(() => renameItem?.onClick?.());

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Trip to Japan{Enter}');

      expect(onMetaChange).toHaveBeenCalledWith({
        name: 'Trip to Japan',
        currentAmount: 250000,
        targetAmount: 1000000,
      });
    });
  });
});
