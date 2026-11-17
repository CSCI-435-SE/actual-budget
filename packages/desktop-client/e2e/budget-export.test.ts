import { readFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

// Every string drawn in the PDF, in drawing order. jsPDF doesn't compress
// its content streams by default, so text is stored as `(escaped text) Tj`.
function pdfTextStrings(pdf: Buffer): string[] {
  const raw = pdf.toString('latin1');
  return [...raw.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(match =>
    match[1].replace(/\\([()\\])/g, '$1'),
  );
}

test.describe('Budget month PDF export', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    const configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    await configurationPage.createTestFile();

    // The stray characters only appear when a currency is set: that's when
    // the amounts carry invisible direction marks around the symbol.
    const settingsPage = await new Navigation(page).goToSettingsPage();
    await settingsPage.waitFor();
    await settingsPage.settings
      .getByRole('button', { name: 'None', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'USD - US Dollar ($)' }).click();
    await page.getByRole('link', { name: 'Budget', exact: true }).click();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('downloads a readable PDF of the budget month', async () => {
    await page.getByRole('button', { name: 'Export budget month' }).click();

    const menu = page.getByRole('menu');
    const singleMonthItem = menu.getByRole('button', { name: 'Export as PDF' });
    // With one month on screen the menu has "Export as PDF"; with several,
    // the PDF section comes last, so its last item is always a PDF month.
    const pdfItem = (await singleMonthItem.isVisible())
      ? singleMonthItem
      : menu.getByRole('button').last();

    const downloadPromise = page.waitForEvent('download');
    await pdfItem.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    const pdf = await readFile(await download.path());
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    const strings = pdfTextStrings(pdf);

    // AC6: "<Budget name>: <Month YYYY>"
    expect(strings[0]).toMatch(/^.+: [A-Z][a-z]+ \d{4}$/);
    // AC7: "Page N of M" footer
    expect(strings.some(text => /^Page 1 of \d+$/.test(text))).toBe(true);
    // AC1: amounts print as "$1,234.56" / "-$45.00"
    expect(
      strings.some(text => /^-?\$\d{1,3}(,\d{3})*\.\d{2}$/.test(text)),
    ).toBe(true);
    for (const text of strings) {
      // A NUL means jsPDF fell back to two-byte encoding, which the
      // built-in font draws as stray characters.
      expect(text).not.toContain('\u0000');
      expect(text).not.toContain('*');
    }
  });
});
