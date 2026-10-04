import { t } from 'i18next';
import type { Styles, UserOptions } from 'jspdf-autotable';

import type { PdfRow } from './budgetMonthPdfRows';

const EMPHASIZED_ROW_STYLES: Partial<Styles> = {
  fontStyle: 'bold',
  fillColor: [235, 235, 235],
};

type AutoTableCellDef = { content: string; styles?: Partial<Styles> };
type AutoTableRow = Record<
  'categoryGroup' | 'category' | 'budgeted' | 'spent' | 'balance',
  AutoTableCellDef
>;

// `groupHeader`/`groupSubtotal`/`grandTotal` all share one emphasized style;
// only `category` rows are left unstyled. `groupSubtotal` is never actually
// emitted by buildBudgetMonthPdfRows (see that file's comment), but is
// handled here anyway since the type allows it.
export function toAutoTableRows(rows: PdfRow[]): AutoTableRow[] {
  return rows.map(row => {
    const styles = row.type === 'category' ? undefined : EMPHASIZED_ROW_STYLES;
    const cell = (content: string): AutoTableCellDef =>
      styles ? { content, styles } : { content };

    return {
      categoryGroup: cell(row.categoryGroup),
      category: cell(row.category),
      budgeted: cell(row.budgeted),
      spent: cell(row.spent),
      balance: cell(row.balance),
    };
  });
}

type BuildBudgetMonthPdfBytesOptions = {
  title: string;
  rows: PdfRow[];
};

// Renders an envelope budget month's already-built PdfRows into a PDF,
// lazy-loading jsPDF/jspdf-autotable so neither appears in the main bundle.
// Does not walk categories or read spreadsheet cells itself — all of that
// data work is done by buildBudgetMonthPdfRows, so the PDF can never show
// different numbers than the CSV export.
export async function buildBudgetMonthPdfBytes({
  title,
  rows,
}: BuildBudgetMonthPdfBytesOptions): Promise<Uint8Array> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt' });

  doc.setFontSize(14);
  doc.text(title, 40, 40);

  const columns: UserOptions['columns'] = [
    { header: t('Category Group'), dataKey: 'categoryGroup' },
    { header: t('Category'), dataKey: 'category' },
    { header: t('Budgeted'), dataKey: 'budgeted' },
    { header: t('Spent'), dataKey: 'spent' },
    { header: t('Balance'), dataKey: 'balance' },
  ];

  autoTable(doc, {
    startY: 60,
    // Repeats the header row on every page and keeps a row from splitting
    // across a page break.
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'plain',
    styles: { overflow: 'linebreak', cellWidth: 'auto' },
    columnStyles: {
      budgeted: { halign: 'right' },
      spent: { halign: 'right' },
      balance: { halign: 'right' },
    },
    columns,
    body: toAutoTableRows(rows),
    didDrawPage: data => {
      const pageSize = doc.internal.pageSize;
      doc.setFontSize(9);
      doc.text(
        t('Page {{page}}', { page: data.pageNumber }),
        pageSize.getWidth() - 60,
        pageSize.getHeight() - 20,
      );
    },
  });

  return new Uint8Array(doc.output('arraybuffer'));
}
