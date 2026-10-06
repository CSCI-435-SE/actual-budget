import { nestCategories } from '@actual-app/core/shared/categories';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';

import type { QueryDataEntity } from '#components/reports/ReportOptions';

// Maps each parent category to its subcategories' ids, nested the same way
// the budget page nests them: a subcategory whose parent is missing or in
// another group is reported as a top-level category instead.
export function getSubcategoryIdsByParent(
  categoryGroups: Pick<CategoryGroupEntity, 'categories'>[],
): Map<string, string[]> {
  const subcategoryIds = new Map<string, string[]>();
  for (const group of categoryGroups) {
    for (const parent of nestCategories(group.categories ?? [])) {
      if (parent.subcategories.length > 0) {
        subcategoryIds.set(
          parent.id,
          parent.subcategories.map(sub => sub.id),
        );
      }
    }
  }
  return subcategoryIds;
}

// The categories a report row adds up. A parent's row includes everything
// its subcategories hold, so it covers its own id and theirs. Other rows
// get undefined and match on their own id as usual.
export function getRolledUpCategoryIds(
  id: string | undefined,
  subcategoryIdsByParent: Map<string, string[]>,
): string[] | undefined {
  const subcategoryIds = id ? subcategoryIdsByParent.get(id) : undefined;
  return subcategoryIds && id ? [id, ...subcategoryIds] : undefined;
}

// Categories that are reported inside their parent's row rather than as a
// row of their own. Totals add up top-level rows only, so leaving these
// out is what keeps a subcategory from being counted twice.
export function getNestedSubcategoryIds(
  subcategoryIdsByParent: Map<string, string[]>,
): Set<string> {
  return new Set([...subcategoryIdsByParent.values()].flat());
}

// Subcategories of hidden parents, which the budget page hides along with
// their parent.
export function getSubcategoryIdsOfHiddenParents(
  categoryGroups: Pick<CategoryGroupEntity, 'categories'>[],
): Set<string> {
  const hiddenParentIds = new Set(
    categoryGroups
      .flatMap(group => group.categories ?? [])
      .filter(cat => cat.hidden)
      .map(cat => cat.id),
  );
  const ids = new Set<string>();
  for (const [parentId, subcategoryIds] of getSubcategoryIdsByParent(
    categoryGroups,
  )) {
    if (hiddenParentIds.has(parentId)) {
      subcategoryIds.forEach(id => ids.add(id));
    }
  }
  return ids;
}

// Marks rows of a hidden parent's subcategories as hidden, so they're left
// out of reports the same way the parent is.
export function hideSubcategoriesOfHiddenParents(
  rows: QueryDataEntity[],
  categoryGroups: Pick<CategoryGroupEntity, 'categories'>[],
): QueryDataEntity[] {
  const hiddenIds = getSubcategoryIdsOfHiddenParents(categoryGroups);
  if (hiddenIds.size === 0) {
    return rows;
  }
  return rows.map(row =>
    row.category && hiddenIds.has(row.category)
      ? { ...row, categoryHidden: true }
      : row,
  );
}
