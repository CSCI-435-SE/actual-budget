import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { BudgetPage } from './page-models/budget-page';
import { ConfigurationPage } from './page-models/configuration-page';
import type { CustomReportPage } from './page-models/custom-report-page';
import { Navigation } from './page-models/navigation';

test.describe('Subcategories in reports', () => {
  let page: Page;
  let navigation: Navigation;
  let budgetPage: BudgetPage;
  let reportPage: CustomReportPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);

    await page.goto('/');
    budgetPage = await new ConfigurationPage(page).createTestFile();
    await page.mouse.move(0, 0);

    // Food passes 150 of its 400 to a new Dining Out subcategory, which
    // then spends 42.50 of it.
    await budgetPage.setBudgetedAmount('Food', '400');
    await budgetPage.addSubcategory('Food', 'Dining Out');
    await budgetPage.setBudgetedAmount('Dining Out', '150');
    await expect
      .poll(() => budgetPage.getBudgetedForCategory('Dining Out'))
      .toBe(15000);

    const accountPage = await navigation.goToAccountPage(
      'Capital One Checking',
    );
    await accountPage.createSingleTransaction({
      payee: 'Kroger',
      category: 'Dining Out',
      debit: '42.50',
    });

    const reportsPage = await navigation.goToReportsPage();
    await reportsPage.waitToLoad();
    reportPage = await reportsPage.goToCustomReportPage();
    await reportPage.selectViz('Data Table');
    await reportPage.selectMode('total');
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('lists a subcategory under its parent, counted once', async () => {
    await expect(reportPage.getTableRow('Dining Out')).toBeVisible();

    const names = await reportPage.getTableRowNames();
    const food = names.indexOf('Food');
    expect(names.slice(food, food + 3)).toEqual([
      'Food',
      'Dining Out',
      'Not in a subcategory',
    ]);
    expect(await reportPage.getTableRowIndent('Dining Out')).toBeGreaterThan(
      await reportPage.getTableRowIndent('Food'),
    );

    const [diningOut] = await reportPage.getTableRowAmounts('Dining Out');
    const [ownSpending] = await reportPage.getTableRowAmounts(
      'Not in a subcategory',
    );
    const [foodTotal] = await reportPage.getTableRowAmounts('Food');
    expect(diningOut).toBe(-4250);
    expect(foodTotal).toBe(diningOut + ownSpending);
  });

  test('compares what a subcategory was given with what it spent', async () => {
    await reportPage.selectBalanceType('Payment', 'Budgeted');
    await expect(reportPage.getTableRow('Unallocated')).toBeVisible();

    // Budgeted, Spent, Remaining, Average
    const diningOut = await reportPage.getTableRowAmounts('Dining Out');
    expect(diningOut.slice(0, 3)).toEqual([15000, -4250, 10750]);

    const [foodBudgeted, foodSpent] =
      await reportPage.getTableRowAmounts('Food');
    const [keptBudgeted, keptSpent] =
      await reportPage.getTableRowAmounts('Unallocated');
    expect(foodBudgeted).toBe(15000 + keptBudgeted);
    expect(foodSpent).toBe(-4250 + keptSpent);
  });

  test('ticks a parent together with its subcategories', async () => {
    const food = reportPage.getCategoryCheckbox('Food');
    const diningOut = reportPage.getCategoryCheckbox('Dining Out');
    await expect(diningOut).toBeChecked();

    await food.click();
    await expect(food).not.toBeChecked();
    await expect(diningOut).not.toBeChecked();

    await food.click();
    await expect(diningOut).toBeChecked();
  });
});
