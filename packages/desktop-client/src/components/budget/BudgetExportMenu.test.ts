import { describe, expect, it } from 'vitest';

import { buildExportMenuItems } from './BudgetExportMenu';

const labels = {
  exportAsCsv: 'Export as CSV',
  exportAsPdf: 'Export as PDF',
  csvSection: 'CSV',
  pdfSection: 'PDF',
};

const formatMonth = (month: string) => `Formatted ${month}`;

describe('buildExportMenuItems', () => {
  it('offers a plain CSV and PDF entry for a single month', () => {
    expect(buildExportMenuItems(['2026-01'], labels, formatMonth)).toEqual([
      { name: 'csv:2026-01', text: 'Export as CSV' },
      { name: 'pdf:2026-01', text: 'Export as PDF' },
    ]);
  });

  it('groups by format with a labeled section per format for multiple months', () => {
    const items = buildExportMenuItems(
      ['2026-01', '2026-02'],
      labels,
      formatMonth,
    );

    expect(items).toEqual([
      { type: expect.anything(), name: 'CSV', text: '' },
      { name: 'csv:2026-01', text: 'Formatted 2026-01' },
      { name: 'csv:2026-02', text: 'Formatted 2026-02' },
      { type: expect.anything(), name: 'PDF', text: '' },
      { name: 'pdf:2026-01', text: 'Formatted 2026-01' },
      { name: 'pdf:2026-02', text: 'Formatted 2026-02' },
    ]);
  });

  it('lists every visible month under both the CSV and PDF sections', () => {
    const items = buildExportMenuItems(
      ['2026-01', '2026-02', '2026-03'],
      labels,
      formatMonth,
    );

    const csvEntries = items.filter(item => item.name.startsWith('csv:'));
    const pdfEntries = items.filter(item => item.name.startsWith('pdf:'));
    expect(csvEntries).toHaveLength(3);
    expect(pdfEntries).toHaveLength(3);
  });
});
