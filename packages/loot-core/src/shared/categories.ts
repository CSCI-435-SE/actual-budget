import type { CategoryEntity } from '#types/models';

export type CategoryWithSubcategories<T extends CategoryEntity> = T & {
  subcategories: T[];
};

/**
 * Turns a group's flat category list into top-level categories, each with
 * its subcategories. Order is kept within each level. A subcategory is
 * shown as a top-level category when its parent isn't in the list
 * (deleted or in another group) or is itself a subcategory, which the
 * server doesn't allow but conflicting edits from two devices could
 * produce. That way a category never disappears.
 */
export function nestCategories<T extends CategoryEntity>(
  categories: T[],
): CategoryWithSubcategories<T>[] {
  const ids = new Set(categories.map(cat => cat.id));
  const hasValidParent = (cat: T) =>
    cat.parent_id != null && ids.has(cat.parent_id);
  const parentIds = new Set(
    categories.filter(cat => !hasValidParent(cat)).map(cat => cat.id),
  );
  const subcategoriesByParent = new Map<CategoryEntity['id'], T[]>();
  const topLevel: T[] = [];

  for (const cat of categories) {
    if (cat.parent_id && parentIds.has(cat.parent_id)) {
      const siblings = subcategoriesByParent.get(cat.parent_id) ?? [];
      siblings.push(cat);
      subcategoriesByParent.set(cat.parent_id, siblings);
    } else {
      topLevel.push(cat);
    }
  }

  return topLevel.map(cat => ({
    ...cat,
    subcategories: subcategoriesByParent.get(cat.id) ?? [],
  }));
}

/** Whether a category is a subcategory of another category. */
export function isSubcategory(category: Pick<CategoryEntity, 'parent_id'>) {
  return category.parent_id != null;
}
