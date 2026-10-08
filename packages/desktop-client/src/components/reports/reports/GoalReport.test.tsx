import React from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  clearServer,
  initServer,
} from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  GoalCardWidget,
  RuleConditionEntity,
  TagEntity,
  TimeFrame,
} from '@actual-app/core/types/models';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';

import { summarySpreadsheet } from '#components/reports/spreadsheets/summary-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useNavigate } from '#hooks/useNavigate';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';

import { GoalReport } from './GoalReport';

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
// The real list needs the full transaction table setup; its query is covered
// in GoalTransactions.test.ts. This stub shows what the report passes in.
vi.mock('#components/reports/GoalTransactions', () => ({
  GoalTransactions: (props: {
    start: string;
    end: string;
    conditions: RuleConditionEntity[];
    conditionsOp: 'and' | 'or';
    linkedTag: string;
  }) => (
    <span data-testid="goal-transactions">
      {JSON.stringify({ ...props, conditions: props.conditions.length })}
    </span>
  ),
}));
vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: () => [undefined, vi.fn()],
}));
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));

// The real Header pulls in the filter menus and date pickers, which are
// covered elsewhere. This stub shows what GoalReport passes to it and lets
// tests change the dates and filters.
type HeaderStubProps = {
  start: string;
  end: string;
  mode?: TimeFrame['mode'];
  allMonths: Array<{ name: string; pretty: string }>;
  earliestTransaction: string;
  latestTransaction: string;
  onChangeDates: (start: string, end: string, mode: TimeFrame['mode']) => void;
  onApply: (condition: RuleConditionEntity) => void;
  children?: ReactNode;
};

vi.mock('#components/reports/Header', () => ({
  Header: ({
    start,
    end,
    mode,
    allMonths,
    earliestTransaction,
    latestTransaction,
    onChangeDates,
    onApply,
    children,
  }: HeaderStubProps) => (
    <div>
      <span data-testid="header-range">{`${start} ${end} ${mode}`}</span>
      <span data-testid="header-bounds">
        {`${earliestTransaction} ${latestTransaction}`}
      </span>
      <span data-testid="header-months">
        {allMonths.map(month => month.name).join(' ')}
      </span>
      <button
        onClick={() => onChangeDates('2025-01-01', '2025-03-31', 'static')}
      >
        Change dates
      </button>
      <button onClick={() => onApply(TEST_CONDITION)}>Add filter</button>
      {children}
    </div>
  ),
}));

const WIDGET_ID = 'goal-widget-1';
const TAGS: TagEntity[] = [
  { id: 'tag-1', tag: 'vacation' },
  { id: 'tag-2', tag: 'emergency' },
];
const TEST_CONDITION: RuleConditionEntity = {
  field: 'notes',
  op: 'contains',
  value: 'trip',
  type: 'string',
};
const STATIC_TIME_FRAME: TimeFrame = {
  start: '2024-01-01',
  end: '2024-06-30',
  mode: 'static',
};

type Meta = GoalCardWidget['meta'];

function makeWidget(meta: Meta): GoalCardWidget {
  return {
    id: WIDGET_ID,
    dashboard_page_id: 'page-1',
    type: 'goal-card',
    x: 0,
    y: 0,
    width: 4,
    height: 2,
    meta,
    tombstone: false,
  };
}

type ServerOptions = {
  widgets?: GoalCardWidget[];
  earliest?: { date: string } | null;
  latest?: { date: string } | null;
  isWidgetQueryPending?: boolean;
};

function setUpServer({
  widgets = [],
  earliest = { date: '2024-01-05' },
  latest = { date: '2024-06-20' },
  isWidgetQueryPending = false,
}: ServerOptions = {}) {
  const updateWidget = vi.fn(async (_widget: unknown) => undefined);
  initServer({
    query: () =>
      isWidgetQueryPending
        ? new Promise(() => undefined)
        : Promise.resolve({ data: widgets, dependencies: [] }),
    'tags-get': async () => TAGS,
    'get-earliest-transaction': async () => earliest,
    'get-latest-transaction': async () => latest,
    'dashboard-update-widget': updateWidget,
  });
  return { updateWidget };
}

function renderGoalReport({
  meta,
  path = `/reports/goal/${WIDGET_ID}`,
  ...serverOptions
}: { meta?: Meta; path?: string } & ServerOptions = {}) {
  const server = setUpServer({
    widgets: meta === undefined ? [] : [makeWidget(meta)],
    ...serverOptions,
  });
  const queryClient = createTestQueryClient();
  const store = configureTestAppStore({ queryClient });

  render(
    <TestProviders queryClient={queryClient} store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/reports/goal" element={<GoalReport />} />
          <Route path="/reports/goal/:id" element={<GoalReport />} />
        </Routes>
      </MemoryRouter>
    </TestProviders>,
  );

  return { ...server, store };
}

async function waitForReport() {
  return screen.findByText('Matching transactions');
}

function getProgressFill() {
  const track = document.querySelector('[aria-hidden="true"]');
  const fill = track?.firstElementChild;
  if (!(fill instanceof HTMLElement)) {
    throw new Error('Progress bar not found');
  }
  return fill;
}

function mockTotal(total: number) {
  vi.mocked(useReport).mockReturnValue({ total });
}

describe('GoalReport', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useReport).mockReturnValue(null);
    (useResponsive as unknown as Mock).mockReturnValue({
      isNarrowWidth: false,
    });
  });

  afterEach(async () => {
    await clearServer();
  });

  describe('loading', () => {
    it('shows a loading indicator while the widget is being fetched', () => {
      renderGoalReport({ meta: {}, isWidgetQueryPending: true });

      expect(
        screen.queryByText('Matching transactions'),
      ).not.toBeInTheDocument();
    });
  });

  describe('title', () => {
    it('shows the goal name from the widget', async () => {
      renderGoalReport({ meta: { name: 'Emergency fund' } });
      await waitForReport();

      expect(screen.getByText('Emergency fund')).toBeInTheDocument();
    });

    it('falls back to a default name when none is set', async () => {
      renderGoalReport({ meta: {} });
      await waitForReport();

      expect(screen.getByText('Personal goal')).toBeInTheDocument();
    });

    it('saves a renamed goal and keeps the rest of the widget', async () => {
      const user = userEvent.setup();
      const { updateWidget } = renderGoalReport({
        meta: { name: 'Emergency fund', targetAmount: 1000000 },
      });
      await waitForReport();

      await user.click(
        within(screen.getByText('Emergency fund')).getByRole('button'),
      );
      const input = screen.getByDisplayValue('Emergency fund');
      await user.clear(input);
      await user.type(input, 'Trip to Japan{Enter}');

      await waitFor(() =>
        expect(updateWidget).toHaveBeenCalledWith({
          id: WIDGET_ID,
          meta: { name: 'Trip to Japan', targetAmount: 1000000 },
        }),
      );
    });

    it('saves the default name when the title is cleared', async () => {
      const user = userEvent.setup();
      const { updateWidget } = renderGoalReport({
        meta: { name: 'Emergency fund' },
      });
      await waitForReport();

      await user.click(
        within(screen.getByText('Emergency fund')).getByRole('button'),
      );
      const input = screen.getByDisplayValue('Emergency fund');
      await user.clear(input);
      await user.type(input, '{Enter}');

      await waitFor(() =>
        expect(updateWidget).toHaveBeenCalledWith({
          id: WIDGET_ID,
          meta: { name: 'Personal goal' },
        }),
      );
    });
  });

  describe('without a widget', () => {
    it('shows a read-only title and no save button', async () => {
      renderGoalReport({ path: '/reports/goal' });
      await waitForReport();

      const title = screen.getByText('Personal goal');
      expect(within(title).queryByRole('button')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Save widget' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('mobile', () => {
    beforeEach(() => {
      (useResponsive as unknown as Mock).mockReturnValue({
        isNarrowWidth: true,
      });
    });

    it('shows the goal name in the mobile header', async () => {
      renderGoalReport({ meta: { name: 'Emergency fund' } });
      await waitForReport();

      expect(screen.getByText('Emergency fund')).toBeInTheDocument();
    });

    it('goes back to the reports page from the back button', async () => {
      const user = userEvent.setup();
      renderGoalReport({ meta: { name: 'Emergency fund' } });
      await waitForReport();

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(mockNavigate).toHaveBeenCalledWith('/reports');
    });
  });

  describe('amounts and progress', () => {
    it('shows the computed current amount and the target amount', async () => {
      mockTotal(250000);
      renderGoalReport({
        meta: { linkedTag: 'vacation', targetAmount: 1000000 },
      });
      await waitForReport();

      expect(screen.getByText('2,500.00')).toBeInTheDocument();
      expect(screen.getByText(/10,000\.00/)).toBeInTheDocument();
    });

    it.each([
      {
        label: 'partway to the goal',
        total: 250000,
        targetAmount: 1000000,
        expected: 25,
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
    ])(
      'shows $expected% when $label',
      async ({ total, targetAmount, expected }) => {
        mockTotal(total);
        renderGoalReport({ meta: { linkedTag: 'vacation', targetAmount } });
        await waitForReport();

        expect(screen.getByText(`${expected}%`)).toBeInTheDocument();
        expect(getComputedStyle(getProgressFill()).width).toBe(
          `${Math.min(expected, 100)}%`,
        );
      },
    );

    it('treats a widget with no meta as an empty goal', async () => {
      renderGoalReport({ meta: null });
      await waitForReport();

      expect(screen.getByText('Personal goal')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('updates the progress when the goal amount is edited', async () => {
      const user = userEvent.setup();
      mockTotal(250000);
      renderGoalReport({
        meta: { linkedTag: 'vacation', targetAmount: 1000000 },
      });
      await waitForReport();
      expect(screen.getByText('25%')).toBeInTheDocument();

      const input = screen.getByLabelText('Goal amount');
      await user.clear(input);
      await user.type(input, '5,000{Enter}');

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(getComputedStyle(getProgressFill()).width).toBe('50%');
    });

    it('shows no progress when no tag is linked', async () => {
      mockTotal(500000);
      renderGoalReport({ meta: { targetAmount: 1000000 } });
      await waitForReport();

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(summarySpreadsheet).not.toHaveBeenCalled();
    });

    it('sums tagged transactions using the saved filters and time frame', async () => {
      renderGoalReport({
        meta: {
          linkedTag: 'vacation',
          targetAmount: 1000000,
          conditions: [TEST_CONDITION],
          conditionsOp: 'or',
          timeFrame: STATIC_TIME_FRAME,
        },
      });
      await waitForReport();

      await waitFor(() =>
        expect(summarySpreadsheet).toHaveBeenLastCalledWith(
          '2024-01-01',
          '2024-06-30',
          [TEST_CONDITION],
          'or',
          { type: 'sum' },
          expect.anything(),
          [tagCondition('vacation')],
        ),
      );
    });

    it('recalculates from unsaved tag, filter and date changes', async () => {
      const user = userEvent.setup();
      renderGoalReport({
        meta: { linkedTag: 'vacation', timeFrame: STATIC_TIME_FRAME },
      });
      await waitForReport();

      await chooseTag(user, '#emergency');
      await user.click(screen.getByRole('button', { name: 'Add filter' }));
      await user.click(screen.getByRole('button', { name: 'Change dates' }));

      expect(summarySpreadsheet).toHaveBeenLastCalledWith(
        '2025-01-01',
        '2025-03-31',
        [TEST_CONDITION],
        'and',
        { type: 'sum' },
        expect.anything(),
        [tagCondition('emergency')],
      );
    });
  });

  describe('linked tag', () => {
    it('describes the transactions for the linked tag', async () => {
      renderGoalReport({ meta: { linkedTag: 'vacation' } });
      await waitForReport();

      expect(screen.getByText(/Transactions tagged/)).toHaveTextContent(
        '#vacation',
      );
    });

    it('prompts to link a tag when none is linked', async () => {
      renderGoalReport({ meta: {} });
      await waitForReport();

      expect(screen.getByText(/Link a tag to this goal/)).toBeInTheDocument();
    });

    it('updates the description when a tag is chosen', async () => {
      const user = userEvent.setup();
      renderGoalReport({ meta: {} });
      await waitForReport();

      await chooseTag(user, '#emergency');

      expect(screen.getByText(/Transactions tagged/)).toHaveTextContent(
        '#emergency',
      );
    });
  });

  describe('matching transactions', () => {
    function getListProps() {
      return JSON.parse(
        screen.getByTestId('goal-transactions').textContent ?? '{}',
      );
    }

    it('lists the transactions for the saved tag, filters and time frame', async () => {
      renderGoalReport({
        meta: {
          linkedTag: 'vacation',
          conditions: [TEST_CONDITION],
          conditionsOp: 'or',
          timeFrame: STATIC_TIME_FRAME,
        },
      });
      await waitForReport();

      await waitFor(() =>
        expect(getListProps()).toEqual({
          start: '2024-01-01',
          end: '2024-06-30',
          conditions: 1,
          conditionsOp: 'or',
          linkedTag: 'vacation',
        }),
      );
    });

    it('updates the list from unsaved tag, filter and date changes', async () => {
      const user = userEvent.setup();
      renderGoalReport({
        meta: { linkedTag: 'vacation', timeFrame: STATIC_TIME_FRAME },
      });
      await waitForReport();

      await chooseTag(user, '#emergency');
      await user.click(screen.getByRole('button', { name: 'Add filter' }));
      await user.click(screen.getByRole('button', { name: 'Change dates' }));

      expect(getListProps()).toEqual({
        start: '2025-01-01',
        end: '2025-03-31',
        conditions: 1,
        conditionsOp: 'and',
        linkedTag: 'emergency',
      });
    });

    it('shows no list until a tag is linked', async () => {
      renderGoalReport({ meta: {} });
      await waitForReport();

      expect(screen.queryByTestId('goal-transactions')).not.toBeInTheDocument();
    });
  });

  describe('date range', () => {
    it('loads the transaction date bounds for the header', async () => {
      renderGoalReport({ meta: {} });
      await waitForReport();

      await waitFor(() =>
        expect(screen.getByTestId('header-bounds')).toHaveTextContent(
          '2024-01-05 2024-06-20',
        ),
      );
    });

    it('lists every month from the earliest transaction to now, newest first', async () => {
      renderGoalReport({ meta: {} });
      await waitForReport();

      const expectedMonths = monthUtils
        .rangeInclusive('2024-01', monthUtils.currentMonth())
        .reverse()
        .join(' ');
      await waitFor(() =>
        expect(screen.getByTestId('header-months')).toHaveTextContent(
          expectedMonths,
        ),
      );
    });

    it('shows at least a year of months when there are no transactions', async () => {
      renderGoalReport({ meta: {}, earliest: null, latest: null });
      await waitForReport();

      const today = monthUtils.currentDay();
      await waitFor(() =>
        expect(screen.getByTestId('header-bounds')).toHaveTextContent(
          `${today} ${today}`,
        ),
      );
      const months = screen
        .getByTestId('header-months')
        .textContent?.split(' ');
      expect(months).toHaveLength(13);
      expect(months?.[0]).toBe(monthUtils.currentMonth());
    });

    it('starts from the saved time frame', async () => {
      renderGoalReport({ meta: { timeFrame: STATIC_TIME_FRAME } });
      await waitForReport();

      await waitFor(() =>
        expect(screen.getByTestId('header-range')).toHaveTextContent(
          '2024-01-01 2024-06-30 static',
        ),
      );
      expect(screen.getByText('Jan 2024 - Jun 2024')).toBeInTheDocument();
    });

    it('updates the range when new dates are picked', async () => {
      const user = userEvent.setup();
      renderGoalReport({ meta: { timeFrame: STATIC_TIME_FRAME } });
      await waitForReport();
      await waitFor(() =>
        expect(screen.getByTestId('header-range')).toHaveTextContent(
          '2024-01-01',
        ),
      );

      await user.click(screen.getByRole('button', { name: 'Change dates' }));

      expect(screen.getByTestId('header-range')).toHaveTextContent(
        '2025-01-01 2025-03-31 static',
      );
      expect(screen.getByText('Jan 2025 - Mar 2025')).toBeInTheDocument();
    });
  });

  describe('saving the widget', () => {
    it('saves the goal amount, tag, filters and time frame', async () => {
      const user = userEvent.setup();
      const { updateWidget, store } = renderGoalReport({
        meta: {
          name: 'Vacation',
          targetAmount: 1000000,
          timeFrame: STATIC_TIME_FRAME,
        },
      });
      await waitForReport();
      await waitFor(() =>
        expect(screen.getByTestId('header-range')).toHaveTextContent(
          '2024-01-01',
        ),
      );

      const input = screen.getByLabelText('Goal amount');
      await user.clear(input);
      await user.type(input, '7,500{Enter}');
      await chooseTag(user, '#vacation');
      await user.click(screen.getByRole('button', { name: 'Add filter' }));
      await user.click(screen.getByRole('button', { name: 'Change dates' }));
      await user.click(screen.getByRole('button', { name: 'Save widget' }));

      await waitFor(() =>
        expect(updateWidget).toHaveBeenCalledWith({
          id: WIDGET_ID,
          meta: {
            name: 'Vacation',
            targetAmount: 750000,
            linkedTag: 'vacation',
            conditions: [TEST_CONDITION],
            conditionsOp: 'and',
            timeFrame: {
              start: '2025-01-01',
              end: '2025-03-31',
              mode: 'static',
            },
          },
        }),
      );
      await waitFor(() =>
        expect(store.getState().notifications.notifications).toMatchObject([
          { type: 'message', message: 'Dashboard widget successfully saved.' },
        ]),
      );
    });

    it('removes the linked tag when "No tag" is chosen', async () => {
      const user = userEvent.setup();
      const { updateWidget } = renderGoalReport({
        meta: {
          name: 'Vacation',
          linkedTag: 'vacation',
          timeFrame: STATIC_TIME_FRAME,
        },
      });
      await waitForReport();

      await chooseTag(user, 'No tag');
      await user.click(screen.getByRole('button', { name: 'Save widget' }));

      await waitFor(() => expect(updateWidget).toHaveBeenCalled());
      const savedWidget = updateWidget.mock.calls[0][0] as GoalCardWidget;
      expect(savedWidget.meta).not.toHaveProperty('linkedTag');
      expect(savedWidget.meta).toMatchObject({ name: 'Vacation' });
    });
  });
});

function tagCondition(tag: string): RuleConditionEntity {
  return { field: 'notes', op: 'hasTags', value: `#${tag}`, type: 'string' };
}

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
