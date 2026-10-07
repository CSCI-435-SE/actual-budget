import type { NavigateFunction } from 'react-router';

import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AccountEntity,
  balanceTypeOpType,
  CategoryEntity,
  CategoryGroupEntity,
  RuleConditionEntity,
} from '@actual-app/core/types/models';

import { ReportOptions } from '#components/reports/ReportOptions';
import {
  expandSubcategoryConditions,
  getSubcategoryIdsByParent,
  getSubcategoryIdsOfHiddenParents,
} from '#components/reports/spreadsheets/subcategories';

type showActivityProps = {
  navigate: NavigateFunction;
  categories: { list: CategoryEntity[]; grouped: CategoryGroupEntity[] };
  accounts: AccountEntity[];
  balanceTypeOp: balanceTypeOpType;
  filters: RuleConditionEntity[];
  showHiddenCategories: boolean;
  showOffBudget: boolean;
  type: string;
  startDate: string;
  endDate?: string;
  field?: string; // 'group' becomes a category_group filter
  id?: string | string[]; // changed: supports array for oneOf
  uncategorizedId?: 'off_budget' | 'transfer' | 'other' | 'all';
  interval?: string;
  // A category's report row includes its subcategories, so its activity
  // does too. Set to false for a row of the category's own amounts only.
  includeSubcategories?: boolean;
};

export function showActivity({
  navigate,
  categories,
  accounts,
  balanceTypeOp,
  filters,
  showHiddenCategories,
  showOffBudget,
  type,
  startDate,
  endDate,
  field,
  id,
  uncategorizedId,
  interval = 'Day',
  includeSubcategories = true,
}: showActivityProps) {
  const isOutFlow =
    balanceTypeOp === 'totalDebts' || type === 'debts' ? true : false;
  const hiddenCategories = [
    ...categories.list.filter(f => f.hidden).map(e => e.id),
    ...getSubcategoryIdsOfHiddenParents(categories.grouped),
  ];
  let drilldownId = id;
  if (field === 'category' && includeSubcategories && typeof id === 'string') {
    const subcategoryIds = getSubcategoryIdsByParent(categories.grouped).get(
      id,
    );
    if (subcategoryIds) {
      drilldownId = [id, ...subcategoryIds];
    }
  }
  const offBudgetAccounts = accounts.filter(f => f.offbudget).map(e => e.id);
  const fromDate =
    interval === 'Weekly'
      ? 'dayFromDate'
      : (((ReportOptions.intervalMap.get(interval) || 'Day').toLowerCase() +
          'FromDate') as 'dayFromDate' | 'monthFromDate' | 'yearFromDate');
  const isDateOp = interval === 'Weekly' || type !== 'time';
  const drilldownFilter =
    field === 'category' && uncategorizedId === 'transfer'
      ? {
          field: 'transfer',
          op: 'is',
          value: true,
          type: 'boolean',
        }
      : field === 'group'
        ? !uncategorizedId &&
          id && {
            field: 'category_group',
            op: 'is',
            value: id,
            type: 'id',
          }
        : drilldownId && {
            // changed: use oneOf when id is an array, is when it's a string
            field,
            op: Array.isArray(drilldownId) ? 'oneOf' : 'is',
            value: drilldownId,
            type: 'id',
          };

  const filterConditions = [
    // A filter on a parent covers its subcategories, as in the report
    ...expandSubcategoryConditions(filters, categories.grouped),
    drilldownFilter,
    {
      field: 'date',
      op: isDateOp ? 'gte' : 'is',
      value: isDateOp ? startDate : monthUtils[fromDate](startDate),
      type: 'date',
    },
    isDateOp && {
      field: 'date',
      op: 'lte',
      value: endDate,
      options: { date: true },
    },
    !(
      ['netAssets', 'netDebts'].includes(balanceTypeOp) ||
      (['totalTotals', 'totalBudgeted'].includes(balanceTypeOp) &&
        (type === 'totals' || type === 'time'))
    ) && {
      field: 'amount',
      op: 'gte',
      value: 0,
      options: {
        type: 'number',
        inflow: !isOutFlow,
        outflow: isOutFlow,
      },
    },
    hiddenCategories.length > 0 &&
      !showHiddenCategories && {
        field: 'category',
        op: 'notOneOf',
        value: hiddenCategories,
        type: 'id',
      },
    offBudgetAccounts.length > 0 &&
      !showOffBudget && {
        field: 'account',
        op: 'notOneOf',
        value: offBudgetAccounts,
        type: 'id',
      },
  ].filter(f => f);

  void navigate(balanceTypeOp === 'totalBudgeted' ? '/budget' : '/accounts', {
    state:
      balanceTypeOp === 'totalBudgeted'
        ? { goBack: true }
        : { goBack: true, filterConditions },
  });
}
