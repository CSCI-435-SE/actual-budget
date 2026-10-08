import React from 'react';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import type {
  AccountEntity,
  CategoryEntity,
  PayeeEntity,
  RuleConditionEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';

import { getSummaryDateBounds } from '#components/reports/spreadsheets/summary-spreadsheet';
import { useTransactions } from '#hooks/useTransactions';
import { TestProviders } from '#mocks';
import { clearServer, initServer } from '#mocks/connection';

import {
  GoalTransactions,
  makeGoalTransactionsQuery,
} from './GoalTransactions';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));
vi.mock('#hooks/useDateFormat', () => ({
  useDateFormat: () => 'MM/dd/yyyy',
}));
vi.mock('#hooks/useTransactions', () => ({
  useTransactions: vi.fn(),
}));
vi.mock('#hooks/useAccounts', () => ({
  useAccounts: () => ({ data: ACCOUNTS }),
}));
vi.mock('#hooks/usePayees', () => ({
  usePayeesById: () => ({
    data: Object.fromEntries(PAYEES.map(payee => [payee.id, payee])),
  }),
}));
vi.mock('#hooks/useCategories', () => ({
  useCategoriesById: () => ({
    data: {
      list: Object.fromEntries(
        CATEGORIES.map(category => [category.id, category]),
      ),
    },
  }),
}));

const ACCOUNTS = [
  { id: 'acct-1', name: 'Checking' },
  { id: 'acct-2', name: 'Savings' },
] as AccountEntity[];
const PAYEES = [
  { id: 'payee-1', name: 'Airline' },
  { id: 'payee-transfer', name: '', transfer_acct: 'acct-2' },
] as PayeeEntity[];
const CATEGORIES = [{ id: 'cat-1', name: 'Travel' }] as CategoryEntity[];

const TRANSACTIONS = [
  {
    id: 'tx-1',
    date: '2024-03-15',
    account: 'acct-1',
    payee: 'payee-1',
    notes: '#vacation flight',
    category: 'cat-1',
    amount: -25000,
  },
  {
    id: 'tx-2',
    date: '2024-03-10',
    account: 'acct-1',
    payee: 'payee-transfer',
    notes: '#vacation savings',
    amount: 10000,
  },
] as TransactionEntity[];

const TRIP_CONDITION: RuleConditionEntity = {
  field: 'notes',
  op: 'contains',
  value: 'trip',
  type: 'string',
};
const AMOUNT_CONDITION: RuleConditionEntity = {
  field: 'amount',
  op: 'gt',
  value: 0,
  type: 'number',
};

function mockTransactions(transactions: TransactionEntity[]) {
  vi.mocked(useTransactions).mockReturnValue({
    transactions,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useTransactions>);
}

function renderGoalTransactions() {
  return render(
    <TestProviders>
      <GoalTransactions
        start="2024-03-01"
        end="2024-03-31"
        linkedTag="vacation"
      />
    </TestProviders>,
  );
}

/**
 * The transaction rows (the header row shares the `row` test id).
 */
async function findRows() {
  await screen.findByText('Airline');
  return screen
    .getAllByTestId('row')
    .filter(row => within(row).queryByTestId('payee'));
}

beforeEach(() => {
  vi.clearAllMocks();
  (useResponsive as unknown as Mock).mockReturnValue({ isNarrowWidth: false });
  // Turn each condition into a recognisable filter so tests can see which
  // conditions ended up where.
  initServer({
    'make-filters-from-conditions': (args: unknown) => {
      const { conditions } = args as { conditions: RuleConditionEntity[] };
      return {
        filters: conditions.map(cond => ({ [cond.field]: cond.value })),
      };
    },
  });
});

afterEach(async () => {
  await clearServer();
});

describe('GoalTransactions', () => {
  it('lists each transaction with its details', async () => {
    mockTransactions(TRANSACTIONS);
    renderGoalTransactions();

    const [flight, transfer] = await findRows();
    expect(flight).toHaveTextContent('03/15/2024');
    expect(flight).toHaveTextContent('Checking');
    expect(flight).toHaveTextContent('Airline');
    expect(flight).toHaveTextContent('#vacation flight');
    expect(flight).toHaveTextContent('Travel');
    expect(flight).toHaveTextContent('-250.00');
    // Transfers show the other account as the payee.
    expect(transfer).toHaveTextContent('Savings');
    expect(transfer).toHaveTextContent('100.00');
  });

  it('is display only: clicking cells opens no editors or menus', async () => {
    const user = userEvent.setup();
    mockTransactions(TRANSACTIONS);
    renderGoalTransactions();

    const [row] = await findRows();
    for (const field of ['date', 'account', 'payee', 'notes', 'category']) {
      await user.click(within(row).getByTestId(field));
    }

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Split transaction')).not.toBeInTheDocument();
    // Tags are shown as labels, not buttons.
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
  });

  it('hides the account and category columns on narrow screens', async () => {
    (useResponsive as unknown as Mock).mockReturnValue({ isNarrowWidth: true });
    mockTransactions(TRANSACTIONS);
    renderGoalTransactions();

    const [row] = await findRows();
    expect(within(row).queryByTestId('account')).not.toBeInTheDocument();
    expect(within(row).queryByTestId('category')).not.toBeInTheDocument();
    expect(row).toHaveTextContent('Airline');
  });

  it('says when nothing matches', async () => {
    mockTransactions([]);
    renderGoalTransactions();

    expect(
      await screen.findByText('No matching transactions'),
    ).toBeInTheDocument();
  });
});

describe('makeGoalTransactionsQuery', () => {
  it('requires the tag and joins the goal conditions with conditionsOp', async () => {
    const query = await makeGoalTransactionsQuery({
      start: '2024-01-01',
      end: '2024-06-30',
      conditions: [TRIP_CONDITION, AMOUNT_CONDITION],
      conditionsOp: 'or',
      linkedTag: 'vacation',
    });

    expect(query.serialize().filterExpressions).toEqual([
      { $and: [{ notes: '#vacation' }] },
      { $or: [{ notes: 'trip' }, { amount: 0 }] },
      {
        $and: [
          { date: { $gte: '2024-01-01' } },
          { date: { $lte: '2024-06-30' } },
        ],
      },
    ]);
  });

  it('lists split lines individually, newest first, like the goal total', async () => {
    const query = await makeGoalTransactionsQuery({
      start: '2024-01-01',
      end: '2024-06-30',
      linkedTag: 'vacation',
    });

    const { tableOptions, orderExpressions } = query.serialize();
    expect(tableOptions).toEqual({ splits: 'inline' });
    expect(orderExpressions).toEqual([{ date: 'desc' }]);
  });

  it('uses the same dates as the goal total', async () => {
    const query = await makeGoalTransactionsQuery({
      start: '2024-03-15',
      end: '2024-05-10',
      linkedTag: 'vacation',
    });

    const { startDate, endDate } = getSummaryDateBounds(
      '2024-03-15',
      '2024-05-10',
    );
    expect(query.serialize().filterExpressions[2]).toEqual({
      $and: [{ date: { $gte: startDate } }, { date: { $lte: endDate } }],
    });
    expect(startDate).toBe('2024-03-01');
    expect(endDate).toBe('2024-05-31');
  });

  it('defaults to "and" and skips named custom conditions', async () => {
    const query = await makeGoalTransactionsQuery({
      start: '2024-01-01',
      end: '2024-06-30',
      conditions: [TRIP_CONDITION, { ...AMOUNT_CONDITION, customName: 'x' }],
      linkedTag: 'vacation',
    });

    expect(query.serialize().filterExpressions[1]).toEqual({
      $and: [{ notes: 'trip' }],
    });
  });
});
