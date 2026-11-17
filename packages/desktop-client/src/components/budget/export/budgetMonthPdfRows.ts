import type { CategoryGroupEntity } from '@actual-app/core/types/models';

import { collectBudgetMonthRows } from './budgetMonthRows';
import type { RawBudgetMonthRowKind } from './budgetMonthRows';

// `groupHeader` is a category group's combined name-and-totals row, shown in
// bold like `CategoryGroupMonth` on the envelope budget page. `category`
// rows are indented beneath it. `total` and `toBudget` are kept apart so the
// renderer can style To Budget differently from Total.
export type PdfRowType = 'groupHeader' | 'category' | 'total' | 'toBudget';

export type PdfRow = {
  type: PdfRowType;
  // The single "Category" column: the group name on group rows, the
  // category name on category rows, and "Total" / "To Budget" /
  // "Overbudgeted" on the summary rows.
  label: string;
  // Already formatted for display; '' for a blank cell.
  budgeted: string;
  spent: string;
  balance: string;
};

const ROW_TYPE_BY_KIND: Record<RawBudgetMonthRowKind, PdfRowType> = {
  group: 'groupHeader',
  category: 'category',
  income: 'groupHeader',
  incomeCategory: 'category',
  total: 'total',
  toBudget: 'toBudget',
};

type BuildBudgetMonthPdfRowsOptions = {
  month: string;
  categoryGroups: CategoryGroupEntity[];
  cells: Map<string, unknown>;
  showHiddenCategories: boolean;
  // Formats a raw integer-cent amount using the user's configured currency
  // and number format, e.g. a `useFormat()`-bound closure for the
  // 'financial' type.
  formatAmount: (value: number) => string;
};

// Turns one envelope budget month into an ordered list of PDF table rows,
// reusing the same row traversal the CSV export uses so the two formats
// show identical numbers. Each row is tagged with the kind of row it is so
// a renderer can style group/total rows distinctly from category rows.
export function buildBudgetMonthPdfRows({
  month,
  categoryGroups,
  cells,
  showHiddenCategories,
  formatAmount,
}: BuildBudgetMonthPdfRowsOptions): PdfRow[] {
  function amount(value: number | null): string {
    return value == null ? '' : formatAmount(value);
  }

  return collectBudgetMonthRows({
    month,
    categoryGroups,
    cells,
    showHiddenCategories,
  }).map(row => ({
    type: ROW_TYPE_BY_KIND[row.kind],
    // Category rows show only their own name; the group name appears once,
    // on the group's row.
    label:
      row.kind === 'category' || row.kind === 'incomeCategory'
        ? row.categoryName
        : row.groupName,
    budgeted: amount(row.budgeted),
    spent: amount(row.spent),
    balance: amount(row.balance),
  }));
}
