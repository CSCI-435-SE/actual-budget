import type { CategoryGroupEntity } from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { buildBudgetMonthPdfRows } from './budgetMonthPdfRows';

const month = '2026-01';

const categoryGroups: CategoryGroupEntity[] = [
  {
    id: 'bills',
    name: 'Bills',
    categories: [
      { id: 'rent', name: 'Rent', group: 'bills' },
      { id: 'power', name: 'Power', group: 'bills', hidden: true },
    ],
  },
  {
    id: 'savings',
    name: 'Savings',
    hidden: true,
    categories: [{ id: 'emergency', name: 'Emergency', group: 'savings' }],
  },
  {
    id: 'income',
    name: 'Income',
    is_income: true,
    categories: [{ id: 'salary', name: 'Salary', group: 'income' }],
  },
];

const baseCells: Record<string, number> = {
  'group-budget-bills': 150000,
  'group-sum-amount-bills': -140000,
  'group-leftover-bills': 10000,
  'budget-rent': 120000,
  'sum-amount-rent': -120000,
  'leftover-rent': 0,
  'budget-power': 30000,
  'sum-amount-power': -20000,
  'leftover-power': 10000,
  'group-budget-savings': 50000,
  'group-sum-amount-savings': 0,
  'group-leftover-savings': 50000,
  'budget-emergency': 50000,
  'sum-amount-emergency': 0,
  'leftover-emergency': 50000,
  'total-income': 300000,
  'sum-amount-salary': 300000,
  'total-budgeted': -200000,
  'total-spent': -140000,
  'total-leftover': 60000,
  'to-budget': 100000,
};

function makeCells(overrides: Record<string, number> = {}) {
  return new Map<string, unknown>(
    Object.entries({ ...baseCells, ...overrides }).map(([name, value]) => [
      `budget202601!${name}`,
      value,
    ]),
  );
}

// A stub formatter that just converts cents to a dollar string. Using
// something other than the app's real currency formatter proves the row
// builder applies whatever formatter it's given verbatim, rather than
// depending on a specific currency implementation.
const formatAmount = (value: number) => `$${(value / 100).toFixed(2)}`;

function build({
  groups = categoryGroups,
  cells = makeCells(),
  showHiddenCategories = false,
}: {
  groups?: CategoryGroupEntity[];
  cells?: Map<string, unknown>;
  showHiddenCategories?: boolean;
} = {}) {
  return buildBudgetMonthPdfRows({
    month,
    categoryGroups: groups,
    cells,
    showHiddenCategories,
    formatAmount,
  });
}

describe('buildBudgetMonthPdfRows', () => {
  it('lists groups, categories, income, the total and To Budget in page order with row types', () => {
    expect(build()).toEqual([
      {
        type: 'groupHeader',
        categoryGroup: 'Bills',
        category: '',
        budgeted: '$1500.00',
        spent: '$-1400.00',
        balance: '$100.00',
      },
      {
        type: 'category',
        categoryGroup: 'Bills',
        category: 'Rent',
        budgeted: '$1200.00',
        spent: '$-1200.00',
        balance: '$0.00',
      },
      {
        type: 'groupHeader',
        categoryGroup: 'Income',
        category: '',
        budgeted: '',
        spent: '$3000.00',
        balance: '',
      },
      {
        type: 'category',
        categoryGroup: 'Income',
        category: 'Salary',
        budgeted: '',
        spent: '$3000.00',
        balance: '',
      },
      {
        type: 'grandTotal',
        categoryGroup: 'Total',
        category: '',
        budgeted: '$2000.00',
        spent: '$-1400.00',
        balance: '$600.00',
      },
      {
        type: 'grandTotal',
        categoryGroup: 'To Budget',
        category: '',
        budgeted: '',
        spent: '',
        balance: '$1000.00',
      },
    ]);
  });

  it('tags a group with no visible categories as a groupHeader row with no category rows beneath it', () => {
    const groups: CategoryGroupEntity[] = [
      {
        id: 'bills',
        name: 'Bills',
        categories: [
          { id: 'power', name: 'Power', group: 'bills', hidden: true },
        ],
      },
    ];
    const rows = build({
      groups,
      cells: makeCells(),
    });
    expect(rows[0]).toMatchObject({
      type: 'groupHeader',
      categoryGroup: 'Bills',
    });
    expect(rows[1]).toMatchObject({ type: 'grandTotal' });
  });

  it('uses group cells for subtotals even when hidden categories are left out', () => {
    // Power is hidden, but the envelope group total still counts it.
    expect(build()[0]).toMatchObject({
      type: 'groupHeader',
      budgeted: '$1500.00',
      spent: '$-1400.00',
      balance: '$100.00',
    });
  });

  it('includes hidden groups and categories when the toggle is on', () => {
    const rows = build({ showHiddenCategories: true });
    expect(rows.map(r => [r.type, r.categoryGroup, r.category])).toEqual([
      ['groupHeader', 'Bills', ''],
      ['category', 'Bills', 'Rent'],
      ['category', 'Bills', 'Power'],
      ['groupHeader', 'Savings', ''],
      ['category', 'Savings', 'Emergency'],
      ['groupHeader', 'Income', ''],
      ['category', 'Income', 'Salary'],
      ['grandTotal', 'Total', ''],
      ['grandTotal', 'To Budget', ''],
    ]);
  });

  it('always includes the income group, even when it is marked hidden', () => {
    const groups = categoryGroups.map(group =>
      group.is_income ? { ...group, hidden: true } : group,
    );
    const rows = build({ groups });
    expect(rows).toContainEqual(
      expect.objectContaining({ type: 'groupHeader', categoryGroup: 'Income' }),
    );
  });

  it('uses the carried-over balance rather than budgeted plus spent', () => {
    const rows = build({
      cells: makeCells({
        // 250 rolled over from last month; overspent by 50 with carryover on.
        'leftover-rent': 25000,
        'budget-power': 10000,
        'sum-amount-power': -15000,
        'leftover-power': -5000,
      }),
      showHiddenCategories: true,
    });
    expect(rows).toContainEqual(
      expect.objectContaining({
        category: 'Rent',
        budgeted: '$1200.00',
        spent: '$-1200.00',
        balance: '$250.00',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        category: 'Power',
        budgeted: '$100.00',
        spent: '$-150.00',
        balance: '$-50.00',
      }),
    );
  });

  it('labels a negative To Budget as Overbudgeted', () => {
    const rows = build({ cells: makeCells({ 'to-budget': -2550 }) });
    expect(rows.at(-1)).toEqual({
      type: 'grandTotal',
      categoryGroup: 'Overbudgeted',
      category: '',
      budgeted: '',
      spent: '',
      balance: '$-25.50',
    });
  });

  it('treats missing cells as zero', () => {
    const rows = build({ cells: new Map() });
    expect(rows.find(r => r.categoryGroup === 'Total')).toEqual({
      type: 'grandTotal',
      categoryGroup: 'Total',
      category: '',
      budgeted: '$0.00',
      spent: '$0.00',
      balance: '$0.00',
    });
  });

  it('leaves blank income cells blank instead of formatting them as zero', () => {
    const rows = build();
    const incomeGroupRow = rows.find(
      r => r.type === 'groupHeader' && r.categoryGroup === 'Income',
    );
    expect(incomeGroupRow).toMatchObject({ budgeted: '', balance: '' });
  });
});
