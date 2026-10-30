import { send } from '@actual-app/core/platform/client/connection';
import { nestCategories } from '@actual-app/core/shared/categories';
import type {
  CategoryEntity,
  CategoryGroupEntity,
  RuleConditionEntity,
} from '@actual-app/core/types/models';

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

// Narrows getSubcategoryIdsByParent to the subcategories that are reported
// inside their parent's row. With a category filter, a subcategory only
// rolls into its parent when both are selected; one selected without its
// parent gets a row of its own instead of showing under a parent that was
// left out. `selectedCategoryIds` is undefined when every category is
// selected.
export function getRolledUpSubcategoryIdsByParent(
  subcategoryIdsByParent: Map<string, string[]>,
  selectedCategoryIds: Set<string> | undefined,
): Map<string, string[]> {
  if (!selectedCategoryIds) {
    return subcategoryIdsByParent;
  }
  const rolledUp = new Map<string, string[]>();
  for (const [parentId, subcategoryIds] of subcategoryIdsByParent) {
    if (!selectedCategoryIds.has(parentId)) {
      continue;
    }
    const selectedSubcategoryIds = subcategoryIds.filter(id =>
      selectedCategoryIds.has(id),
    );
    if (selectedSubcategoryIds.length > 0) {
      rolledUp.set(parentId, selectedSubcategoryIds);
    }
  }
  return rolledUp;
}

// The categories a report row adds up. A parent's row includes everything
// its rolled-up subcategories hold, so it covers its own id and theirs.
// Other rows get undefined and match on their own id as usual.
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

// A report filter on a parent category covers its subcategories too, the
// same way the parent's report row includes them: "is" and "one of" match
// the whole family, "is not" and "not one of" leave the whole family out.
// Filters on the category's name are left as they are.
export function expandSubcategoryConditions(
  conditions: RuleConditionEntity[],
  categoryGroups: Pick<CategoryGroupEntity, 'categories'>[],
): RuleConditionEntity[] {
  const subcategoryIdsByParent = getSubcategoryIdsByParent(categoryGroups);
  if (subcategoryIdsByParent.size === 0) {
    return conditions;
  }
  const withSubcategories = (ids: string[]) => [
    ...new Set(
      ids.flatMap(id => [id, ...(subcategoryIdsByParent.get(id) ?? [])]),
    ),
  ];

  return conditions.map(cond => {
    if (
      cond.field !== 'category' ||
      !['is', 'isNot', 'oneOf', 'notOneOf'].includes(cond.op)
    ) {
      return cond;
    }
    const ids = Array.isArray(cond.value) ? cond.value : [cond.value];
    if (!ids.some(id => subcategoryIdsByParent.has(id))) {
      return cond;
    }
    const excludes = cond.op === 'isNot' || cond.op === 'notOneOf';
    return {
      ...cond,
      op: excludes ? 'notOneOf' : 'oneOf',
      value: withSubcategories(ids),
    };
  });
}

// Category filters the custom report's category selector can't show:
// several category conditions, a category group condition, or a category
// condition matching on names or tags.
export function isComplexCategoryCondition(
  conditions: RuleConditionEntity[],
): boolean {
  return (
    conditions.some(
      ({ field, op }) =>
        field === 'category' &&
        [
          'contains',
          'doesNotContain',
          'matches',
          'hasTags',
          'hasAnyTag',
        ].includes(op),
    ) ||
    conditions.filter(({ field }) => field === 'category').length >= 2 ||
    conditions.some(({ field }) => field === 'category_group')
  );
}

// The category condition the custom report's category selector shows as
// checkboxes, if there is one.
export function getSelectorCategoryCondition(
  conditions: RuleConditionEntity[],
): RuleConditionEntity | undefined {
  if (isComplexCategoryCondition(conditions)) {
    return undefined;
  }
  return conditions.find(
    cond =>
      cond.field === 'category' &&
      ['is', 'isNot', 'oneOf', 'notOneOf'].includes(cond.op),
  );
}

// The categories checked in the custom report's category selector, or
// undefined when every category is.
export function getSelectedCategoryIds(
  conditions: RuleConditionEntity[],
  categories: Pick<CategoryEntity, 'id'>[],
): Set<string> | undefined {
  const cond = getSelectorCategoryCondition(conditions);
  if (!cond) {
    return undefined;
  }
  const ids = new Set<unknown>(
    Array.isArray(cond.value) ? cond.value : [cond.value],
  );
  const excludes = cond.op === 'isNot' || cond.op === 'notOneOf';
  return new Set(
    categories.map(({ id }) => id).filter(id => ids.has(id) !== excludes),
  );
}

// expandSubcategoryConditions for custom reports. The selector's condition
// lists exactly the categories that are checked, subcategories included,
// so it's left as it is; expanding it would add back subcategories that
// were unchecked. Any other category filter covers the whole family.
export function expandReportConditions(
  conditions: RuleConditionEntity[],
  categoryGroups: Pick<CategoryGroupEntity, 'categories'>[],
): RuleConditionEntity[] {
  const selectorCondition = getSelectorCategoryCondition(conditions);
  if (!selectorCondition) {
    return expandSubcategoryConditions(conditions, categoryGroups);
  }
  return conditions.map(cond =>
    cond === selectorCondition
      ? cond
      : expandSubcategoryConditions([cond], categoryGroups)[0],
  );
}

// expandSubcategoryConditions for reports that don't already have the
// categories loaded; only fetches them when there's a category filter.
export async function includeSubcategoriesInConditions(
  conditions: RuleConditionEntity[],
): Promise<RuleConditionEntity[]> {
  if (!conditions.some(cond => cond.field === 'category')) {
    return conditions;
  }
  const { grouped } = await send('get-categories');
  return expandSubcategoryConditions(conditions, grouped);
}
