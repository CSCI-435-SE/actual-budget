import type { CategoryGroupEntity } from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import {
  buildBudgetMonthCsv,
  getBudgetMonthCsvFilename,
} from './budgetMonthCsv';

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

function build({
  groups = categoryGroups,
  cells = makeCells(),
  showHiddenCategories = false,
  decimalPlaces = 2,
}: {
  groups?: CategoryGroupEntity[];
  cells?: Map<string, unknown>;
  showHiddenCategories?: boolean;
  decimalPlaces?: number;
} = {}) {
  return buildBudgetMonthCsv({
    month,
    categoryGroups: groups,
    cells,
    showHiddenCategories,
    decimalPlaces,
  });
}

const lines = (csv: string) => csv.trimEnd().split('\n');

describe('buildBudgetMonthCsv', () => {
  it('lists groups, categories, income, the total and To Budget in page order', () => {
    expect(lines(build())).toEqual([
      'Category Group,Category,Budgeted,Spent,Balance',
      'Bills,,1500,-1400,100',
      'Bills,Rent,1200,-1200,0',
      'Income,,,3000,',
      'Income,Salary,,3000,',
      'Total,,2000,-1400,600',
      'To Budget,,,,1000',
    ]);
  });

  it('uses group cells for subtotals even when hidden categories are left out', () => {
    // Power is hidden, but the envelope group total still counts it.
    expect(lines(build())[1]).toBe('Bills,,1500,-1400,100');
  });

  it('includes hidden groups and categories when the toggle is on', () => {
    expect(lines(build({ showHiddenCategories: true }))).toEqual([
      'Category Group,Category,Budgeted,Spent,Balance',
      'Bills,,1500,-1400,100',
      'Bills,Rent,1200,-1200,0',
      'Bills,Power,300,-200,100',
      'Savings,,500,0,500',
      'Savings,Emergency,500,0,500',
      'Income,,,3000,',
      'Income,Salary,,3000,',
      'Total,,2000,-1400,600',
      'To Budget,,,,1000',
    ]);
  });

  it('always includes the income group, even when it is marked hidden', () => {
    const groups = categoryGroups.map(group =>
      group.is_income ? { ...group, hidden: true } : group,
    );
    expect(lines(build({ groups }))).toContain('Income,,,3000,');
  });

  it('uses the carried-over balance rather than budgeted plus spent', () => {
    const csv = build({
      cells: makeCells({
        // 250 rolled over from last month; overspent by 50 with carryover on.
        'leftover-rent': 25000,
        'budget-power': 10000,
        'sum-amount-power': -15000,
        'leftover-power': -5000,
      }),
      showHiddenCategories: true,
    });
    expect(lines(csv)).toContain('Bills,Rent,1200,-1200,250');
    expect(lines(csv)).toContain('Bills,Power,100,-150,-50');
  });

  it('labels a negative To Budget as Overbudgeted', () => {
    const csv = build({ cells: makeCells({ 'to-budget': -2550 }) });
    expect(lines(csv).at(-1)).toBe('Overbudgeted,,,,-25.5');
  });

  it('treats missing cells as zero', () => {
    expect(lines(build({ cells: new Map() })).at(-2)).toBe('Total,,0,0,0');
  });

  it('does not scale amounts for a zero-decimal currency', () => {
    expect(lines(build({ decimalPlaces: 0 }))[1]).toBe(
      'Bills,,150000,-140000,10000',
    );
  });

  it('keeps negative amounts numeric rather than escaping them as formulas', () => {
    expect(lines(build())[1]).not.toContain("'");
  });

  it('quotes names containing commas, quotes and newlines', () => {
    const groups: CategoryGroupEntity[] = [
      {
        id: 'bills',
        name: 'Food, "Fun"',
        categories: [{ id: 'rent', name: 'Line\nBreak', group: 'bills' }],
      },
    ];
    const csv = build({ groups });
    expect(csv).toContain('"Food, ""Fun""",,1500,-1400,100\n');
    expect(csv).toContain('"Food, ""Fun""","Line\nBreak",1200,-1200,0\n');
  });

  it('prefixes names that spreadsheet apps would read as formulas', () => {
    const groups: CategoryGroupEntity[] = [
      {
        id: 'bills',
        name: '=SUM(A1)',
        categories: [{ id: 'rent', name: '@rent', group: 'bills' }],
      },
    ];
    const csv = lines(build({ groups }));
    expect(csv[1]).toBe("'=SUM(A1),,1500,-1400,100");
    expect(csv[2]).toBe("'=SUM(A1),'@rent,1200,-1200,0");
  });
});

describe('getBudgetMonthCsvFilename', () => {
  it('combines the budget name and month', () => {
    expect(getBudgetMonthCsvFilename('My Budget', month)).toBe(
      'My Budget-2026-01.csv',
    );
  });

  it('strips characters that are not allowed in filenames', () => {
    expect(getBudgetMonthCsvFilename('Home/Work: "2026"?', month)).toBe(
      'HomeWork 2026-2026-01.csv',
    );
  });

  it('falls back to a default name', () => {
    expect(getBudgetMonthCsvFilename(undefined, month)).toBe(
      'budget-2026-01.csv',
    );
    expect(getBudgetMonthCsvFilename('???', month)).toBe('budget-2026-01.csv');
  });
});
