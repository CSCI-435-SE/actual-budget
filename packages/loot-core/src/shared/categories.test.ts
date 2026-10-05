import type { CategoryEntity } from '#types/models';

import { isSubcategory, nestCategories } from './categories';

function category(id: string, parent_id: string | null = null): CategoryEntity {
  return { id, name: id, group: 'group1', parent_id };
}

function shape(categories: CategoryEntity[]) {
  return nestCategories(categories).map(cat => [
    cat.id,
    cat.subcategories.map(sub => sub.id),
  ]);
}

describe('nestCategories', () => {
  it('puts subcategories under their parent and keeps the order', () => {
    expect(
      shape([
        category('rent'),
        category('food'),
        category('groceries', 'food'),
        category('restaurants', 'food'),
        category('fun'),
      ]),
    ).toEqual([
      ['rent', []],
      ['food', ['groceries', 'restaurants']],
      ['fun', []],
    ]);
  });

  it('nests a subcategory listed before its parent', () => {
    expect(shape([category('restaurants', 'food'), category('food')])).toEqual([
      ['food', ['restaurants']],
    ]);
  });

  it('shows a subcategory whose parent is missing as top-level', () => {
    expect(shape([category('restaurants', 'deleted')])).toEqual([
      ['restaurants', []],
    ]);
  });

  it('never hides a category nested two levels deep', () => {
    expect(
      shape([category('z'), category('y', 'z'), category('x', 'y')]),
    ).toEqual([
      ['z', ['y']],
      ['x', []],
    ]);
  });

  it("never hides categories that are each other's parent", () => {
    expect(shape([category('a', 'b'), category('b', 'a')])).toEqual([
      ['a', []],
      ['b', []],
    ]);
  });
});

describe('isSubcategory', () => {
  it('is true only when the category has a parent', () => {
    expect(isSubcategory(category('restaurants', 'food'))).toBe(true);
    expect(isSubcategory(category('food'))).toBe(false);
    expect(isSubcategory({})).toBe(false);
  });
});
