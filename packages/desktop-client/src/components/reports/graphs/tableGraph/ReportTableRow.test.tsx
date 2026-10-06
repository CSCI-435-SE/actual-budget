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

function renderRow(item: GroupedEntity, mode: 'total' | 'time') {
  render(
    <TestProviders>
      <ReportTableRow
        item={item}
        balanceTypeOp="totalTotals"
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
