import { send } from '@actual-app/core/platform/client/connection';
import { integerToAmount } from '@actual-app/core/shared/util';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';
import { t } from 'i18next';

import { stringifyCsv } from '#util/csv';

import { collectBudgetMonthRows } from './budgetMonthRows';

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
  function amount(value: number | null): number | '' {
    return value == null ? '' : integerToAmount(value, decimalPlaces);
  }

  const rawRows = collectBudgetMonthRows({
    month,
    categoryGroups,
    cells,
    showHiddenCategories,
  });

  const rows: CsvRow[] = rawRows.map(row => [
    row.groupName,
    row.categoryName,
    amount(row.budgeted),
    amount(row.spent),
    amount(row.balance),
  ]);

  return stringifyCsv(rows, [
    t('Category Group'),
    t('Category'),
    t('Budgeted'),
    t('Spent'),
    t('Balance'),
  ]);
}

export function getBudgetMonthExportFilename(
  budgetName: string | undefined,
  month: string,
  extension: 'csv' | 'pdf',
): string {
  const safeName = (budgetName ?? '').replace(/[\\/:*?"<>|]/g, '').trim();
  return `${safeName || 'budget'}-${month}.${extension}`;
}

export async function fetchBudgetMonthCells(
  month: string,
): Promise<BudgetMonthCells> {
  const values = await send('envelope-budget-month', { month });
  return new Map(values.map(({ name, value }) => [name, value]));
}
