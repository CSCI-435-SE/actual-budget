import type { Locator, Page } from '@playwright/test';

export class CustomReportPage {
  readonly page: Page;
  readonly pageContent: Locator;
  readonly showLegendButton: Locator;
  readonly showSummaryButton: Locator;
  readonly showLabelsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageContent = page.getByTestId('reports-page');

    this.showLegendButton = this.pageContent.getByRole('button', {
      name: 'Show Legend',
    });
    this.showSummaryButton = this.pageContent.getByRole('button', {
      name: 'Show Summary',
    });
    this.showLabelsButton = this.pageContent.getByRole('button', {
      name: 'Show Labels',
    });
  }

  async selectViz(vizName: string | RegExp) {
    await this.pageContent.getByRole('button', { name: vizName }).click();
  }

  async selectBalanceType(current: string, type: string) {
    await this.pageContent
      .getByRole('button', { name: current, exact: true })
      .click();
    await this.page.getByRole('button', { name: type, exact: true }).click();
  }

  /** The data table row whose first column is exactly `name`. */
  getTableRow(name: string) {
    return this.pageContent.getByTestId('row').filter({
      has: this.page.getByTitle(name, { exact: true }),
    });
  }

  /** The first-column names of the data table, top to bottom. */
  async getTableRowNames() {
    return this.pageContent
      .getByTestId('row')
      .evaluateAll(rows =>
        rows
          .map(row => row.querySelector('[title]')?.getAttribute('title'))
          .filter((name): name is string => !!name),
      );
  }

  /** A data table row's amounts in cents, left to right. */
  async getTableRowAmounts(name: string) {
    const text = await this.getTableRow(name).first().innerText();
    return text
      .split(/\s+/)
      .map(part => part.replace(/[−‒–]/, '-'))
      .filter(part => /^-?[\d,]+\.\d\d$/.test(part))
      .map(part => Math.round(parseFloat(part.replace(/,/g, '')) * 100));
  }

  /** How far a data table row's name is indented, in pixels. */
  async getTableRowIndent(name: string) {
    return this.getTableRow(name)
      .first()
      .getByTitle(name, { exact: true })
      .locator('> div')
      .first()
      .evaluate(cell => parseFloat(getComputedStyle(cell).paddingLeft));
  }

  /** A category's checkbox in the sidebar's category list. */
  getCategoryCheckbox(name: string) {
    return this.pageContent.getByRole('checkbox', { name, exact: true });
  }

  async selectMode(mode: 'total' | 'time') {
    switch (mode) {
      case 'total':
        await this.pageContent
          .getByRole('button', { name: 'Total', exact: true })
          .click();
        break;
      case 'time':
        await this.pageContent
          .getByRole('button', { name: 'Time', exact: true })
          .click();
        break;
      default:
        throw new Error(`Unrecognized mode: ${String(mode)}`);
    }
  }
}
