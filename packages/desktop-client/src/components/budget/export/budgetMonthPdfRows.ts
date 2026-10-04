import type { CategoryGroupEntity } from '@actual-app/core/types/models';

import { collectBudgetMonthRows } from './budgetMonthRows';
import type { RawBudgetMonthRowKind } from './budgetMonthRows';

// The envelope budget page renders a category group's name and its
// Budgeted/Spent/Balance as one combined, bold row (see
// `CategoryGroupMonth` in EnvelopeBudgetComponents.tsx) — there is no
// separate header-then-subtotal split to preserve. `groupHeader` is used for
// that combined row; `groupSubtotal` is kept in the type for the renderer's
// vocabulary (per the issue's acceptance criteria) but is never emitted here.
export type PdfRowType =
  | 'groupHeader'
  | 'category'
  | 'groupSubtotal'
  | 'grandTotal';

export type PdfRow = {
  type: PdfRowType;
  categoryGroup: string;
  category: string;
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
  total: 'grandTotal',
  toBudget: 'grandTotal',
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
    categoryGroup: row.groupName,
    category: row.categoryName,
    budgeted: amount(row.budgeted),
    spent: amount(row.spent),
    balance: amount(row.balance),
  }));
}
