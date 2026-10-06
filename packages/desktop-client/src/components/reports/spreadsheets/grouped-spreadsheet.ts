import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { GroupedEntity } from '@actual-app/core/types/models';
import { t } from 'i18next';

import {
  categoryLists,
  ReportOptions,
} from '#components/reports/ReportOptions';
import type {
  QueryDataEntity,
  UncategorizedEntity,
} from '#components/reports/ReportOptions';
import type { useSpreadsheet } from '#hooks/useSpreadsheet';

import type { createCustomSpreadsheetProps } from './custom-spreadsheet';
import { fetchSpreadsheetQueryData } from './fetchSpreadsheetQueryData';
import { filterEmptyRows } from './filterEmptyRows';
import { recalculate } from './recalculate';
import { sortData } from './sortData';
import {
  getNestedSubcategoryIds,
  getSubcategoryIdsByParent,
} from './subcategories';
import {
  determineIntervalRange,
  trimGroupedDataIntervals,
} from './trimIntervals';

export function createGroupedSpreadsheet({
  startDate,
  endDate,
  interval,
  categories,
  budgetType = 'envelope',
  conditions = [],
  conditionsOp,
  showEmpty,
  showOffBudget,
  showHiddenCategories,
  showUncategorized,
  trimIntervals,
  balanceTypeOp,
  sortByOp,
  firstDayOfWeekIdx,
}: createCustomSpreadsheetProps) {
  const [categoryList, categoryGroup] = categoryLists(categories);
  const subcategoryIdsByParent = getSubcategoryIdsByParent(categories.grouped);
  const nestedSubcategoryIds = getNestedSubcategoryIds(subcategoryIdsByParent);

  return async (
    spreadsheet: ReturnType<typeof useSpreadsheet>,
    setData: (data: GroupedEntity[]) => void,
  ) => {
    if (categoryList.length === 0) {
      setData([]);
      return;
    }

    const { filters } = await send('make-filters-from-conditions', {
      conditions: conditions.filter(cond => !cond.customName),
    });
    const conditionsOpKey = conditionsOp === 'or' ? '$or' : '$and';

    let assets: QueryDataEntity[];
    let debts: QueryDataEntity[];

    ({ assets, debts } = await fetchSpreadsheetQueryData({
      balanceTypeOp,
      startDate,
      endDate,
      interval,
      categories: categories.list,
      categoryGroups: categories.grouped,
      conditions,
      conditionsOp,
      conditionsOpKey,
      filters,
      budgetType,
    }));

    if (interval === 'Weekly' && balanceTypeOp !== 'totalBudgeted') {
      debts = debts.map(d => {
        return {
          ...d,
          date: monthUtils.weekFromDate(d.date, firstDayOfWeekIdx),
        };
      });
      assets = assets.map(d => {
        return {
          ...d,
          date: monthUtils.weekFromDate(d.date, firstDayOfWeekIdx),
        };
      });
    }

    const intervals =
      interval === 'Weekly'
        ? monthUtils.weekRangeInclusive(startDate, endDate, firstDayOfWeekIdx)
        : monthUtils[
            ReportOptions.intervalRange.get(interval) || 'rangeInclusive'
          ](startDate, endDate);

    const groupedData: GroupedEntity[] = categoryGroup.map(
      group => {
        const grouped = recalculate({
          item: group,
          intervals,
          assets,
          debts,
          groupByLabel: 'categoryGroup',
          showOffBudget,
          showHiddenCategories,
          showUncategorized,
          startDate,
          endDate,
        });

        const calculateCategory = (
          item: UncategorizedEntity,
          categoryIds?: string[],
        ) =>
          recalculate({
            item,
            intervals,
            assets,
            debts,
            groupByLabel: 'category',
            showOffBudget,
            showHiddenCategories,
            showUncategorized,
            startDate,
            endDate,
            categoryIds,
          });

        // Only top-level categories go in `categories`, each parent with
        // its subcategories rolled into it, so adding up `categories`
        // never counts a subcategory twice. The rows shown under a parent
        // go in its `subcategories`, which nothing adds up.
        const stackedCategories =
          group.categories &&
          group.categories
            .filter(item => !nestedSubcategoryIds.has(item.id))
            .map(item => {
              const subcategoryIds = subcategoryIdsByParent.get(item.id);
              if (!subcategoryIds) {
                return calculateCategory(item);
              }

              const subcategories = (group.categories ?? [])
                .filter(cat => subcategoryIds.includes(cat.id))
                .map(cat => calculateCategory(cat))
                .filter(i =>
                  filterEmptyRows({ showEmpty, data: i, balanceTypeOp }),
                )
                .sort(sortData({ balanceTypeOp, sortByOp }));
              const unallocated: GroupedEntity = {
                ...calculateCategory(item),
                name:
                  balanceTypeOp === 'totalBudgeted'
                    ? t('Unallocated')
                    : t('Not in a subcategory'),
                isUnallocated: true,
              };

              return {
                ...calculateCategory(item, [item.id, ...subcategoryIds]),
                subcategories: [
                  ...subcategories,
                  ...(filterEmptyRows({
                    showEmpty,
                    data: unallocated,
                    balanceTypeOp,
                  })
                    ? [unallocated]
                    : []),
                ],
              };
            });

        return {
          ...grouped,
          categories:
            stackedCategories &&
            stackedCategories.filter(i =>
              filterEmptyRows({ showEmpty, data: i, balanceTypeOp }),
            ),
        };
      },
      [startDate, endDate],
    );

    const groupedDataFiltered = groupedData.filter(i =>
      filterEmptyRows({ showEmpty, data: i, balanceTypeOp }),
    );

    // Determine interval range across all groups and their nested categories
    const allGroupsForTrimming: GroupedEntity[] = [];
    groupedDataFiltered.forEach(group => {
      allGroupsForTrimming.push(group);
      if (group.categories) {
        allGroupsForTrimming.push(...group.categories);
      }
    });

    const { startIndex, endIndex } = determineIntervalRange(
      allGroupsForTrimming,
      groupedDataFiltered.length > 0 ? groupedDataFiltered[0].intervalData : [],
      trimIntervals,
      balanceTypeOp,
    );

    // Trim all groupedData intervals (including nested categories) based on the range
    trimGroupedDataIntervals(groupedDataFiltered, startIndex, endIndex);

    const sortedGroupedDataFiltered = [...groupedDataFiltered]
      .sort(sortData({ balanceTypeOp, sortByOp }))
      .map(g => {
        g.categories = [...(g.categories ?? [])].sort(
          sortData({ balanceTypeOp, sortByOp }),
        );
        return g;
      });

    setData(sortedGroupedDataFiltered);
  };
}
