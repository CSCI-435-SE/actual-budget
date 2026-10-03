// @ts-strict-ignore
import { styles } from '@actual-app/components/styles';
import type { CSSProperties } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { send } from '@actual-app/core/platform/client/connection';
import { nestCategories } from '@actual-app/core/shared/categories';
import * as monthUtils from '@actual-app/core/shared/months';
import type { Handlers } from '@actual-app/core/types/handlers';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import type { SyncedPrefs } from '@actual-app/core/types/prefs';
import { t } from 'i18next';

import type { DropPosition } from '#components/sort';
import type { useSpreadsheet } from '#hooks/useSpreadsheet';

import { getValidMonthBounds } from './MonthsContext';

export function addToBeBudgetedGroup(groups: CategoryGroupEntity[]) {
  return [
    {
      id: 'to-budget',
      name: t('To Budget'),
      categories: [
        {
          id: 'to-budget',
          name: t('To Budget'),
          group: 'to-budget',
        },
      ],
    } as CategoryGroupEntity,
    ...groups,
  ];
}

export function removeCategoriesFromGroups(
  categoryGroups: CategoryGroupEntity[],
  ...categoryIds: CategoryEntity['id'][]
) {
  if (categoryIds.length === 0) return categoryGroups;

  const categoryIdsSet = new Set(categoryIds);

  return categoryGroups
    .map(group => ({
      ...group,
      categories:
        group.categories?.filter(cat => !categoryIdsSet.has(cat.id)) ?? [],
    }))
    .filter(group => group.categories?.length);
}

// For pickers whose money comes from "To Budget", which can't fund a
// subcategory directly.
export function removeSubcategoriesFromGroups(
  categoryGroups: CategoryGroupEntity[],
) {
  return categoryGroups
    .map(group => ({
      ...group,
      categories: group.categories?.filter(cat => !cat.parent_id) ?? [],
    }))
    .filter(group => group.categories.length);
}

export type CategoryRow = {
  category: CategoryEntity;
  isSubcategory: boolean;
};

// The rows a group shows on the budget page: each top-level category
// followed by its subcategories. Nesting happens before hidden categories
// are filtered out, so a hidden parent hides its subcategories too.
export function getCategoryRows(
  categories: CategoryEntity[],
  showHidden: boolean,
): CategoryRow[] {
  const isShown = (cat: CategoryEntity) => showHidden || !cat.hidden;

  return nestCategories(categories)
    .filter(isShown)
    .flatMap(({ subcategories, ...category }) => [
      { category, isSubcategory: false },
      ...subcategories
        .filter(isShown)
        .map(sub => ({ category: sub, isSubcategory: true })),
    ]);
}

// Categories in the same group that `category` could be moved under:
// top-level expense categories other than itself. A category that already
// has subcategories can't become one, so it gets no options.
export function getValidParentCategories(
  group: CategoryGroupEntity,
  category: CategoryEntity,
): CategoryEntity[] {
  const categories = group.categories ?? [];
  if (group.is_income || categories.some(c => c.parent_id === category.id)) {
    return [];
  }
  return categories.filter(c => c.id !== category.id && !c.parent_id);
}

export function separateGroups(categoryGroups: CategoryGroupEntity[]) {
  return [
    categoryGroups.filter(g => !g.is_income),
    categoryGroups.find(g => g.is_income),
  ] as const;
}

export function makeAmountGrey(value: number | string | null): CSSProperties {
  return value === 0 || value === '0' || value === '' || value == null
    ? { color: theme.budgetNumberZero }
    : null;
}

type BalanceAmountStyleOptions = {
  /** Decimal places of the active currency. */
  decimalPlaces?: number;
  /** Whether the `hideFraction` pref is on. */
  hideFraction?: boolean;
};

export function makeBalanceAmountStyle(
  value: number,
  goalValue?: number | null,
  budgetedValue?: number | null,
  spentValue?: number | null,
  { decimalPlaces = 2, hideFraction = false }: BalanceAmountStyleOptions = {},
) {
  // Balances are integer amounts. Round them to the precision they are
  // actually displayed at, so that a balance rendering as zero is greyed out
  // rather than coloured, and two amounts rendering identically compare equal
  // against a goal.
  const scale = hideFraction ? Math.pow(10, decimalPlaces) : 1;

  const normalizeIntegerValue = (val: number | null | undefined) =>
    typeof val === 'number'
      ? Math.sign(val) * Math.round(Math.abs(val) / scale) * scale
      : 0;

  const currencyValue = normalizeIntegerValue(value);

  if (currencyValue < 0) {
    return { color: theme.budgetNumberNegative };
  }

  if (goalValue == null) {
    const greyed = makeAmountGrey(currencyValue);
    if (greyed) {
      return greyed;
    }

    // Spending is negative for expense categories, so its magnitude is what
    // needs to be compared against this month's budgeted amount. A balance
    // that's still >= 0 despite this means a prior rollover surplus is
    // covering the overspend — surface that before it turns red next month.
    const budgetedAmount = normalizeIntegerValue(budgetedValue);
    const spentAmount = normalizeIntegerValue(spentValue);
    if (Math.abs(spentAmount) > budgetedAmount) {
      return { color: theme.budgetNumberOverspent };
    }

    return { color: theme.budgetNumberPositive };
  } else {
    const budgetedAmount = normalizeIntegerValue(budgetedValue);
    const goalAmount = normalizeIntegerValue(goalValue);

    if (budgetedAmount < goalAmount) {
      return { color: theme.templateNumberUnderFunded };
    }
    return { color: theme.templateNumberFunded };
  }
}

export function makeAmountFullStyle(
  value: number,
  colors?: {
    positiveColor?: string;
    negativeColor?: string;
    zeroColor?: string;
  },
) {
  const positiveColorToUse =
    colors?.positiveColor || theme.budgetNumberPositive;
  const negativeColorToUse =
    colors?.negativeColor || theme.budgetNumberNegative;
  const zeroColorToUse = colors?.zeroColor || theme.budgetNumberZero;
  return {
    color:
      value < 0
        ? negativeColorToUse
        : value === 0
          ? zeroColorToUse
          : positiveColorToUse,
  };
}

export function findSortDown<T extends { id: string }>(
  arr: T[],
  pos: DropPosition | null,
  targetId: string,
) {
  if (pos === 'top') {
    return { targetId };
  } else {
    const idx = arr.findIndex(item => item.id === targetId);

    if (idx === -1) {
      throw new Error('findSort: item not found: ' + targetId);
    }

    const newIdx = idx + 1;
    if (newIdx < arr.length) {
      return { targetId: arr[newIdx].id };
    } else {
      // Move to the end
      return { targetId: null };
    }
  }
}

// Where `dragged` lands when dropped on the row of `targetId` in `group`,
// or null when that drop isn't allowed. Uses the same nesting the rows
// show:
// - a subcategory only moves among its siblings, and never to another
//   group (the server would reject leaving its parent's group);
// - a top-level category is ordered among the top-level ones, so dropping
//   it on a subcategory row places it after that subcategory's parent.
export function getCategoryDropTarget(
  group: CategoryGroupEntity,
  dragged: CategoryEntity,
  dropPos: DropPosition | null,
  targetId: CategoryEntity['id'],
): { targetId: CategoryEntity['id'] | null } | null {
  if (dragged.parent_id && dragged.group !== group.id) {
    return null;
  }

  const nested = nestCategories(group.categories ?? []);
  const parentOf = new Map<CategoryEntity['id'], CategoryEntity['id']>();
  for (const parent of nested) {
    for (const sub of parent.subcategories) {
      parentOf.set(sub.id, parent.id);
    }
  }

  const draggedParent = parentOf.get(dragged.id);
  const targetParent = parentOf.get(targetId);

  if (draggedParent) {
    if (targetParent !== draggedParent) {
      return null;
    }
    const siblings = nested.find(p => p.id === draggedParent).subcategories;
    return findSortDown(siblings, dropPos, targetId);
  }

  if (targetParent) {
    return findSortDown(nested, 'bottom', targetParent);
  }
  if (!nested.some(cat => cat.id === targetId)) {
    return null;
  }
  return findSortDown(nested, dropPos, targetId);
}

export function findSortUp<T extends { id: string }>(
  arr: T[],
  pos: DropPosition | null,
  targetId: string,
) {
  if (pos === 'bottom') {
    return { targetId };
  } else {
    const idx = arr.findIndex(item => item.id === targetId);

    if (idx === -1) {
      throw new Error('findSort: item not found: ' + targetId);
    }

    const newIdx = idx - 1;
    if (newIdx >= 0) {
      return { targetId: arr[newIdx].id };
    } else {
      // Move to the beginning
      return { targetId: null };
    }
  }
}

export function getScrollbarWidth() {
  return Math.max(styles.scrollbarWidth - 2, 0);
}

export async function prewarmMonth(
  budgetType: SyncedPrefs['budgetType'],
  spreadsheet: ReturnType<typeof useSpreadsheet>,
  month: string,
) {
  const method: keyof Handlers =
    budgetType === 'tracking'
      ? 'tracking-budget-month'
      : 'envelope-budget-month';

  const values = await send(method, { month });

  for (const value of values) {
    spreadsheet.prewarmCache(value.name, value);
  }
}

export async function prewarmAllMonths(
  budgetType: SyncedPrefs['budgetType'],
  spreadsheet: ReturnType<typeof useSpreadsheet>,
  bounds: { start: string; end: string },
  startMonth: string,
) {
  const numMonths = 3;

  bounds = getValidMonthBounds(
    bounds,
    monthUtils.subMonths(startMonth, 1),
    monthUtils.addMonths(startMonth, numMonths + 1),
  );
  const months = monthUtils.rangeInclusive(bounds.start, bounds.end);

  await Promise.all(
    months.map(month => prewarmMonth(budgetType, spreadsheet, month)),
  );
}
