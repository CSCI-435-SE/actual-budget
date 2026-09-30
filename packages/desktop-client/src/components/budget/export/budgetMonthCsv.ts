import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { integerToAmount } from '@actual-app/core/shared/util';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';
import { t } from 'i18next';

import { separateGroups } from '#components/budget/util';
import { envelopeBudget } from '#spreadsheet/bindings';
import { stringifyCsv } from '#util/csv';

type BudgetMonthCells = Map<string, unknown>;

type BuildBudgetMonthCsvOptions = {
  month: string;
  categoryGroups: CategoryGroupEntity[];
  cells: BudgetMonthCells;
  showHiddenCategories: boolean;
  decimalPlaces: number;
};

type CsvRow = [string, string, number | '', number | '', number | ''];

// Builds a CSV of one envelope budget month, mirroring the rows and values
// shown on the budget page. Subtotals and totals come from the spreadsheet's
// own group/total cells so they always match what the page displays.
export function buildBudgetMonthCsv({
  month,
  categoryGroups,
  cells,
  showHiddenCategories,
  decimalPlaces,
}: BuildBudgetMonthCsvOptions): string {
  const sheetName = monthUtils.sheetForMonth(month);

  function cellValue(name: string) {
    const value = cells.get(`${sheetName}!${name}`);
    return typeof value === 'number' ? value : 0;
  }

  function amount(name: string) {
    return integerToAmount(cellValue(name), decimalPlaces);
  }

  function isVisible(item: { hidden?: boolean }) {
    return showHiddenCategories || !item.hidden;
  }

  const [expenseGroups, incomeGroup] = separateGroups(categoryGroups);
  const rows: CsvRow[] = [];

  for (const group of expenseGroups.filter(isVisible)) {
    rows.push([
      group.name,
      '',
      amount(envelopeBudget.groupBudgeted(group.id)),
      amount(envelopeBudget.groupSumAmount(group.id)),
      amount(envelopeBudget.groupBalance(group.id)),
    ]);

    for (const category of (group.categories ?? []).filter(isVisible)) {
      rows.push([
        group.name,
        category.name,
        amount(envelopeBudget.catBudgeted(category.id)),
        amount(envelopeBudget.catSumAmount(category.id)),
        amount(envelopeBudget.catBalance(category.id)),
      ]);
    }
  }

  // The income group is always shown on the page, even when marked hidden.
  if (incomeGroup) {
    rows.push([
      incomeGroup.name,
      '',
      '',
      amount(envelopeBudget.groupIncomeReceived),
      '',
    ]);

    for (const category of (incomeGroup.categories ?? []).filter(isVisible)) {
      rows.push([
        incomeGroup.name,
        category.name,
        '',
        amount(envelopeBudget.catSumAmount(category.id)),
        '',
      ]);
    }
  }

  // `total-budgeted` is stored negated; the page flips it back for display.
  rows.push([
    t('Total'),
    '',
    integerToAmount(-cellValue(envelopeBudget.totalBudgeted), decimalPlaces),
    amount(envelopeBudget.totalSpent),
    amount(envelopeBudget.totalBalance),
  ]);

  const toBudget = cellValue(envelopeBudget.toBudget);
  rows.push([
    toBudget < 0 ? t('Overbudgeted') : t('To Budget'),
    '',
    '',
    '',
    integerToAmount(toBudget, decimalPlaces),
  ]);

  return stringifyCsv(rows, [
    t('Category Group'),
    t('Category'),
    t('Budgeted'),
    t('Spent'),
    t('Balance'),
  ]);
}

export function getBudgetMonthCsvFilename(
  budgetName: string | undefined,
  month: string,
): string {
  const safeName = (budgetName ?? '').replace(/[\\/:*?"<>|]/g, '').trim();
  return `${safeName || 'budget'}-${month}.csv`;
}

export async function fetchBudgetMonthCells(
  month: string,
): Promise<BudgetMonthCells> {
  const values = await send('envelope-budget-month', { month });
  return new Map(values.map(({ name, value }) => [name, value]));
}
