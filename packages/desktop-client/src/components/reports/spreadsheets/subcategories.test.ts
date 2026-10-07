import { send } from '@actual-app/core/platform/client/connection';
import type {
  CategoryEntity,
  CategoryGroupEntity,
  DataEntity,
  GroupedEntity,
} from '@actual-app/core/types/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueryDataEntity } from '#components/reports/ReportOptions';
import type { useSpreadsheet } from '#hooks/useSpreadsheet';
import { aqlQuery } from '#queries/aqlQuery';

import { createCustomSpreadsheet } from './custom-spreadsheet';
import { createGroupedSpreadsheet } from './grouped-spreadsheet';
import {
  getNestedSubcategoryIds,
  getRolledUpCategoryIds,
  getSubcategoryIdsByParent,
  hideSubcategoriesOfHiddenParents,
} from './subcategories';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(),
}));
vi.mock('#queries/aqlQuery', () => ({ aqlQuery: vi.fn() }));
// Lets the aqlQuery mock tell the assets query from the debts one.
vi.mock('./makeQuery', () => ({ makeQuery: (type: string) => type }));

const food = { id: 'food', name: 'Food', group: 'g-food', sort_order: 1 };
const restaurants = {
  id: 'restaurants',
  name: 'Restaurants',
  group: 'g-food',
  parent_id: 'food',
  sort_order: 2,
};
const groceries = {
  id: 'groceries',
  name: 'Groceries',
  group: 'g-food',
  parent_id: 'food',
  sort_order: 3,
};
const rent = { id: 'rent', name: 'Rent', group: 'g-bills', sort_order: 4 };

function makeCategories(
  overrides: Partial<Record<string, Partial<CategoryEntity>>> = {},
) {
  const withOverrides = (cat: CategoryEntity) => ({
    ...cat,
    ...overrides[cat.id],
  });
  const grouped = [
    {
      id: 'g-food',
      name: 'Food',
      sort_order: 1,
      categories: [food, restaurants, groceries].map(withOverrides),
    },
    {
      id: 'g-bills',
      name: 'Bills',
      sort_order: 2,
      categories: [rent].map(withOverrides),
    },
  ] satisfies CategoryGroupEntity[];
  return { grouped, list: grouped.flatMap(group => group.categories) };
}

function row(
  category: CategoryEntity,
  amount: number,
  hidden = false,
): QueryDataEntity {
  return {
    date: '2026-09',
    category: category.id,
    categoryHidden: hidden,
    categoryGroup: category.group,
    categoryGroupHidden: false,
    account: 'checking',
    accountOffBudget: false,
    payee: '',
    transferAccount: '',
    amount,
  };
}

// Spent this month: Food directly 10, Restaurants 30, Groceries 50, Rent 100.
const spending = [
  row(food, -1000),
  row(restaurants, -3000),
  row(groceries, -5000),
  row(rent, -10000),
];

const options = {
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  interval: 'Monthly',
  conditions: [],
  conditionsOp: 'and',
  showEmpty: false,
  showOffBudget: false,
  showHiddenCategories: false,
  showUncategorized: false,
  trimIntervals: false,
  // Keeps budget order, so groups and categories come out as listed.
  sortByOp: 'budget' as const,
};

const spreadsheet = {} as ReturnType<typeof useSpreadsheet>;

async function runGrouped(
  categories: ReturnType<typeof makeCategories>,
  balanceTypeOp: 'totalDebts' | 'totalBudgeted' = 'totalDebts',
) {
  let result: GroupedEntity[] = [];
  await createGroupedSpreadsheet({
    ...options,
    categories,
    balanceTypeOp,
  })(spreadsheet, data => (result = data));
  return result;
}

async function runCustom(
  categories: ReturnType<typeof makeCategories>,
  balanceTypeOp: 'totalDebts' | 'totalBudgeted' = 'totalDebts',
) {
  let result: DataEntity | undefined;
  await createCustomSpreadsheet({
    ...options,
    categories,
    groupBy: 'Category',
    balanceTypeOp,
  })(spreadsheet, data => (result = data));
  return result;
}

function byId(rows: GroupedEntity[] | undefined, id: string) {
  return rows?.find(r => r.id === id && !r.isUnallocated);
}

describe('subcategory helpers', () => {
  it('maps each parent to its subcategories', () => {
    const { grouped } = makeCategories();
    const map = getSubcategoryIdsByParent(grouped);

    expect(map).toEqual(new Map([['food', ['restaurants', 'groceries']]]));
    expect(getNestedSubcategoryIds(map)).toEqual(
      new Set(['restaurants', 'groceries']),
    );
    expect(getRolledUpCategoryIds('food', map)).toEqual([
      'food',
      'restaurants',
      'groceries',
    ]);
    expect(getRolledUpCategoryIds('rent', map)).toBeUndefined();
  });

  it('treats a subcategory whose parent is in another group as top-level', () => {
    const grouped = [
      { id: 'g-food', name: 'Food', categories: [food, groceries] },
      {
        id: 'g-bills',
        name: 'Bills',
        categories: [rent, { ...restaurants, group: 'g-bills' }],
      },
    ] satisfies CategoryGroupEntity[];

    expect(getSubcategoryIdsByParent(grouped)).toEqual(
      new Map([['food', ['groceries']]]),
    );
  });

  it('hides the subcategories of a hidden parent', () => {
    const { grouped } = makeCategories({ food: { hidden: true } });
    const rows = hideSubcategoriesOfHiddenParents(spending, grouped);

    expect(rows.map(r => [r.category, r.categoryHidden])).toEqual([
      ['food', false],
      ['restaurants', true],
      ['groceries', true],
      ['rent', false],
    ]);
  });
});

describe('reports with subcategories', () => {
  beforeEach(() => {
    vi.mocked(send).mockImplementation((async (name: string) =>
      name === 'make-filters-from-conditions'
        ? { filters: [] }
        : undefined) as typeof send);
    vi.mocked(aqlQuery).mockImplementation((async (type: unknown) => ({
      data: type === 'debts' ? spending : [],
    })) as typeof aqlQuery);
  });

  it('rolls subcategories into their parent without counting them twice', async () => {
    const [foodGroup] = await runGrouped(makeCategories());

    // The group counts every transaction exactly once.
    expect(foodGroup.totalDebts).toBe(-9000);

    // Only the parent is a top-level row, and it includes its children.
    expect(foodGroup.categories?.map(c => c.id)).toEqual(['food']);
    const foodRow = byId(foodGroup.categories, 'food');
    expect(foodRow?.totalDebts).toBe(-9000);

    // Adding up the top-level rows gives the group total again.
    const topLevelSum = (foodGroup.categories ?? []).reduce(
      (sum, c) => sum + c.totalDebts,
      0,
    );
    expect(topLevelSum).toBe(foodGroup.totalDebts);

    // Under the parent: each subcategory, then what the parent spent itself.
    expect(
      foodRow?.subcategories?.map(c => [
        c.name,
        c.totalDebts,
        !!c.isUnallocated,
      ]),
    ).toEqual([
      ['Restaurants', -3000, false],
      ['Groceries', -5000, false],
      ['Not in a subcategory', -1000, true],
    ]);
    const shownUnderParent = (foodRow?.subcategories ?? []).reduce(
      (sum, c) => sum + c.totalDebts,
      0,
    );
    expect(shownUnderParent).toBe(foodRow?.totalDebts);
  });

  it('labels what a parent kept as unallocated when showing budgets', async () => {
    vi.mocked(send).mockImplementation((async (name: string) => {
      if (name === 'make-filters-from-conditions') {
        return { filters: [] };
      }
      // Food holds 400 in all: it passed 150 + 200 to its subcategories
      // and kept 50 itself.
      return [
        { name: 'budget202609!budget-food', value: 5000 },
        { name: 'budget202609!budget-restaurants', value: 15000 },
        { name: 'budget202609!budget-groceries', value: 20000 },
        { name: 'budget202609!budget-rent', value: 100000 },
      ];
    }) as typeof send);

    const [foodGroup] = await runGrouped(makeCategories(), 'totalBudgeted');
    const foodRow = byId(foodGroup.categories, 'food');

    expect(foodGroup.totalBudgeted).toBe(40000);
    expect(foodRow?.totalBudgeted).toBe(40000);
    expect(foodRow?.subcategories?.map(c => [c.name, c.totalBudgeted])).toEqual(
      [
        ['Restaurants', 15000],
        ['Groceries', 20000],
        ['Unallocated', 5000],
      ],
    );
  });

  it('leaves a category without subcategories as it was', async () => {
    const [, billsGroup] = await runGrouped(makeCategories());
    const rentRow = byId(billsGroup.categories, 'rent');

    expect(rentRow?.totalDebts).toBe(-10000);
    expect(rentRow?.subcategories).toBeUndefined();
  });

  it('gives graphs and totals one row per top-level category', async () => {
    const data = await runCustom(makeCategories());

    expect(data?.data?.map(c => [c.id, c.totalDebts])).toEqual([
      ['food', -9000],
      ['rent', -10000],
    ]);
    expect(data?.totalDebts).toBe(-19000);

    const [month] = data?.intervalData ?? [];
    expect(month.totalDebts).toBe(-19000);
    expect(month).toMatchObject({ food: 9000, rent: 10000 });
    expect(month).not.toHaveProperty('restaurants');
    expect(month).not.toHaveProperty('groceries');
  });

  it('hides subcategories along with a hidden parent', async () => {
    const categories = makeCategories({ food: { hidden: true } });
    vi.mocked(aqlQuery).mockImplementation((async (type: unknown) => ({
      data:
        type === 'debts' ? [row(food, -1000, true), ...spending.slice(1)] : [],
    })) as typeof aqlQuery);

    const data = await runCustom(categories);

    expect(data?.totalDebts).toBe(-10000);
    expect(data?.data?.map(c => c.id)).toEqual(['rent']);
  });
});

describe('budgeted reports compare budgets with spending', () => {
  // Food kept 50 itself and spent 10 of it. Restaurants was given 150 and
  // spent 180. Groceries was given nothing but spent 25. Rent was given
  // 1,000 and spent all of it.
  const cells = {
    food: [5000, -1000],
    restaurants: [15000, -18000],
    groceries: [0, -2500],
    rent: [100000, -100000],
  };

  beforeEach(() => {
    vi.mocked(send).mockImplementation((async (name: string) => {
      if (name === 'make-filters-from-conditions') {
        return { filters: [] };
      }
      return Object.entries(cells).flatMap(([id, [budget, spent]]) => [
        { name: `budget202609!budget-${id}`, value: budget },
        { name: `budget202609!sum-amount-${id}`, value: spent },
      ]);
    }) as typeof send);
    vi.mocked(aqlQuery).mockImplementation((async (type: unknown) => ({
      data: type === 'debts' ? spending : [],
    })) as typeof aqlQuery);
  });

  function comparison(row: GroupedEntity | undefined) {
    return row && [row.name, row.totalBudgeted, row.totalSpent];
  }

  it('shows what each subcategory was given and spent', async () => {
    const [foodGroup] = await runGrouped(makeCategories(), 'totalBudgeted');
    const foodRow = byId(foodGroup.categories, 'food');

    expect(foodRow?.subcategories?.map(comparison)).toEqual([
      ['Restaurants', 15000, -18000],
      // Kept even without a budget, so its overspending shows
      ['Groceries', 0, -2500],
      ['Unallocated', 5000, -1000],
    ]);
  });

  it('rolls spending into the parent without counting it twice', async () => {
    const [foodGroup] = await runGrouped(makeCategories(), 'totalBudgeted');
    const foodRow = byId(foodGroup.categories, 'food');

    expect(comparison(foodRow)).toEqual(['Food', 20000, -21500]);
    expect(comparison(foodGroup)).toEqual(['Food', 20000, -21500]);
  });

  it('adds up spending for the totals row from top-level rows only', async () => {
    const data = await runCustom(makeCategories(), 'totalBudgeted');

    expect(data?.data?.map(comparison)).toEqual([
      ['Food', 20000, -21500],
      ['Rent', 100000, -100000],
    ]);
    expect(data?.totalSpent).toBe(-121500);
    expect(data?.intervalData[0].totalSpent).toBe(-121500);
  });

  it('leaves spending out of other report types', async () => {
    const data = await runCustom(makeCategories());

    expect(data?.totalSpent).toBeUndefined();
    expect(data?.data?.[0].totalSpent).toBeUndefined();
  });
});
