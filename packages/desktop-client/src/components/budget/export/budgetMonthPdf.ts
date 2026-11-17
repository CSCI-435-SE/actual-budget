import { t } from 'i18next';
import type { jsPDF } from 'jspdf';
import type { Styles, Table, UserOptions } from 'jspdf-autotable';

import type { PdfRow, PdfRowType } from './budgetMonthPdfRows';
import { toPdfSafeText } from './pdfText';

const PAGE_MARGIN = 40;
const TITLE_Y = 40;
const TABLE_START_Y = 60;
// Wide enough for "-$1,234,567.89" in bold 10pt (~67pt of text) plus cell
// padding, so amounts never wrap or get cut off.
const MONEY_COLUMN_WIDTH = 95;
const CATEGORY_INDENT = 16;
const CELL_PADDING = 5;

// jsPDF replaces this placeholder with the real page count once the whole
// document has been laid out (see `putTotalPages`).
const TOTAL_PAGES_PLACEHOLDER = '{total_pages_count_string}';

// Colors are single gray levels (0 = black, 255 = white) so the PDF reads
// the same when printed in grayscale.
const ROW_STYLES: Record<PdfRowType, Partial<Styles>> = {
  category: {},
  groupHeader: { fontStyle: 'bold', fillColor: 235 },
  total: {
    fontStyle: 'bold',
    lineColor: 0,
    lineWidth: { top: 1 },
  },
  toBudget: {
    fontStyle: 'bold',
    fontSize: 11,
    fillColor: 215,
    lineColor: 0,
    lineWidth: { top: 1 },
  },
};

const HEAD_STYLES: Partial<Styles> = {
  fontStyle: 'bold',
  fillColor: 64,
  textColor: 255,
};

type MoneyKey = 'budgeted' | 'spent' | 'balance';
type ColumnKey = 'label' | MoneyKey;

type AutoTableCellDef = { content: string; styles: Partial<Styles> };
type AutoTableRow = Record<ColumnKey, AutoTableCellDef>;

// Converts PdfRows into autotable body rows: cleans every string so jsPDF's
// built-in font can draw it, and styles each row by its type. Category rows
// are indented beneath their group row.
export function toAutoTableRows(rows: PdfRow[]): AutoTableRow[] {
  return rows.map(row => {
    const styles = ROW_STYLES[row.type];
    const cell = (content: string): AutoTableCellDef => ({
      content: toPdfSafeText(content),
      styles,
    });

    const label = cell(row.label);
    if (row.type === 'category') {
      label.styles = {
        ...styles,
        cellPadding: {
          top: CELL_PADDING,
          right: CELL_PADDING,
          bottom: CELL_PADDING,
          left: CELL_PADDING + CATEGORY_INDENT,
        },
      };
    }

    return {
      label,
      budgeted: cell(row.budgeted),
      spent: cell(row.spent),
      balance: cell(row.balance),
    };
  });
}

function moneyHeader(content: string): AutoTableCellDef {
  return { content: toPdfSafeText(content), styles: { halign: 'right' } };
}

type RenderBudgetMonthPdfOptions = {
  title: string;
  rows: PdfRow[];
};

type RenderedBudgetMonthPdf = {
  doc: jsPDF;
  // The laid-out table, so tests can check how each cell was wrapped.
  table: Table;
};

// Lays out an envelope budget month's already-built PdfRows as a PDF,
// lazy-loading jsPDF/jspdf-autotable so neither appears in the main bundle.
// Does not walk categories or read spreadsheet cells itself; all of that
// data work is done by buildBudgetMonthPdfRows, so the PDF can never show
// different numbers than the CSV export.
export async function renderBudgetMonthPdf({
  title,
  rows,
}: RenderBudgetMonthPdfOptions): Promise<RenderedBudgetMonthPdf> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(toPdfSafeText(title), PAGE_MARGIN, TITLE_Y);
  doc.setFont('helvetica', 'normal');

  const moneyColumn: Partial<Styles> = {
    halign: 'right',
    cellWidth: MONEY_COLUMN_WIDTH,
  };

  const columns: UserOptions['columns'] = [
    { header: toPdfSafeText(t('Category')), dataKey: 'label' },
    { header: moneyHeader(t('Budgeted')), dataKey: 'budgeted' },
    { header: moneyHeader(t('Spent')), dataKey: 'spent' },
    { header: moneyHeader(t('Balance')), dataKey: 'balance' },
  ];

  // Filled in by the didDrawPage hook. A holder object rather than a `let`,
  // because TypeScript can't see that the hook assigns it.
  const drawn: { table?: Table } = {};

  autoTable(doc, {
    startY: TABLE_START_Y,
    margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, left: PAGE_MARGIN },
    // Repeats the header row on every page and keeps a row from splitting
    // across a page break.
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: CELL_PADDING,
      overflow: 'linebreak',
    },
    headStyles: HEAD_STYLES,
    columnStyles: {
      label: { cellWidth: 'auto' },
      budgeted: moneyColumn,
      spent: moneyColumn,
      balance: moneyColumn,
    },
    columns,
    body: toAutoTableRows(rows),
    didDrawPage: data => {
      drawn.table = data.table;
      const pageSize = doc.internal.pageSize;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(
        toPdfSafeText(
          t('Page {{page}} of {{total}}', {
            page: data.pageNumber,
            total: TOTAL_PAGES_PLACEHOLDER,
          }),
        ),
        PAGE_MARGIN,
        pageSize.getHeight() - 20,
      );
    },
  });

  doc.putTotalPages(TOTAL_PAGES_PLACEHOLDER);

  if (!drawn.table) {
    throw new Error('Budget month PDF table was not drawn');
  }

  return { doc, table: drawn.table };
}

type BuildBudgetMonthPdfBytesOptions = RenderBudgetMonthPdfOptions;

export async function buildBudgetMonthPdfBytes(
  options: BuildBudgetMonthPdfBytesOptions,
): Promise<Uint8Array> {
  const { doc } = await renderBudgetMonthPdf(options);
  return new Uint8Array(doc.output('arraybuffer'));
}
