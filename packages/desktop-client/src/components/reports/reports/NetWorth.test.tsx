import React from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  clearServer,
  initServer,
} from '@actual-app/core/platform/client/connection';
import type {
  NetWorthWidget,
  RuleConditionEntity,
  TimeFrame,
} from '@actual-app/core/types/models';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';

import { useReport } from '#components/reports/useReport';
import { useNavigate } from '#hooks/useNavigate';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';

import { NetWorth } from './NetWorth';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('#hooks/useNavigate');
vi.mock('#hooks/useAccounts', () => ({
  useAccounts: () => ({ data: [] }),
}));
vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: () => [undefined, vi.fn()],
}));
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));
// The spreadsheet queries the backend; tests control its result through
// `useReport` instead.
vi.mock('#components/reports/spreadsheets/net-worth-spreadsheet', () => ({
  createSpreadsheet: vi.fn(() => async () => undefined),
}));
vi.mock('#components/reports/useReport', () => ({
  useReport: vi.fn(() => null),
}));
vi.mock('#components/reports/graphs/NetWorthGraph', () => ({
  NetWorthGraph: () => <div data-testid="net-worth-graph" />,
}));

const SAVED_TIME_FRAME: TimeFrame = {
  start: '2024-01',
  end: '2024-06',
  mode: 'static',
};
const ACCOUNT_FILTER: RuleConditionEntity = {
  field: 'account',
  op: 'is',
  value: 'acct-1',
  type: 'id',
};

// The real Header pulls in the filter menus and date pickers. This stub lets
// tests change the date range, put it back, and add a filter.
vi.mock('#components/reports/Header', () => ({
  Header: ({
    start,
    end,
    mode,
    onChangeDates,
    onApply,
    children,
  }: {
    start: string;
    end: string;
    mode: TimeFrame['mode'];
    onChangeDates: (
      start: string,
      end: string,
      mode: TimeFrame['mode'],
    ) => void;
    onApply: (condition: RuleConditionEntity) => void;
    children?: ReactNode;
  }) => (
    <div>
      <span data-testid="header-range">{`${start} ${end} ${mode}`}</span>
      <button onClick={() => onChangeDates('2024-03', '2024-06', 'static')}>
        Change dates
      </button>
      <button onClick={() => onChangeDates('2024-01', '2024-06', 'static')}>
        Restore dates
      </button>
      <button
        onClick={() =>
          onApply({
            field: 'account',
            op: 'is',
            value: 'acct-1',
            type: 'id',
          })
        }
      >
        Add filter
      </button>
      {children}
    </div>
  ),
}));

const WIDGET_ID = 'net-worth-widget-1';

function makeWidget(meta: NetWorthWidget['meta']): NetWorthWidget {
  return {
    id: WIDGET_ID,
    dashboard_page_id: 'page-1',
    type: 'net-worth-card',
    x: 0,
    y: 0,
    width: 4,
    height: 2,
    meta,
    tombstone: false,
  };
}

function renderNetWorth({
  path = `/reports/net-worth/${WIDGET_ID}`,
}: { path?: string } = {}) {
  let widgets = [
    makeWidget({ name: 'My net worth', timeFrame: SAVED_TIME_FRAME }),
  ];
  const updateWidget = vi.fn(async (update: unknown) => {
    const { id, meta } = update as Pick<NetWorthWidget, 'id' | 'meta'>;
    widgets = widgets.map(widget =>
      widget.id === id ? { ...widget, meta } : widget,
    );
  });
  initServer({
    query: () => Promise.resolve({ data: widgets, dependencies: [] }),
    'get-earliest-transaction': async () => ({ date: '2023-01-05' }),
    'get-latest-transaction': async () => ({ date: '2024-06-20' }),
    'dashboard-update-widget': updateWidget,
  });
  const queryClient = createTestQueryClient();
  const store = configureTestAppStore({ queryClient });

  render(
    <TestProviders queryClient={queryClient} store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/reports/net-worth" element={<NetWorth />} />
          <Route path="/reports/net-worth/:id" element={<NetWorth />} />
        </Routes>
      </MemoryRouter>
    </TestProviders>,
  );

  return { updateWidget };
}

async function waitForSavedRange() {
  await waitFor(() =>
    expect(screen.getByTestId('header-range')).toHaveTextContent(
      '2024-01 2024-06 static',
    ),
  );
}

describe('NetWorth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    vi.mocked(useReport).mockReturnValue({
      netWorth: 0,
      totalChange: 0,
      totalChangePercent: 0,
      graphData: { data: [], hasNegative: false, start: '', end: '' },
      accounts: [],
    });
    (useResponsive as unknown as Mock).mockReturnValue({
      isNarrowWidth: false,
    });
  });

  afterEach(async () => {
    await clearServer();
  });

  it('shows "(modified)" only while the settings differ from the saved widget', async () => {
    const user = userEvent.setup();
    const { updateWidget } = renderNetWorth();
    await waitForSavedRange();
    expect(screen.queryByText('(modified)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change dates' }));
    expect(screen.getByText('(modified)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restore dates' }));
    expect(screen.queryByText('(modified)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add filter' }));
    expect(screen.getByText('(modified)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save widget' }));
    await waitFor(() =>
      expect(updateWidget).toHaveBeenCalledWith({
        id: WIDGET_ID,
        meta: {
          name: 'My net worth',
          conditions: [ACCOUNT_FILTER],
          conditionsOp: 'and',
          interval: 'Monthly',
          mode: 'trend',
          timeFrame: SAVED_TIME_FRAME,
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('(modified)')).not.toBeInTheDocument(),
    );
  });

  it('shows the label in the mobile header too', async () => {
    (useResponsive as unknown as Mock).mockReturnValue({
      isNarrowWidth: true,
    });
    const user = userEvent.setup();
    renderNetWorth();
    await waitForSavedRange();

    await user.click(screen.getByRole('button', { name: 'Change dates' }));

    expect(screen.getByText('(modified)')).toBeInTheDocument();
  });

  it('never shows the label without a widget', async () => {
    const user = userEvent.setup();
    renderNetWorth({ path: '/reports/net-worth' });
    await screen.findByTestId('header-range');

    await user.click(screen.getByRole('button', { name: 'Change dates' }));

    expect(screen.queryByText('(modified)')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save widget' }),
    ).not.toBeInTheDocument();
  });
});
