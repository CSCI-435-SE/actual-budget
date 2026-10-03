import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { AccountPage } from './account-page';

export class BudgetPage {
  readonly page: Page;
  readonly budgetSummary: Locator;
  readonly budgetTable: Locator;
  readonly budgetTableTotals: Locator;
  readonly selectedMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly budgetTableScrollContainer: Locator;

  constructor(page: Page) {
    this.page = page;

    this.budgetSummary = page.getByTestId('budget-summary');
    this.budgetTable = page.getByTestId('budget-table');
    this.budgetTableTotals = this.budgetTable.getByTestId('budget-totals');
    this.selectedMonthButton = page.getByTestId('selected-budget-month');
    this.nextMonthButton = page.getByTitle('Next month');
    this.budgetTableScrollContainer = page.getByTestId(
      'budget-table-scroll-container',
    );
  }

  async getScrollTop() {
    return this.budgetTableScrollContainer.evaluate(el => el.scrollTop);
  }

  async scrollToBottom() {
    await this.budgetTableScrollContainer.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
  }

  /**
   * Wait for the budget page to finish loading. The budget-table is
   * inside AutoSizer which returns null until layout provides width/
   * height, so it only appears after the page has fully mounted.
   */
  async waitFor(...options: Parameters<Locator['waitFor']>) {
    await this.budgetTable.waitFor(...options);
  }

  async getTotalBudgeted() {
    const totalBudgetedText = await this.budgetTableTotals
      .getByTestId(/total-budgeted$/)
      .textContent();

    if (!totalBudgetedText) {
      throw new Error('Failed to get total budgeted.');
    }

    return parseInt(totalBudgetedText, 10);
  }

  async getTotalSpent() {
    const totalSpentText = await this.budgetTableTotals
      .getByTestId(/total-spent$/)
      .textContent();

    if (!totalSpentText) {
      throw new Error('Failed to get total spent.');
    }

    return parseInt(totalSpentText, 10);
  }

  async getTotalLeftover() {
    const totalLeftoverText = await this.budgetTableTotals
      .getByTestId(/total-leftover$/)
      .textContent();

    if (!totalLeftoverText) {
      throw new Error('Failed to get total leftover.');
    }

    return parseInt(totalLeftoverText, 10);
  }

  async getTableTotals() {
    return {
      budgeted: await this.getTotalBudgeted(),
      spent: await this.getTotalSpent(),
      balance: await this.getTotalLeftover(),
    };
  }

  async setBudgetedAmount(
    categoryName: string,
    amount: string,
    monthIndex = 0,
  ) {
    const row = this.budgetTable
      .getByTestId('row')
      .filter({ hasText: categoryName })
      .first();
    const budgetCell = row.getByTestId('budget').nth(monthIndex);

    await budgetCell.click();
    const input = budgetCell.locator('input');
    await input.waitFor({ state: 'visible' });
    await input.fill(amount);
    await input.press('Enter');
  }

  async getSelectedMonth() {
    const selectedMonth =
      await this.selectedMonthButton.getAttribute('data-month');

    if (!selectedMonth) {
      throw new Error('Failed to get the selected month.');
    }

    return selectedMonth;
  }

  async #waitForNewMonthToLoad({
    currentMonth,
    errorMessage,
  }: {
    currentMonth: string;
    errorMessage: string;
  }) {
    await expect(this.selectedMonthButton, errorMessage).not.toHaveAttribute(
      'data-month',
      currentMonth,
    );

    return this.getSelectedMonth();
  }

  async goToNextMonth() {
    const currentMonth = await this.getSelectedMonth();

    await this.nextMonthButton.click();

    return await this.#waitForNewMonthToLoad({
      currentMonth,
      errorMessage: 'Failed to navigate to the next month.',
    });
  }

  async getBalanceForRow(idx: number) {
    const balanceText = await this.budgetTable
      .getByTestId('row')
      .nth(idx)
      .getByTestId('balance')
      .textContent();

    if (!balanceText) {
      throw new Error(`Failed to get balance on row index ${idx}.`);
    }

    return Math.round(parseFloat(balanceText.replace(/,/g, '')) * 100);
  }

  async getCategoryNameForRow(idx: number) {
    const categoryNameText = this.budgetTable
      .getByTestId('row')
      .nth(idx)
      .getByTestId('category-name')
      .textContent();

    if (!categoryNameText) {
      throw new Error(`Failed to get category name on row index ${idx}.`);
    }

    return categoryNameText;
  }

  async clickOnSpentAmountForRow(idx: number) {
    await this.budgetTable
      .getByTestId('row')
      .nth(idx)
      .getByTestId('category-month-spent')
      .click();
    return new AccountPage(this.page);
  }

  async clickOnSpentAmountForLastVisibleRow() {
    // Click the last spent-amount cell currently visible in the scroll container
    // without triggering Playwright's auto-scroll-into-view, so the scroll
    // position is not changed before the click handler captures it.
    const clicked = await this.page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="budget-table-scroll-container"]',
      );
      if (!container) {
        throw new Error('Budget scroll container not found');
      }
      const containerRect = container.getBoundingClientRect();
      const cells = container.querySelectorAll<HTMLElement>(
        '[data-testid="category-month-spent"]',
      );
      for (const cell of [...cells].reverse()) {
        const rect = cell.getBoundingClientRect();
        if (
          rect.top >= containerRect.top &&
          rect.bottom <= containerRect.bottom
        ) {
          cell.click();
          return true;
        }
      }
      return false;
    });

    if (!clicked) {
      throw new Error('No visible spent-amount cell found to click');
    }
    return new AccountPage(this.page);
  }

  async transferAllBalance(fromIdx: number, toIdx: number) {
    const toName = await this.getCategoryNameForRow(toIdx);
    if (!toName) {
      throw new Error(`Unable to get category name of row index ${toIdx}.`);
    }

    await this.budgetTable
      .getByTestId('row')
      .nth(fromIdx)
      .getByTestId('balance')
      .getByTestId(/^budget/)
      .click();

    await this.page
      .getByRole('button', { name: 'Transfer to another category' })
      .click();

    await this.page.getByPlaceholder('(none)').click();

    await this.page.keyboard.type(toName);
    await this.page.keyboard.press('Enter');

    await this.page.getByRole('button', { name: 'Transfer' }).click();
  }

  async rightClickCategory(idx: number) {
    await this.budgetTable
      .getByTestId('row')
      .nth(idx)
      .getByTestId('category-name')
      .click({ button: 'right' });
  }

  #parseAmount(text: string | null, description: string) {
    if (text == null) {
      throw new Error(`Failed to get ${description}.`);
    }
    return Math.round(parseFloat(text.replace(/,/g, '')) * 100);
  }

  /** The row of the category named exactly `name`. */
  getCategoryRow(name: string) {
    return this.budgetTable.getByTestId('row').filter({
      has: this.page
        .getByTestId('category-name')
        .getByText(name, { exact: true }),
    });
  }

  /** Category names in the order the budget table shows them. */
  async getCategoryNames() {
    return this.budgetTable.getByTestId('category-name').allTextContents();
  }

  /** A category's budgeted amount in cents. */
  async getBudgetedForCategory(name: string, monthIndex = 0) {
    const text = await this.getCategoryRow(name)
      .getByTestId('budget')
      .nth(monthIndex)
      .textContent();
    return this.#parseAmount(text, `budgeted amount for ${name}`);
  }

  /** The total budgeted in cents (unlike getTotalBudgeted, keeps cents). */
  async getTotalBudgetedAmount() {
    const text = await this.budgetTableTotals
      .getByTestId(/total-budgeted$/)
      .textContent();
    return this.#parseAmount(text, 'total budgeted');
  }

  async #openCategoryMenu(name: string) {
    await this.getCategoryRow(name)
      .getByTestId('category-name')
      .click({ button: 'right' });
  }

  async addSubcategory(parentName: string, name: string) {
    await this.#openCategoryMenu(parentName);
    await this.page.getByRole('button', { name: 'Add subcategory' }).click();

    const input = this.page.getByPlaceholder('New subcategory name');
    await input.fill(name);
    await input.press('Enter');
    await this.getCategoryRow(name).waitFor();
  }

  async removeFromParent(name: string) {
    await this.#openCategoryMenu(name);
    await this.page.getByRole('button', { name: 'Remove from parent' }).click();
  }

  async rightClickCategoryGroup(name: string) {
    // Assuming category groups have a specific text or role, or we can just find by text
    await this.budgetTable
      .getByText(name, { exact: true })
      .click({ button: 'right' });
  }
}
