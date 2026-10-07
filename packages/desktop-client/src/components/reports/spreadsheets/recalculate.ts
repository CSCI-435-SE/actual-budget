import * as monthUtils from '@actual-app/core/shared/months';
import type {
  GroupedEntity,
  IntervalEntity,
} from '@actual-app/core/types/models';

import type {
  QueryDataEntity,
  UncategorizedEntity,
} from '#components/reports/ReportOptions';

import { filterHiddenItems } from './filterHiddenItems';

type recalculateProps = {
  item: UncategorizedEntity;
  intervals: Array<string>;
  assets: QueryDataEntity[];
  debts: QueryDataEntity[];
  groupByLabel: 'category' | 'categoryGroup' | 'payee' | 'account';
  showOffBudget?: boolean;
  showHiddenCategories?: boolean;
  showUncategorized?: boolean;
  startDate: string;
  endDate: string;
  // When set, the row adds up these categories instead of matching on
  // `item.id`; a parent category passes its own id and its subcategories'.
  categoryIds?: string[];
};

export function recalculate({
  item,
  intervals,
  assets,
  debts,
  groupByLabel,
  showOffBudget,
  showHiddenCategories,
  showUncategorized,
  startDate,
  endDate,
  categoryIds,
}: recalculateProps): GroupedEntity {
  let totalAssets = 0;
  let totalDebts = 0;
  let totalSpent = 0;
  // Budget rows also carry what each category spent.
  const hasSpent = [...assets, ...debts].some(row => row.spent !== undefined);
  const sumSpent = (rows: QueryDataEntity[]) =>
    rows.reduce((a, v) => a + (v.spent ?? 0), 0);
  const groupsByCategory =
    groupByLabel === 'category' || groupByLabel === 'categoryGroup';
  const matchesItem = (row: QueryDataEntity) =>
    categoryIds
      ? categoryIds.includes(row.category)
      : row[groupByLabel] === (item.id ?? null) ||
        (item.uncategorized_id && groupsByCategory);

  const intervalData = intervals.reduce(
    (arr: IntervalEntity[], intervalItem, index) => {
      const last = arr.length === 0 ? null : arr[arr.length - 1];

      const assetRows = filterHiddenItems(
        item,
        assets,
        showOffBudget,
        showHiddenCategories,
        showUncategorized,
        groupsByCategory,
      ).filter(asset => asset.date === intervalItem && matchesItem(asset));
      const intervalAssets = assetRows.reduce((a, v) => a + v.amount, 0);
      totalAssets += intervalAssets;

      const debtRows = filterHiddenItems(
        item,
        debts,
        showOffBudget,
        showHiddenCategories,
        showUncategorized,
        groupsByCategory,
      ).filter(debt => debt.date === intervalItem && matchesItem(debt));
      const intervalDebts = debtRows.reduce((a, v) => a + v.amount, 0);
      totalDebts += intervalDebts;

      // Each budget row is in exactly one of the two lists, so this
      // counts every row's spending once.
      const intervalSpent = sumSpent(assetRows) + sumSpent(debtRows);
      totalSpent += intervalSpent;

      const intervalTotals = intervalAssets + intervalDebts;

      const change = last ? intervalTotals - last.totalTotals : 0;

      arr.push({
        date: intervalItem,
        totalAssets: intervalAssets,
        totalDebts: intervalDebts,
        netAssets: intervalTotals > 0 ? intervalTotals : 0,
        netDebts: intervalTotals < 0 ? intervalTotals : 0,
        totalTotals: intervalTotals,
        totalBudgeted: intervalTotals,
        ...(hasSpent && { totalSpent: intervalSpent }),
        change,
        intervalStartDate: index === 0 ? startDate : intervalItem,
        intervalEndDate:
          index + 1 === intervals.length
            ? endDate
            : monthUtils.subDays(intervals[index + 1], 1),
      });

      return arr;
    },
    [],
  );

  const totalTotals = totalAssets + totalDebts;

  return {
    id: item.id || '',
    name: item.name,
    uncategorizedId: item.uncategorized_id,
    totalAssets,
    totalDebts,
    netAssets: totalTotals > 0 ? totalTotals : 0,
    netDebts: totalTotals < 0 ? totalTotals : 0,
    totalTotals,
    totalBudgeted: totalTotals,
    ...(hasSpent && { totalSpent }),
    intervalData,
  };
}
