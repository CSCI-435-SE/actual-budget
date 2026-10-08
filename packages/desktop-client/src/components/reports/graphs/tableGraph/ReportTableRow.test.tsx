import React from 'react';

import type { GroupedEntity } from '@actual-app/core/types/models';
import { fireEvent, render, screen } from '@testing-library/react';

import { showActivity } from '#components/reports/graphs/showActivity';
import { TestProviders } from '#mocks';

import { ReportTableRow } from './ReportTableRow';

vi.mock('#components/reports/graphs/showActivity', () => ({
  showActivity: vi.fn(),
}));
vi.mock('#hooks/useCategories', () => ({
  useCategories: () => ({ data: { grouped: [], list: [] } }),
}));
vi.mock('#hooks/useAccounts', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('#hooks/useNavigate', () => ({ useNavigate: () => vi.fn() }));

const amounts = {
  totalAssets: 11100,
  totalDebts: -22200,
  totalTotals: -11100,
  netAssets: 0,
  netDebts: -11100,
  totalBudgeted: -11100,
};

function makeRow(isUnallocated: boolean): GroupedEntity {
  return {
    id: 'food',
    name: isUnallocated ? 'Not in a subcategory' : 'Food',
    isUnallocated,
    ...amounts,
    intervalData: [
      {
        date: '2026-09',
        intervalStartDate: '2026-09-01',
        intervalEndDate: '2026-09-30',
        change: 0,
        ...amounts,
      },
    ],
  };
}

function renderRow(
  item: GroupedEntity,
  mode: 'total' | 'time',
  balanceTypeOp: 'totalTotals' | 'totalBudgeted' = 'totalTotals',
) {
  render(
    <TestProviders>
      <ReportTableRow
        item={item}
        balanceTypeOp={balanceTypeOp}
        groupBy="Category"
        mode={mode}
        intervalsCount={1}
        compact={false}
        interval="Monthly"
        isSubcategory
      />
    </TestProviders>,
  );
}

// Every amount on the row that opens the transaction list.
function clickEveryAmount(mode: 'total' | 'time') {
  const texts =
    mode === 'total' ? ['111.00', '-222.00', '-111.00'] : ['-111.00'];
  for (const text of texts) {
    fireEvent.click(screen.getAllByText(text)[0]);
  }
  return texts.length;
}

describe('ReportTableRow drilldown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['total', 'time'] as const)(
    "opens only the parent's own activity from an unallocated row (%s)",
    mode => {
      renderRow(makeRow(true), mode);
      const clicks = clickEveryAmount(mode);

      expect(showActivity).toHaveBeenCalledTimes(clicks);
      for (const [args] of vi.mocked(showActivity).mock.calls) {
        expect(args).toMatchObject({
          id: 'food',
          includeSubcategories: false,
        });
      }
    },
  );

  it('includes subcategories from a parent row', () => {
    renderRow(makeRow(false), 'total');
    const clicks = clickEveryAmount('total');

    expect(showActivity).toHaveBeenCalledTimes(clicks);
    for (const [args] of vi.mocked(showActivity).mock.calls) {
      expect(args).toMatchObject({ includeSubcategories: true });
    }
  });
});

describe('ReportTableRow budgeted totals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Given 150, spent 180: 30 over budget.
  const restaurants: GroupedEntity = {
    id: 'restaurants',
    name: 'Restaurants',
    totalAssets: 15000,
    totalDebts: 0,
    totalTotals: 15000,
    netAssets: 15000,
    netDebts: 0,
    totalBudgeted: 15000,
    totalSpent: -18000,
    intervalData: [],
  };

  it('shows budgeted, spent and remaining side by side', () => {
    renderRow(restaurants, 'total', 'totalBudgeted');

    const cells = screen
      .getAllByText(/^-?\d+\.\d\d$/)
      .map(cell => cell.textContent);
    // Budgeted, Spent, Remaining, then the monthly average budgeted
    expect(cells).toEqual(['150.00', '-180.00', '-30.00', '150.00']);
  });

  it("opens the transactions behind a row's spending", () => {
    renderRow(
      { ...restaurants, isUnallocated: true },
      'total',
      'totalBudgeted',
    );
    fireEvent.click(screen.getByText('-180.00'));

    expect(showActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        balanceTypeOp: 'totalTotals',
        id: 'restaurants',
        includeSubcategories: false,
      }),
    );
  });

  it('keeps the spending columns out of the time view', () => {
    renderRow(restaurants, 'time', 'totalBudgeted');

    expect(screen.queryByText('-180.00')).toBeNull();
  });
});
