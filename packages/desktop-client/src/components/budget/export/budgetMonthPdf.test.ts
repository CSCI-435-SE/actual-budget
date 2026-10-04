import { describe, expect, it } from 'vitest';

import { toAutoTableRows } from './budgetMonthPdf';
import type { PdfRow } from './budgetMonthPdfRows';

function row(overrides: Partial<PdfRow> = {}): PdfRow {
  return {
    type: 'category',
    categoryGroup: 'Bills',
    category: 'Rent',
    budgeted: '$120.00',
    spent: '-$120.00',
    balance: '$0.00',
    ...overrides,
  };
}

describe('toAutoTableRows', () => {
  it('maps every PdfRow field to a same-named cell', () => {
    const [result] = toAutoTableRows([row()]);

    expect(result.categoryGroup.content).toBe('Bills');
    expect(result.category.content).toBe('Rent');
    expect(result.budgeted.content).toBe('$120.00');
    expect(result.spent.content).toBe('-$120.00');
    expect(result.balance.content).toBe('$0.00');
  });

  it('leaves category rows unstyled', () => {
    const [result] = toAutoTableRows([row({ type: 'category' })]);

    expect(result.category.styles).toBeUndefined();
  });

  it.each(['groupHeader', 'groupSubtotal', 'grandTotal'] as const)(
    'bolds and shades %s rows',
    type => {
      const [result] = toAutoTableRows([row({ type })]);

      expect(result.categoryGroup.styles).toEqual({
        fontStyle: 'bold',
        fillColor: [235, 235, 235],
      });
    },
  );

  it('preserves row order', () => {
    const rows = toAutoTableRows([
      row({ type: 'groupHeader', category: '' }),
      row({ type: 'category', category: 'Rent' }),
      row({ type: 'category', category: 'Power' }),
      row({ type: 'grandTotal', categoryGroup: 'Total', category: '' }),
    ]);

    expect(rows.map(r => r.category.content)).toEqual([
      '',
      'Rent',
      'Power',
      '',
    ]);
  });
});
