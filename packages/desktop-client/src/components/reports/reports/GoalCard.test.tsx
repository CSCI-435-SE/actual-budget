import React from 'react';

import type {
  GoalCardWidget,
  RuleConditionEntity,
  TagEntity,
} from '@actual-app/core/types/models';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { summarySpreadsheet } from '#components/reports/spreadsheets/summary-spreadsheet';
import { useReport } from '#components/reports/useReport';
import type { ContextMenuItem } from '#contextmenu/types';
import { useNavigate } from '#hooks/useNavigate';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';
import { initServer, serverPush } from '#mocks/connection';
import { tagQueries } from '#tags/queries';

import { GoalCard } from './GoalCard';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('#hooks/useNavigate');
// The summary spreadsheet queries the backend; stub it so tests can control
// the computed total directly through `useReport`.
vi.mock('#components/reports/spreadsheets/summary-spreadsheet', () => ({
  summarySpreadsheet: vi.fn(() => async () => undefined),
}));
vi.mock('#components/reports/useReport', () => ({
  useReport: vi.fn(() => null),
}));
// jsdom has no IntersectionObserver; treat the card as always on screen so
// ReportCard renders its children.
vi.mock('#hooks/useIsInViewport', () => ({
  useIsInViewport: () => true,
}));

const WIDGET_ID = 'goal-widget-1';
const TAGS: TagEntity[] = [
  { id: 'tag-1', tag: 'vacation' },
  { id: 'tag-2', tag: 'emergency' },
];

type Meta = GoalCardWidget['meta'];
type TestStore = ReturnType<typeof configureTestAppStore>;

function createTestEnvironment() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(tagQueries.list().queryKey, TAGS);
  return { queryClient, store: configureTestAppStore({ queryClient }) };
}

function renderGoalCard({
  meta,
  isEditing = false,
  onMetaChange = vi.fn(),
  environment = createTestEnvironment(),
}: {
  meta?: Meta;
  isEditing?: boolean;
  onMetaChange?: (newMeta: Meta) => void;
  environment?: ReturnType<typeof createTestEnvironment>;
} = {}) {
  const { queryClient, store } = environment;
  const result = render(
    <TestProviders queryClient={queryClient} store={store}>
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

function mockTotal(total: number) {
  vi.mocked(useReport).mockReturnValue({ total });
}

describe('GoalCard', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useReport).mockReturnValue(null);
    initServer({ 'get-latest-transaction': () => null });
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
    it('shows the computed current amount and the target amount', () => {
      mockTotal(250000);
      renderGoalCard({
        meta: { linkedTag: 'vacation', targetAmount: 1000000 },
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
        total: 250000,
        targetAmount: 1000000,
        expected: 25,
      },
      {
        label: 'nothing saved yet',
        total: 0,
        targetAmount: 1000000,
        expected: 0,
      },
      {
        label: 'goal reached exactly',
        total: 1000000,
        targetAmount: 1000000,
        expected: 100,
      },
      {
        label: 'rounding down to a whole percent',
        total: 1000,
        targetAmount: 3000,
        expected: 33,
      },
      {
        label: 'rounding up to a whole percent',
        total: 2000,
        targetAmount: 3000,
        expected: 67,
      },
      {
        label: 'goal exceeded (bar stays full)',
        total: 1500000,
        targetAmount: 1000000,
        expected: 150,
      },
      {
        label: 'negative total (floored at 0%)',
        total: -50000,
        targetAmount: 1000000,
        expected: 0,
      },
      {
        label: 'no target set (no divide by zero)',
        total: 50000,
        targetAmount: 0,
        expected: 0,
      },
    ])('shows $expected% when $label', ({ total, targetAmount, expected }) => {
      mockTotal(total);
      const { container } = renderGoalCard({
        meta: { linkedTag: 'vacation', targetAmount },
      });

      expect(screen.getByText(`${expected}%`)).toBeInTheDocument();
      expect(getComputedStyle(getProgressFill(container)).width).toBe(
        `${Math.min(expected, 100)}%`,
      );
    });

    it('updates when the computed total changes', () => {
      const environment = createTestEnvironment();
      const meta: Meta = { linkedTag: 'vacation', targetAmount: 1000000 };
      mockTotal(100000);
      const { rerender, container } = renderGoalCard({ meta, environment });
      expect(screen.getByText('10%')).toBeInTheDocument();

      mockTotal(600000);
      rerender(
        <TestProviders
          queryClient={environment.queryClient}
          store={environment.store}
        >
          <GoalCard widgetId={WIDGET_ID} meta={meta} onMetaChange={vi.fn()} />
        </TestProviders>,
      );

      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(getComputedStyle(getProgressFill(container)).width).toBe('60%');
    });

    it('shows no progress when no tag is linked', () => {
      mockTotal(500000);
      const { container } = renderGoalCard({
        meta: { targetAmount: 1000000 },
      });

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(getComputedStyle(getProgressFill(container)).width).toBe('0%');
      expect(summarySpreadsheet).not.toHaveBeenCalled();
    });

    it('sums tagged transactions using the stored conditions', () => {
      const conditions: RuleConditionEntity[] = [
        { field: 'amount', op: 'gt', value: 0, type: 'number' },
      ];
      renderGoalCard({
        meta: {
          linkedTag: 'vacation',
          targetAmount: 1000000,
          conditions,
          conditionsOp: 'or',
        },
      });

      expect(summarySpreadsheet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        conditions,
        'or',
        { type: 'sum' },
        expect.anything(),
        [
          {
            field: 'notes',
            op: 'hasTags',
            value: '#vacation',
            type: 'string',
          },
        ],
      );
    });
  });

  describe('live updates', () => {
    const meta: Meta = { linkedTag: 'vacation', targetAmount: 1000000 };

    async function pushTableChange(tables: string[]) {
      await act(async () => {
        serverPush('sync-event', { type: 'applied', tables });
      });
    }

    it('recalculates when transactions change', async () => {
      mockTotal(400000);
      renderGoalCard({ meta });
      expect(await screen.findByText('40%')).toBeInTheDocument();
      const callsBefore = vi.mocked(summarySpreadsheet).mock.calls.length;

      mockTotal(700000);
      await pushTableChange(['transactions']);

      expect(vi.mocked(summarySpreadsheet).mock.calls.length).toBe(
        callsBefore + 1,
      );
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('ignores changes that do not touch transactions', async () => {
      mockTotal(400000);
      renderGoalCard({ meta });
      await screen.findByText('40%');
      const callsBefore = vi.mocked(summarySpreadsheet).mock.calls.length;

      await pushTableChange(['categories']);

      expect(vi.mocked(summarySpreadsheet).mock.calls.length).toBe(callsBefore);
    });

    it('keeps showing the last total while recalculating', async () => {
      mockTotal(400000);
      renderGoalCard({ meta });
      await screen.findByText('40%');

      // useReport returns null while a new query is in flight.
      vi.mocked(useReport).mockReturnValue(null);
      await pushTableChange(['transactions']);

      expect(screen.getByText('40%')).toBeInTheDocument();
    });

    it('does not listen for changes when no tag is linked', async () => {
      renderGoalCard({ meta: { targetAmount: 1000000 } });

      await pushTableChange(['transactions']);

      expect(summarySpreadsheet).not.toHaveBeenCalled();
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
    it('saves the new name and keeps the rest of the goal', async () => {
      const user = userEvent.setup();
      const meta: Meta = {
        name: 'Vacation',
        linkedTag: 'vacation',
        targetAmount: 1000000,
      };
      const { onMetaChange, store } = renderGoalCard({ meta });

      chooseContextMenuItem(store, 'Vacation', 'rename');

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Trip to Japan{Enter}');

      expect(onMetaChange).toHaveBeenCalledWith({
        name: 'Trip to Japan',
        linkedTag: 'vacation',
        targetAmount: 1000000,
      });
    });
  });

  describe('setting a goal', () => {
    it('saves the entered amount as the target and keeps the rest of the goal', async () => {
      const user = userEvent.setup();
      const meta: Meta = {
        name: 'Vacation',
        conditionsOp: 'or',
        targetAmount: 1000000,
      };
      const { onMetaChange, store } = renderGoalCard({ meta });

      chooseContextMenuItem(store, 'Vacation', 'set-goal');

      const input = screen.getByLabelText('Goal amount');
      await user.clear(input);
      await user.type(input, '7,500{Enter}');

      expect(onMetaChange).toHaveBeenCalledWith({
        name: 'Vacation',
        conditionsOp: 'or',
        targetAmount: 750000,
      });
      expect(screen.queryByLabelText('Goal amount')).not.toBeInTheDocument();
    });

    it('sets a goal on a new card that has no target yet', async () => {
      const user = userEvent.setup();
      const { onMetaChange, store } = renderGoalCard({ meta: {} });

      chooseContextMenuItem(store, 'Personal goal', 'set-goal');

      const input = screen.getByLabelText('Goal amount');
      await user.clear(input);
      await user.type(input, '1000{Enter}');

      expect(onMetaChange).toHaveBeenCalledWith({ targetAmount: 100000 });
    });

    it('does not open the report while the goal is being edited', async () => {
      const user = userEvent.setup();
      const { store } = renderGoalCard({ meta: { name: 'Vacation' } });

      chooseContextMenuItem(store, 'Vacation', 'set-goal');
      await user.click(screen.getByLabelText('Goal amount'));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not save anything when cancelled', async () => {
      const user = userEvent.setup();
      const { onMetaChange, store } = renderGoalCard({
        meta: { name: 'Vacation', targetAmount: 1000000 },
      });

      chooseContextMenuItem(store, 'Vacation', 'set-goal');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onMetaChange).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Goal amount')).not.toBeInTheDocument();
    });
  });

  describe('linked tag', () => {
    it('shows the linked tag on the card', () => {
      renderGoalCard({ meta: { name: 'Vacation', linkedTag: 'vacation' } });

      expect(screen.getByText('#vacation')).toBeInTheDocument();
    });

    it('shows no tag when none is linked', () => {
      renderGoalCard({ meta: { name: 'Vacation' } });

      expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    });

    it('links the chosen tag together with the goal amount', async () => {
      const user = userEvent.setup();
      const { onMetaChange, store } = renderGoalCard({
        meta: { name: 'Vacation', targetAmount: 1000000 },
      });

      chooseContextMenuItem(store, 'Vacation', 'set-goal');
      const input = screen.getByLabelText('Goal amount');
      await user.clear(input);
      await user.type(input, '2,000');
      await chooseTag(user, '#vacation');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onMetaChange).toHaveBeenCalledTimes(1);
      expect(onMetaChange).toHaveBeenCalledWith({
        name: 'Vacation',
        targetAmount: 200000,
        linkedTag: 'vacation',
      });
    });

    it('unlinks the tag when "No tag" is chosen', async () => {
      const user = userEvent.setup();
      const { onMetaChange, store } = renderGoalCard({
        meta: {
          name: 'Vacation',
          targetAmount: 1000000,
          linkedTag: 'vacation',
        },
      });

      chooseContextMenuItem(store, 'Vacation', 'set-goal');
      await chooseTag(user, 'No tag');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      const savedMeta = vi.mocked(onMetaChange).mock.calls[0][0];
      expect(savedMeta).toEqual({ name: 'Vacation', targetAmount: 1000000 });
      expect(savedMeta).not.toHaveProperty('linkedTag');
    });
  });
});

/**
 * Opens the "Linked tag" dropdown and picks the option with the given label.
 */
async function chooseTag(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByLabelText('Linked tag'));
  const menu = await screen.findByRole('menu');
  await user.click(within(menu).getByText(label));
}

/**
 * Opens the card's context menu and runs the item with the given name.
 */
function chooseContextMenuItem(
  store: TestStore,
  cardName: string,
  itemName: string,
) {
  fireEvent.contextMenu(screen.getByRole('heading', { name: cardName }));
  const item = store
    .getState()
    .contextMenu.items.find(
      (menuItem): menuItem is Exclude<ContextMenuItem, symbol> =>
        typeof menuItem === 'object' && menuItem.name === itemName,
    );
  expect(item).toBeDefined();
  act(() => item?.onClick?.());
}
