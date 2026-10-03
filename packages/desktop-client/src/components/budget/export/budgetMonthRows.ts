import * as monthUtils from '@actual-app/core/shared/months';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';
import { t } from 'i18next';

import { separateGroups } from '#components/budget/util';
import { envelopeBudget } from '#spreadsheet/bindings';

export type RawBudgetMonthRowKind =
  | 'group'
  | 'category'
  | 'income'
  | 'incomeCategory'
  | 'total'
  | 'toBudget';

export type RawBudgetMonthRow = {
  kind: RawBudgetMonthRowKind;
  groupName: string;
  // '' for group/total/toBudget rows.
  categoryName: string;
  // Raw integer cents read from the sheet cell, not yet scaled by the
  // currency's decimal places. `null` means the page shows a blank cell.
  budgeted: number | null;
  spent: number | null;
  balance: number | null;
};

type CollectBudgetMonthRowsOptions = {
  month: string;
  categoryGroups: CategoryGroupEntity[];
  cells: Map<string, unknown>;
  showHiddenCategories: boolean;
};

// Walks one envelope budget month's category groups/categories in page
// order and reads their Budgeted/Spent/Balance values from the same
// spreadsheet cells the page displays, so every consumer (CSV, PDF, ...)
// shows identical numbers and can never drift apart.
export function collectBudgetMonthRows({
  month,
  categoryGroups,
  cells,
  showHiddenCategories,
}: CollectBudgetMonthRowsOptions): RawBudgetMonthRow[] {
  const sheetName = monthUtils.sheetForMonth(month);

  function cellValue(name: string) {
    const value = cells.get(`${sheetName}!${name}`);
    return typeof value === 'number' ? value : 0;
  }

  function isVisible(item: { hidden?: boolean }) {
    return showHiddenCategories || !item.hidden;
  }

  const [expenseGroups, incomeGroup] = separateGroups(categoryGroups);
  const rows: RawBudgetMonthRow[] = [];

  for (const group of expenseGroups.filter(isVisible)) {
    rows.push({
      kind: 'group',
      groupName: group.name,
      categoryName: '',
      budgeted: cellValue(envelopeBudget.groupBudgeted(group.id)),
      spent: cellValue(envelopeBudget.groupSumAmount(group.id)),
      balance: cellValue(envelopeBudget.groupBalance(group.id)),
    });

    for (const category of (group.categories ?? []).filter(isVisible)) {
      rows.push({
        kind: 'category',
        groupName: group.name,
        categoryName: category.name,
        budgeted: cellValue(envelopeBudget.catBudgeted(category.id)),
        spent: cellValue(envelopeBudget.catSumAmount(category.id)),
        balance: cellValue(envelopeBudget.catBalance(category.id)),
      });
    }
  }

  // The income group is always shown on the page, even when marked hidden.
  if (incomeGroup) {
    rows.push({
      kind: 'income',
      groupName: incomeGroup.name,
      categoryName: '',
      budgeted: null,
      spent: cellValue(envelopeBudget.groupIncomeReceived),
      balance: null,
    });

    for (const category of (incomeGroup.categories ?? []).filter(isVisible)) {
      rows.push({
        kind: 'incomeCategory',
        groupName: incomeGroup.name,
        categoryName: category.name,
        budgeted: null,
        spent: cellValue(envelopeBudget.catSumAmount(category.id)),
        balance: null,
      });
    }
  }

  // `total-budgeted` is stored negated; the page flips it back for display.
  rows.push({
    kind: 'total',
    groupName: t('Total'),
    categoryName: '',
    budgeted: -cellValue(envelopeBudget.totalBudgeted),
    spent: cellValue(envelopeBudget.totalSpent),
    balance: cellValue(envelopeBudget.totalBalance),
  });

  const toBudget = cellValue(envelopeBudget.toBudget);
  rows.push({
    kind: 'toBudget',
    groupName: toBudget < 0 ? t('Overbudgeted') : t('To Budget'),
    categoryName: '',
    budgeted: null,
    spent: null,
    balance: toBudget,
  });

  return rows;
}
