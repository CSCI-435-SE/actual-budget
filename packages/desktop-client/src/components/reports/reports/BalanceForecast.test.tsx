import React from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

import {
  clearServer,
  initServer,
} from '@actual-app/core/platform/client/connection';
import type {
  BalanceForecastWidget,
  TimeFrame,
} from '@actual-app/core/types/models';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';

import { BalanceForecast } from './BalanceForecast';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('#hooks/useAccounts', () => ({
  useAccounts: () => ({ data: [] }),
}));
vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: () => [undefined, vi.fn()],
}));
// The forecast queries the backend; an empty forecast is enough here.
vi.mock('#hooks/useBalanceForecast', () => ({
  useBalanceForecast: () => ({
    data: null,
    error: null,
    isFetching: false,
    isPlaceholderData: false,
    isPending: false,
  }),
}));

// The real Header pulls in the filter menus and date pickers. This stub lets
// tests change the date range and put it back.
vi.mock('#components/reports/Header', () => ({
  Header: ({
    start,
    end,
    mode,
    onChangeDates,
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
    children?: ReactNode;
  }) => (
    <div>
      <span data-testid="header-range">{`${start} ${end} ${mode}`}</span>
      <button onClick={() => onChangeDates('2025-03', '2025-12', 'static')}>
        Change dates
      </button>
      <button onClick={() => onChangeDates('2025-01', '2025-12', 'static')}>
        Restore dates
      </button>
      {children}
    </div>
  ),
}));

const WIDGET_ID = 'balance-forecast-widget-1';
const SAVED_TIME_FRAME: TimeFrame = {
  start: '2025-01',
  end: '2025-12',
  mode: 'static',
};

function makeWidget(
  meta: BalanceForecastWidget['meta'],
): BalanceForecastWidget {
  return {
    id: WIDGET_ID,
    dashboard_page_id: 'page-1',
    type: 'balance-forecast-card',
    x: 0,
    y: 0,
    width: 4,
    height: 2,
    meta,
    tombstone: false,
  };
}

function renderBalanceForecast({
  path = `/reports/forecast/${WIDGET_ID}`,
}: { path?: string } = {}) {
  let widgets = [
    makeWidget({ name: 'Checking forecast', timeFrame: SAVED_TIME_FRAME }),
  ];
  const updateWidget = vi.fn(async (update: unknown) => {
    const { id, meta } = update as Pick<BalanceForecastWidget, 'id' | 'meta'>;
    widgets = widgets.map(widget =>
      widget.id === id ? { ...widget, meta } : widget,
    );
  });
  initServer({
    query: () => Promise.resolve({ data: widgets, dependencies: [] }),
    'get-earliest-transaction': async () => ({ date: '2024-01-05' }),
    'dashboard-update-widget': updateWidget,
  });
  const queryClient = createTestQueryClient();
  const store = configureTestAppStore({ queryClient });

  render(
    <TestProviders queryClient={queryClient} store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/reports/forecast" element={<BalanceForecast />} />
          <Route path="/reports/forecast/:id" element={<BalanceForecast />} />
        </Routes>
      </MemoryRouter>
    </TestProviders>,
  );

  return { updateWidget };
}

describe('BalanceForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await clearServer();
  });

  it('shows the widget name in the page header', async () => {
    renderBalanceForecast();
    expect(await screen.findByText('Checking forecast')).toBeInTheDocument();
  });

  it('shows "(modified)" only while the settings differ from the saved widget', async () => {
    const user = userEvent.setup();
    const { updateWidget } = renderBalanceForecast();
    await screen.findByTestId('header-range');
    expect(screen.queryByText('(modified)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change dates' }));
    expect(screen.getByText('(modified)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restore dates' }));
    expect(screen.queryByText('(modified)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change dates' }));
    await user.click(screen.getByRole('button', { name: 'Save widget' }));
    await waitFor(() =>
      expect(updateWidget).toHaveBeenCalledWith({
        id: WIDGET_ID,
        meta: {
          name: 'Checking forecast',
          conditions: [],
          conditionsOp: 'and',
          startDate: '2025-03',
          endDate: '2025-12',
          granularity: 'Monthly',
          source: 'schedules',
          timeFrame: { start: '2025-03', end: '2025-12', mode: 'static' },
        },
      }),
    );
    // Saving refreshes the cached widget, so the label follows the new
    // settings instead of staying stuck on "(modified)".
    await waitFor(() =>
      expect(screen.queryByText('(modified)')).not.toBeInTheDocument(),
    );

    // Going back to the old range now differs from what was just saved.
    await user.click(screen.getByRole('button', { name: 'Restore dates' }));
    expect(screen.getByText('(modified)')).toBeInTheDocument();
  });

  it('never shows the label without a widget', async () => {
    const user = userEvent.setup();
    renderBalanceForecast({ path: '/reports/forecast' });
    await screen.findByTestId('header-range');

    await user.click(screen.getByRole('button', { name: 'Change dates' }));

    expect(screen.queryByText('(modified)')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save widget' }),
    ).not.toBeInTheDocument();
  });
});
