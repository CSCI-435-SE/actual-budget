import { integerToAmount } from '@actual-app/core/shared/util';
import { t } from 'i18next';

import { stringifyCsv } from '#util/csv';

type IntervalRow = {
  date: string;
  budgeted: number;
  spent: number;
  balance: number;
  overspendingAdjustment: number;
};

export function buildBudgetAnalysisCsv(
  rows: IntervalRow[],
  decimalPlaces: number,
): string {
  const month = t('Month');
  const budgeted = t('Budgeted');
  const spent = t('Spent');
  const overspendingAdjustment = t('Overspending Adjustment');
  const balance = t('Balance');

  const columns = [month, budgeted, spent, overspendingAdjustment, balance];

  return stringifyCsv(
    rows.map(row => [
      row.date,
      integerToAmount(row.budgeted, decimalPlaces),
      integerToAmount(row.spent, decimalPlaces),
      integerToAmount(row.overspendingAdjustment, decimalPlaces),
      integerToAmount(row.balance, decimalPlaces),
    ]),
    columns,
  );
}
