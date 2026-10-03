import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { runHandler } from '#server/mutators';
import * as sheet from '#server/sheet';
import * as monthUtils from '#shared/months';
import { q } from '#shared/query';
import type { CategoryGroupEntity } from '#types/models';
import type { Template } from '#types/models/templates';

import {
  copyPreviousMonth,
  copyUntilYearEnd,
  coverOverspending,
  getBudget,
  getSheetValue,
  setBudget,
  setZero,
  transferAvailable,
  transferCategory,
} from './actions';
import { app } from './app';
import { createAllBudgets, createBudget } from './base';
import {
  applyTemplate,
  dryRunCategoryTemplate,
  storeTemplates,
} from './goal-template';

beforeEach(global.emptyDatabase());

async function getCategory(id: string) {
  const category = await db.first<db.DbCategory>(
    'SELECT * FROM categories WHERE id = ?',
    [id],
  );
  if (!category) {
    throw new Error(`Category ${id} not found`);
  }
  return category;
}

async function setupCategories() {
  await db.insertCategoryGroup({ id: 'group1', name: 'group1' });
  await db.insertCategoryGroup({ id: 'group2', name: 'group2' });
  await db.insertCategoryGroup({ id: 'income', name: 'income', is_income: 1 });
  await db.insertCategory({ id: 'food', name: 'food', cat_group: 'group1' });
  await db.insertCategory({ id: 'rent', name: 'rent', cat_group: 'group1' });
  await db.insertCategory({
    id: 'restaurants',
    name: 'restaurants',
    cat_group: 'group1',
    parent_id: 'food',
  });
  await db.insertCategory({
    id: 'groceries',
    name: 'groceries',
    cat_group: 'group1',
    parent_id: 'food',
  });
}

describe('Subcategories', () => {
  it('category-create accepts a parent', async () => {
    await db.insertCategoryGroup({ id: 'group1', name: 'group1' });
    await db.insertCategory({ id: 'food', name: 'food', cat_group: 'group1' });

    const id = await runHandler(app.handlers['category-create'], {
      name: 'restaurants',
      groupId: 'group1',
      parentId: 'food',
    });

    expect((await getCategory(id)).parent_id).toBe('food');
  });

  it('lists subcategories right after their parent', async () => {
    await setupCategories();

    const { data: groups }: { data: CategoryGroupEntity[] } = await aqlQuery(
      q('category_groups').filter({ id: 'group1' }).select('*'),
    );
    // New categories are inserted at the top of their group, so by sort
    // order alone this would be groceries, restaurants, rent, food.
    expect(groups[0].categories?.map(cat => cat.id)).toEqual([
      'rent',
      'food',
      'groceries',
      'restaurants',
    ]);
  });

  it('moving a parent to another group brings its subcategories', async () => {
    await setupCategories();

    await runHandler(app.handlers['category-move'], {
      id: 'food',
      groupId: 'group2',
      targetId: null,
    });

    for (const id of ['food', 'restaurants', 'groceries']) {
      expect((await getCategory(id)).cat_group).toBe('group2');
    }
    expect((await getCategory('restaurants')).parent_id).toBe('food');
    expect((await getCategory('rent')).cat_group).toBe('group1');
  });

  it('a subcategory cannot be moved away from its parent', async () => {
    await setupCategories();

    await expect(
      runHandler(app.handlers['category-move'], {
        id: 'restaurants',
        groupId: 'group2',
        targetId: null,
      }),
    ).rejects.toThrow('different group');
  });

  it('a subcategory can be reordered within its group', async () => {
    await setupCategories();

    await runHandler(app.handlers['category-move'], {
      id: 'groceries',
      groupId: 'group1',
      targetId: 'restaurants',
    });

    const groceries = await getCategory('groceries');
    const restaurants = await getCategory('restaurants');
    expect(groceries.parent_id).toBe('food');
    expect(groceries.sort_order).toBeLessThan(restaurants.sort_order);
  });

  it('deleting a parent keeps its subcategories as regular categories', async () => {
    await sheet.loadSpreadsheet(db);
    await setupCategories();
    await createAllBudgets();

    await runHandler(app.handlers['category-delete'], { id: 'food' });

    expect((await getCategory('food')).tombstone).toBe(1);
    for (const id of ['restaurants', 'groceries']) {
      const cat = await getCategory(id);
      expect(cat.tombstone).toBe(0);
      expect(cat.parent_id).toBeNull();
    }
  });

  it('deleting a subcategory gives its budget back to the parent', async () => {
    await sheet.loadSpreadsheet(db);
    await setupCategories();
    await createAllBudgets();

    const month = monthUtils.currentMonth();
    await setBudget({ category: 'restaurants', month, amount: 5000 });
    await sheet.waitOnSpreadsheet();
    const parentBefore = getBudget({ category: 'food', month });
    const childBudget = getBudget({ category: 'restaurants', month });

    await runHandler(app.handlers['category-delete'], { id: 'restaurants' });
    await sheet.waitOnSpreadsheet();

    expect(getBudget({ category: 'food', month })).toBe(
      parentBefore + childBudget,
    );
  });

  it('deleting a subcategory honors an explicit transfer category', async () => {
    await sheet.loadSpreadsheet(db);
    await setupCategories();
    await createAllBudgets();

    const month = monthUtils.currentMonth();
    await setBudget({ category: 'restaurants', month, amount: 5000 });
    await sheet.waitOnSpreadsheet();
    const parentBefore = getBudget({ category: 'food', month });
    const rentBefore = getBudget({ category: 'rent', month });
    const childBudget = getBudget({ category: 'restaurants', month });

    await runHandler(app.handlers['category-delete'], {
      id: 'restaurants',
      transferId: 'rent',
    });
    await sheet.waitOnSpreadsheet();

    expect(getBudget({ category: 'rent', month })).toBe(
      rentBefore + childBudget,
    );
    expect(getBudget({ category: 'food', month })).toBe(parentBefore);
  });
});

describe('Budgeting subcategories', () => {
  const jan = '2024-01';
  const feb = '2024-02';

  async function setupBudget() {
    await setupCategories();
    await sheet.loadSpreadsheet(db);
    await createBudget([jan, feb, '2024-03']);
  }

  async function budgetAmount(category: string, month: string, amount: number) {
    await runHandler(app.handlers['budget/budget-amount'], {
      category,
      month,
      amount,
    });
    await sheet.waitOnSpreadsheet();
  }

  function cell(month: string, name: string) {
    return getSheetValue(monthUtils.sheetForMonth(month), name);
  }

  it('budgeting a subcategory takes the money from its parent', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);
    const toBudgetBefore = await cell(jan, 'to-budget');

    await budgetAmount('restaurants', jan, 3000);

    expect(getBudget({ category: 'restaurants', month: jan })).toBe(3000);
    expect(getBudget({ category: 'food', month: jan })).toBe(7000);
    expect(await cell(jan, 'to-budget')).toBe(toBudgetBefore);
    expect(await cell(jan, 'total-budgeted')).toBe(-10000);
  });

  it('lowering a subcategory gives the money back to its parent', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);
    await budgetAmount('restaurants', jan, 3000);

    await budgetAmount('restaurants', jan, 1000);

    expect(getBudget({ category: 'food', month: jan })).toBe(9000);
  });

  it('a parent does not have to give anything to its subcategories', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);

    expect(getBudget({ category: 'food', month: jan })).toBe(10000);
    expect(getBudget({ category: 'restaurants', month: jan })).toBe(0);
    expect(getBudget({ category: 'food', month: feb })).toBe(0);
  });

  it('budgeting a regular category still uses To Budget', async () => {
    await setupBudget();
    const toBudgetBefore = await cell(jan, 'to-budget');

    await budgetAmount('rent', jan, 5000);

    expect(await cell(jan, 'to-budget')).toBe(toBudgetBefore - 5000);
  });

  it('shows the parent total across the parent and its subcategories', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);
    await budgetAmount('restaurants', jan, 3000);
    await budgetAmount('groceries', jan, 2000);

    expect(await cell(jan, 'budget-food')).toBe(5000);
    expect(await cell(jan, 'parent-total-budget-food')).toBe(10000);
    expect(await cell(jan, 'parent-total-budget-rent')).toBe(0);
  });

  it('updates the parent total when subcategories are added or removed', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);
    await budgetAmount('restaurants', jan, 3000);

    const id = await runHandler(app.handlers['category-create'], {
      name: 'snacks',
      groupId: 'group1',
      parentId: 'food',
    });
    await sheet.waitOnSpreadsheet();
    await budgetAmount(id, jan, 500);
    expect(await cell(jan, 'parent-total-budget-food')).toBe(10000);

    // Un-nesting keeps the money where it is, so it leaves the total
    const restaurants = await getCategory('restaurants');
    await runHandler(app.handlers['category-update'], {
      id: 'restaurants',
      name: restaurants.name,
      group: restaurants.cat_group,
      is_income: false,
      parent_id: null,
    });
    await sheet.waitOnSpreadsheet();
    expect(await cell(jan, 'parent-total-budget-food')).toBe(7000);
  });

  it('copying last month for every category does not charge parents twice', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);
    await budgetAmount('restaurants', jan, 3000);

    await copyPreviousMonth({ month: feb });
    await sheet.waitOnSpreadsheet();

    expect(getBudget({ category: 'food', month: feb })).toBe(7000);
    expect(getBudget({ category: 'restaurants', month: feb })).toBe(3000);
  });

  it('setting every budget to zero clears parents and subcategories', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);
    await budgetAmount('restaurants', jan, 3000);

    await setZero({ month: jan });
    await sheet.waitOnSpreadsheet();

    expect(getBudget({ category: 'food', month: jan })).toBe(0);
    expect(getBudget({ category: 'restaurants', month: jan })).toBe(0);
  });

  it("copying a subcategory into later months charges each month's parent", async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);
    await budgetAmount('restaurants', jan, 3000);
    await budgetAmount('food', feb, 5000);
    await budgetAmount('food', '2024-03', 5000);

    await copyUntilYearEnd({ month: jan, category: 'restaurants' });
    await sheet.waitOnSpreadsheet();

    for (const month of [feb, '2024-03']) {
      expect(getBudget({ category: 'restaurants', month })).toBe(3000);
      expect(getBudget({ category: 'food', month })).toBe(2000);
    }
  });

  it('a subcategory cannot take more than its parent has budgeted', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);

    await budgetAmount('restaurants', jan, 15000);

    expect(getBudget({ category: 'restaurants', month: jan })).toBe(10000);
    expect(getBudget({ category: 'food', month: jan })).toBe(0);
  });

  it('a subcategory cannot be budgeted when its parent has nothing', async () => {
    await setupBudget();

    await budgetAmount('restaurants', jan, 3000);

    expect(getBudget({ category: 'restaurants', month: jan })).toBe(0);
    expect(getBudget({ category: 'food', month: jan })).toBe(0);
  });

  it('a capped subcategory can still be lowered', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);
    await budgetAmount('restaurants', jan, 10000);

    await budgetAmount('restaurants', jan, 4000);

    expect(getBudget({ category: 'restaurants', month: jan })).toBe(4000);
    expect(getBudget({ category: 'food', month: jan })).toBe(6000);
  });

  it('a transfer from the parent to a subcategory is not charged twice', async () => {
    await setupBudget();
    await budgetAmount('food', jan, 10000);

    await transferCategory({
      month: jan,
      amount: 2000,
      from: 'food',
      to: 'restaurants',
      currencyCode: 'USD',
    });
    await sheet.waitOnSpreadsheet();

    expect(getBudget({ category: 'food', month: jan })).toBe(8000);
    expect(getBudget({ category: 'restaurants', month: jan })).toBe(2000);
  });
});

describe('To Budget and templates skip subcategories', () => {
  const jan = '2024-01';

  // Covering and templates only act when there's money in To Budget, so
  // these tests start with income and $40 overspent on restaurants.
  async function setupWithIncome() {
    await setupCategories();
    await db.insertCategory({
      id: 'salary',
      name: 'salary',
      cat_group: 'income',
      is_income: 1,
    });
    await db.insertAccount({ id: 'acct', name: 'acct' });
    await db.insertTransaction({
      date: '2024-01-01',
      amount: 50000,
      account: 'acct',
      category: 'salary',
    });
    await db.insertTransaction({
      date: '2024-01-15',
      amount: -4000,
      account: 'acct',
      category: 'restaurants',
    });
    await sheet.loadSpreadsheet(db);
    await createBudget([jan, '2024-02']);
  }

  it('To Budget cannot be moved into a subcategory', async () => {
    await setupWithIncome();

    await expect(
      transferAvailable({ month: jan, amount: 1000, category: 'restaurants' }),
    ).rejects.toThrow('funded from its parent');
    expect(getBudget({ category: 'restaurants', month: jan })).toBe(0);
  });

  it('To Budget cannot cover a subcategory', async () => {
    await setupWithIncome();

    await expect(
      coverOverspending({
        month: jan,
        to: 'restaurants',
        from: 'to-budget',
        currencyCode: 'USD',
      }),
    ).rejects.toThrow('funded from its parent');
    expect(getBudget({ category: 'restaurants', month: jan })).toBe(0);
  });

  it('To Budget cannot be transferred to a subcategory', async () => {
    await setupWithIncome();

    await expect(
      transferCategory({
        month: jan,
        amount: 1000,
        from: 'to-budget',
        to: 'restaurants',
        currencyCode: 'USD',
      }),
    ).rejects.toThrow('funded from its parent');
  });

  it('a parent can cover its subcategory', async () => {
    await setupWithIncome();
    await setBudget({ category: 'food', month: jan, amount: 10000 });
    await sheet.waitOnSpreadsheet();
    const toBudgetBefore = await getSheetValue(
      monthUtils.sheetForMonth(jan),
      'to-budget',
    );

    await coverOverspending({
      month: jan,
      to: 'restaurants',
      from: 'food',
      currencyCode: 'USD',
    });
    await sheet.waitOnSpreadsheet();

    expect(getBudget({ category: 'restaurants', month: jan })).toBe(4000);
    expect(getBudget({ category: 'food', month: jan })).toBe(6000);
    expect(
      await getSheetValue(monthUtils.sheetForMonth(jan), 'to-budget'),
    ).toBe(toBudgetBefore);
  });

  it('templates are not applied to subcategories', async () => {
    await setupWithIncome();
    const templates: Template[] = [
      {
        type: 'periodic',
        amount: 100,
        period: { period: 'month', amount: 1 },
        starting: '2024-01-01',
        directive: 'template',
        priority: 1,
      },
    ];
    await storeTemplates({
      categoriesWithTemplates: [
        { id: 'food', templates },
        { id: 'restaurants', templates },
      ],
      source: 'ui',
    });

    await applyTemplate({ month: jan });
    await sheet.waitOnSpreadsheet();

    expect(getBudget({ category: 'food', month: jan })).toBe(10000);
    expect(getBudget({ category: 'restaurants', month: jan })).toBe(0);
  });

  it('a template preview is empty for a subcategory', async () => {
    await setupWithIncome();

    const result = await dryRunCategoryTemplate({
      month: jan,
      categoryId: 'restaurants',
      templates: [
        {
          type: 'periodic',
          amount: 100,
          period: { period: 'month', amount: 1 },
          starting: '2024-01-01',
          directive: 'template',
          priority: 1,
        },
      ],
    });

    expect(result.budgeted).toBe(0);
  });
});
