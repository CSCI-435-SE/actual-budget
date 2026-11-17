import i18next from 'i18next';
import type { jsPDF } from 'jspdf';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildBudgetMonthPdfBytes,
  renderBudgetMonthPdf,
  toAutoTableRows,
} from './budgetMonthPdf';
import type { PdfRow, PdfRowType } from './budgetMonthPdfRows';

// With no resources loaded, i18next echoes the English key back with
// interpolation applied, which is what the PDF should contain.
beforeAll(async () => {
  await i18next.init({ lng: 'en', interpolation: { escapeValue: false } });
});

function row(overrides: Partial<PdfRow> = {}): PdfRow {
  return {
    type: 'category',
    label: 'Rent',
    budgeted: '$120.00',
    spent: '-$120.00',
    balance: '$0.00',
    ...overrides,
  };
}

// Every string jsPDF drew, in drawing order. jsPDF doesn't compress its
// content streams by default, so text is stored as `(escaped text) Tj`.
function pdfTextStrings(doc: jsPDF): string[] {
  const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1');
  return [...raw.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(match =>
    match[1].replace(/\\([()\\])/g, '$1'),
  );
}

// The vertical position of every one-line text run, as jsPDF writes it:
// `<x> <y> Td (text) Tj`. PDF y coordinates count up from the bottom of the
// page, so a run with y < 0 is drawn below the page and never seen.
function pdfTextYPositions(doc: jsPDF): Array<{ text: string; y: number }> {
  const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1');
  return [
    ...raw.matchAll(/(-?[\d.]+) (-?[\d.]+) Td\n\(((?:\\.|[^\\)])*)\) Tj/g),
  ].map(match => ({ text: match[3], y: Number(match[2]) }));
}

// Strings exactly as `useFormat(value, 'financial')` returns them for USD
// with the comma-dot format: the symbol is wrapped in U+202A/U+202C.
const USD = (amount: string) =>
  amount.startsWith('-')
    ? `-\u202A$\u202C${amount.slice(1)}`
    : `\u202A$\u202C${amount}`;

describe('toAutoTableRows', () => {
  it('maps the label and amounts to the four table columns', () => {
    const [result] = toAutoTableRows([row()]);

    expect(Object.keys(result)).toEqual([
      'label',
      'budgeted',
      'spent',
      'balance',
    ]);
    expect(result.label.content).toBe('Rent');
    expect(result.budgeted.content).toBe('$120.00');
    expect(result.spent.content).toBe('-$120.00');
    expect(result.balance.content).toBe('$0.00');
  });

  // AC1
  it('cleans formatted amounts so the PDF font can draw them', () => {
    const [result] = toAutoTableRows([
      row({ budgeted: USD('1,234.56'), balance: USD('-45.00') }),
    ]);

    expect(result.budgeted.content).toBe('$1,234.56');
    expect(result.balance.content).toBe('-$45.00');
  });

  it('preserves row order', () => {
    const rows = toAutoTableRows([
      row({ type: 'groupHeader', label: 'Bills' }),
      row({ type: 'category', label: 'Rent' }),
      row({ type: 'category', label: 'Power' }),
      row({ type: 'total', label: 'Total' }),
    ]);

    expect(rows.map(r => r.label.content)).toEqual([
      'Bills',
      'Rent',
      'Power',
      'Total',
    ]);
  });

  // AC5
  describe('row styles', () => {
    const types: PdfRowType[] = [
      'category',
      'groupHeader',
      'total',
      'toBudget',
    ];
    const styled = Object.fromEntries(
      types.map(type => [type, toAutoTableRows([row({ type })])[0]]),
    );

    it('gives every row type a different look', () => {
      const looks = types.map(type =>
        JSON.stringify(styled[type].spent.styles),
      );
      expect(new Set(looks).size).toBe(types.length);
    });

    it('makes To Budget look different from Total', () => {
      expect(styled.toBudget.balance.styles).not.toEqual(
        styled.total.balance.styles,
      );
    });

    // AC5 gives "a top border" as an example of setting summary rows apart.
    it('draws a top border above the Total and To Budget rows', () => {
      for (const type of ['total', 'toBudget'] as const) {
        const { lineWidth } = styled[type].balance.styles;
        if (typeof lineWidth !== 'object') {
          throw new Error(`${type} rows should set a per-side border`);
        }
        expect(Object.keys(lineWidth)).toEqual(['top']);
        expect(lineWidth.top).toBeGreaterThan(0);
      }
    });

    it('bolds group, Total and To Budget rows but not category rows', () => {
      expect(styled.category.label.styles.fontStyle).toBeUndefined();
      expect(styled.groupHeader.label.styles.fontStyle).toBe('bold');
      expect(styled.total.label.styles.fontStyle).toBe('bold');
      expect(styled.toBudget.label.styles.fontStyle).toBe('bold');
    });

    it('uses only gray levels so the PDF prints in grayscale', () => {
      for (const type of types) {
        for (const cell of Object.values(styled[type])) {
          const { fillColor, textColor, lineColor } = cell.styles;
          for (const color of [fillColor, textColor, lineColor]) {
            if (color !== undefined) {
              expect(typeof color).toBe('number');
            }
          }
        }
      }
    });

    it('indents category names beneath their group', () => {
      const padding = styled.category.label.styles.cellPadding;
      if (typeof padding !== 'object' || Array.isArray(padding)) {
        throw new Error('category names should set per-side padding');
      }
      expect(padding.left).toBeGreaterThan(padding.right ?? 0);
      expect(styled.groupHeader.label.styles.cellPadding).toBeUndefined();
    });
  });
});

describe('renderBudgetMonthPdf', () => {
  const sampleRows: PdfRow[] = [
    row({
      type: 'groupHeader',
      label: 'Bills',
      budgeted: USD('1,234.56'),
      spent: USD('-1,189.56'),
      balance: USD('45.00'),
    }),
    row({
      label: 'Rent',
      budgeted: USD('1,234.56'),
      spent: USD('-1,279.56'),
      balance: USD('-45.00'),
    }),
    row({
      type: 'total',
      label: 'Total',
      budgeted: USD('1,234.56'),
      spent: USD('-1,279.56'),
      balance: USD('-45.00'),
    }),
    row({
      type: 'toBudget',
      label: 'To Budget',
      budgeted: '',
      spent: '',
      balance: USD('100.00'),
    }),
  ];

  // AC1, AC2
  it('draws amounts exactly as the app shows them, with no stray characters', async () => {
    const { doc } = await renderBudgetMonthPdf({
      title: 'My Budget: November 2026',
      rows: sampleRows,
    });
    const strings = pdfTextStrings(doc);

    expect(strings).toContain('$1,234.56');
    expect(strings).toContain('-$45.00');
    for (const text of strings) {
      // A NUL means jsPDF fell back to two-byte encoding, which the
      // built-in font draws as garbage.
      expect(text).not.toContain('\u0000');
      expect(text).not.toContain('*');
    }
  });

  // AC6
  it('starts with the budget name and month as the title, above the table', async () => {
    const { doc, table } = await renderBudgetMonthPdf({
      title: 'My Budget: November 2026',
      rows: sampleRows,
    });

    expect(pdfTextStrings(doc)[0]).toBe('My Budget: November 2026');
    // The title's baseline is at y = 40; the header row must start below it.
    expect(table.head[0].cells.label.y).toBeGreaterThan(40);
  });

  // AC4
  it('fits the largest amounts on one line and wraps long names without cutting them off', async () => {
    const big = USD('-1,234,567.89');
    const longName =
      'Home maintenance, repairs, appliances and a few other occasional household costs';
    const { table } = await renderBudgetMonthPdf({
      title: 'My Budget: November 2026',
      rows: [
        row({
          type: 'groupHeader',
          label: 'Bills',
          budgeted: big,
          spent: big,
          balance: big,
        }),
        row({ label: longName, budgeted: big, spent: big, balance: big }),
        row({
          type: 'total',
          label: 'Total',
          budgeted: big,
          spent: big,
          balance: big,
        }),
        row({
          type: 'toBudget',
          label: 'To Budget',
          budgeted: '',
          spent: '',
          balance: big,
        }),
      ],
    });

    for (const tableRow of [...table.head, ...table.body]) {
      for (const key of ['budgeted', 'spent', 'balance']) {
        expect(tableRow.cells[key].text).toHaveLength(1);
      }
    }
    expect(table.body[0].cells.balance.text).toEqual(['-$1,234,567.89']);

    const longLabel = table.body[1].cells.label.text;
    expect(longLabel.length).toBeGreaterThan(1);
    expect(longLabel.join(' ')).toBe(longName);
  });

  // AC5: only summary rows are shaded; AC4: amounts and their headers line
  // up on the right. Checked on the laid-out table, after the theme and
  // column styles have been applied.
  it('lays out ordinary rows unshaded, a bold dark header, and right-aligned amounts', async () => {
    const { table } = await renderBudgetMonthPdf({
      title: 'My Budget: November 2026',
      rows: sampleRows,
    });
    const [headRow] = table.head;
    const categoryRow = table.body[1];

    for (const cell of Object.values(categoryRow.cells)) {
      expect(cell.styles.fillColor).toBe(false);
    }
    for (const cell of Object.values(headRow.cells)) {
      expect(cell.styles.fontStyle).toBe('bold');
      expect(cell.styles.fillColor).toEqual(expect.any(Number));
      expect(cell.styles.fillColor).toBeLessThan(128);
    }
    for (const key of ['budgeted', 'spent', 'balance']) {
      expect(headRow.cells[key].styles.halign).toBe('right');
      expect(categoryRow.cells[key].styles.halign).toBe('right');
    }
    expect(categoryRow.cells.label.styles.halign).toBe('left');
  });

  // AC7
  it('repeats the header, numbers every page "Page N of M" and never splits a row', async () => {
    // Long names wrap onto several lines, so rows are tall enough that one
    // would straddle a page break if splitting were allowed.
    const manyRows = Array.from({ length: 60 }, (_, i) =>
      row({
        label: `Category ${i + 1}: home maintenance, repairs, appliances, garden supplies and other occasional household costs`,
      }),
    );
    const { doc, table } = await renderBudgetMonthPdf({
      title: 'My Budget: November 2026',
      rows: manyRows,
    });
    const pages = doc.getNumberOfPages();
    const strings = pdfTextStrings(doc);

    expect(pages).toBeGreaterThan(1);
    expect(table.body[0].cells.label.text.length).toBeGreaterThan(1);
    for (const header of ['Category', 'Budgeted', 'Spent', 'Balance']) {
      expect(strings.filter(text => text === header)).toHaveLength(pages);
    }
    for (let page = 1; page <= pages; page++) {
      expect(strings).toContain(`Page ${page} of ${pages}`);
    }
    expect(table.body.some(tableRow => tableRow.spansMultiplePages)).toBe(
      false,
    );
  });

  // AC7: a page number drawn off the page doesn't number it. The footer
  // must sit inside the 40pt bottom margin, below the table.
  it('draws the page number inside the bottom margin of each page', async () => {
    const { doc } = await renderBudgetMonthPdf({
      title: 'My Budget: November 2026',
      rows: sampleRows,
    });
    const footers = pdfTextYPositions(doc).filter(run =>
      run.text.startsWith('Page '),
    );

    expect(footers).toHaveLength(doc.getNumberOfPages());
    for (const footer of footers) {
      expect(footer.y).toBeGreaterThan(0);
      expect(footer.y).toBeLessThan(40);
    }
  });
});

describe('buildBudgetMonthPdfBytes', () => {
  it('returns the bytes of a PDF file', async () => {
    const bytes = await buildBudgetMonthPdfBytes({
      title: 'My Budget: November 2026',
      rows: [row()],
    });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
  });
});
