import { theme } from '@actual-app/components/theme';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import {
  getCategoryDropTarget,
  getCategoryRows,
  getValidParentCategories,
  makeBalanceAmountStyle,
  removeSubcategoriesFromGroups,
} from './util';

describe('makeBalanceAmountStyle', () => {
  it('colours by the sign of the balance', () => {
    expect(makeBalanceAmountStyle(-1)).toEqual({
      color: theme.budgetNumberNegative,
    });
    expect(makeBalanceAmountStyle(0)).toEqual({
      color: theme.budgetNumberZero,
    });
    expect(makeBalanceAmountStyle(1)).toEqual({
      color: theme.budgetNumberPositive,
    });
  });

  it('colors a negative balance red regardless of spending', () => {
    expect(makeBalanceAmountStyle(-1000)).toEqual({
      color: theme.budgetNumberNegative,
    });
  });

  it('colors a zero balance as the neutral zero color', () => {
    expect(makeBalanceAmountStyle(0, null, 10000, -20000)).toEqual({
      color: theme.budgetNumberZero,
    });
  });

  it('colors a non-negative balance neutrally when spending is within budget', () => {
    // Budgeted $100, spent $50 this month, balance still $50.
    expect(makeBalanceAmountStyle(5000, null, 10000, -5000)).toEqual({
      color: theme.budgetNumberPositive,
    });
  });

  it('colors a non-negative balance yellow when this month overspent but rollover covers it', () => {
    // Budgeted $100, spent $180 this month (over by $80), but a prior
    // rollover surplus keeps the balance at $10.
    expect(makeBalanceAmountStyle(1000, null, 10000, -18000)).toEqual({
      color: theme.budgetNumberOverspent,
    });
  });

  it('does not apply the overspend color when no spent value is provided', () => {
    expect(makeBalanceAmountStyle(1000, null, 10000)).toEqual({
      color: theme.budgetNumberPositive,
    });
  });

  it('keeps sub-unit balances coloured when the fraction is shown', () => {
    expect(
      makeBalanceAmountStyle(4, null, null, null, { decimalPlaces: 2 }),
    ).toEqual({
      color: theme.budgetNumberPositive,
    });
  });

  it('greys out a balance that displays as zero when the fraction is hidden', () => {
    expect(
      makeBalanceAmountStyle(4, null, null, null, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.budgetNumberZero });
    expect(
      makeBalanceAmountStyle(-4, null, null, null, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.budgetNumberZero });
  });

  it('does not round away whole units of a zero-decimal currency', () => {
    // 4 is ¥4, not 4 cents, so hiding the fraction must not zero it out.
    expect(
      makeBalanceAmountStyle(4, null, null, null, {
        decimalPlaces: 0,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.budgetNumberPositive });
  });

  it('compares the budgeted amount against the goal', () => {
    expect(makeBalanceAmountStyle(100, 5000, 4999)).toEqual({
      color: theme.templateNumberUnderFunded,
    });
    expect(makeBalanceAmountStyle(100, 5000, 5000)).toEqual({
      color: theme.templateNumberFunded,
    });
  });

  it('treats amounts that display identically as funded when the fraction is hidden', () => {
    expect(
      makeBalanceAmountStyle(100, 5000, 4999, null, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.templateNumberFunded });
  });

  it('leaves goal-template funded/underfunded coloring unaffected by overspending', () => {
    // Goal templates use budgetedValue vs goalValue, ignoring spent entirely.
    expect(makeBalanceAmountStyle(1000, 10000, 5000, -18000)).toEqual({
      color: theme.templateNumberUnderFunded,
    });
    expect(makeBalanceAmountStyle(1000, 5000, 10000, -18000)).toEqual({
      color: theme.templateNumberFunded,
    });
  });
});

function category(
  id: string,
  extra: Partial<CategoryEntity> = {},
): CategoryEntity {
  return { id, name: id, group: 'group1', parent_id: null, ...extra };
}

// rent, food (groceries, restaurants), fun
const food = category('food');
const groceries = category('groceries', { parent_id: 'food' });
const restaurants = category('restaurants', { parent_id: 'food' });
const group: CategoryGroupEntity = {
  id: 'group1',
  name: 'group1',
  categories: [category('rent'), food, groceries, restaurants, category('fun')],
};

describe('getCategoryRows', () => {
  it('lists each subcategory right under its parent, indented', () => {
    const rows = getCategoryRows(group.categories ?? [], false);
    expect(rows.map(r => [r.category.id, r.isSubcategory])).toEqual([
      ['rent', false],
      ['food', false],
      ['groceries', true],
      ['restaurants', true],
      ['fun', false],
    ]);
  });

  it('hides the subcategories of a hidden parent', () => {
    const rows = getCategoryRows(
      [category('food', { hidden: true }), groceries, category('fun')],
      false,
    );
    expect(rows.map(r => r.category.id)).toEqual(['fun']);
  });

  it('can hide a single subcategory', () => {
    const rows = getCategoryRows(
      [food, { ...groceries, hidden: true }, restaurants],
      false,
    );
    expect(rows.map(r => r.category.id)).toEqual(['food', 'restaurants']);
  });

  it('shows hidden categories when asked to', () => {
    const rows = getCategoryRows(
      [category('food', { hidden: true }), groceries],
      true,
    );
    expect(rows.map(r => r.category.id)).toEqual(['food', 'groceries']);
  });
});

describe('removeSubcategoriesFromGroups', () => {
  it('keeps only top-level categories and drops empty groups', () => {
    const onlySubs: CategoryGroupEntity = {
      id: 'group2',
      name: 'group2',
      categories: [category('x', { parent_id: 'elsewhere' })],
    };
    expect(
      removeSubcategoriesFromGroups([group, onlySubs]).map(g => [
        g.id,
        g.categories?.map(c => c.id),
      ]),
    ).toEqual([['group1', ['rent', 'food', 'fun']]]);
  });
});

describe('getValidParentCategories', () => {
  it('offers other top-level categories in the same group', () => {
    expect(
      getValidParentCategories(group, category('rent')).map(c => c.id),
    ).toEqual(['food', 'fun']);
  });

  it('offers nothing for a category that already has subcategories', () => {
    expect(getValidParentCategories(group, food)).toEqual([]);
  });

  it('offers nothing in the income group', () => {
    expect(
      getValidParentCategories({ ...group, is_income: true }, category('rent')),
    ).toEqual([]);
  });
});

describe('getCategoryDropTarget', () => {
  it('reorders a subcategory among its siblings', () => {
    expect(
      getCategoryDropTarget(group, restaurants, 'top', 'groceries'),
    ).toEqual({ targetId: 'groceries' });
    expect(
      getCategoryDropTarget(group, groceries, 'bottom', 'restaurants'),
    ).toEqual({ targetId: null });
  });

  it('does not let a subcategory leave its parent', () => {
    expect(getCategoryDropTarget(group, groceries, 'top', 'rent')).toBeNull();
    expect(
      getCategoryDropTarget(group, groceries, 'bottom', 'food'),
    ).toBeNull();
    expect(
      getCategoryDropTarget(
        { ...group, id: 'group2' },
        { ...groceries, group: 'group1' },
        'top',
        'rent',
      ),
    ).toBeNull();
  });

  it('places a top-level category after a parent block when dropped on a subcategory', () => {
    expect(
      getCategoryDropTarget(group, category('rent'), 'top', 'restaurants'),
    ).toEqual({ targetId: 'fun' });
  });

  it('orders top-level categories among top-level ones only', () => {
    // Dropping below "food" lands before "fun", not inside food's block
    expect(
      getCategoryDropTarget(group, category('rent'), 'bottom', 'food'),
    ).toEqual({ targetId: 'fun' });
    expect(
      getCategoryDropTarget(group, category('fun'), 'top', 'food'),
    ).toEqual({ targetId: 'food' });
  });
});
