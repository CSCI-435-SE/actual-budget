import type { Locator, Page } from '@playwright/test';

import { EditRuleModal } from './edit-rule-modal';

export class RulesPage {
  readonly page: Page;
  readonly searchBox: Locator;
  readonly createNewRuleButton: Locator;
  readonly duplicateButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchBox = page.getByPlaceholder('Filter rules...');
    this.createNewRuleButton = page.getByRole('button', {
      name: 'Create new rule',
    });
    this.duplicateButton = page.getByRole('button', {
      name: 'Duplicate',
      exact: true,
    });
  }

  /**
   * Open the edit rule modal to create a new rule.
   */
  async createNewRule() {
    await this.createNewRuleButton.click();
    return new EditRuleModal(this.page.getByTestId('edit-rule-modal'));
  }

  /**
   * Retrieve the data for the nth-rule.
   * 0-based index
   */
  getNthRule(index: number) {
    const row = this.page.getByTestId('table').getByTestId('row').nth(index);

    return {
      conditions: row.getByTestId('conditions').locator(':scope > div'),
      actions: row.getByTestId('actions').locator(':scope > div'),
    };
  }

  /**
   * Toggle the selection checkbox of the nth-rule.
   * 0-based index
   */
  async selectNthRule(index: number) {
    const row = this.page.getByTestId('table').getByTestId('row').nth(index);
    // The checkbox is revealed on hover, so hover first like a real user
    await row.hover();
    await row.getByTestId('select').click();
  }

  /**
   * Open the edit rule modal pre-filled with a copy of the selected rule.
   */
  async duplicateSelectedRule() {
    await this.duplicateButton.click();
    return new EditRuleModal(this.page.getByTestId('edit-rule-modal'));
  }

  async searchFor(text: string) {
    await this.searchBox.fill(text);
  }

  async rightClickNthRule(index: number) {
    await this.page
      .getByTestId('table')
      .getByTestId('row')
      .nth(index)
      .click({ button: 'right' });
  }
}
