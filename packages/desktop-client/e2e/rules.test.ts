import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';
import type { RulesPage } from './page-models/rules-page';

test.describe('Rules', () => {
  let page: Page;
  let navigation: Navigation;
  let rulesPage: RulesPage;
  let configurationPage: ConfigurationPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    await configurationPage.createTestFile();

    rulesPage = await navigation.goToRulesPage();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('checks the page visuals', async () => {
    await rulesPage.searchFor('Dominion');
    await expect(page).toMatchThemeScreenshots();
  });

  test('creates a rule and makes sure it is applied when creating a transaction', async () => {
    await rulesPage.searchFor('Fast Internet');
    const editRuleModal = await rulesPage.createNewRule();
    await editRuleModal.fill({
      conditions: [
        {
          field: 'payee',
          op: 'is',
          value: 'Fast Internet',
        },
      ],
      actions: [
        {
          field: 'category',
          value: 'General',
        },
      ],
    });
    await editRuleModal.save();

    const rule = rulesPage.getNthRule(0);
    await expect(rule.conditions).toHaveText(['payee is Fast Internet']);
    await expect(rule.actions).toHaveText(['set category to General']);
    await expect(page).toMatchThemeScreenshots();

    const accountPage = await navigation.goToAccountPage('HSBC');

    await accountPage.createSingleTransaction({
      payee: 'Fast Internet',
      debit: '12.34',
    });

    const transaction = accountPage.getNthTransaction(0);
    await expect(transaction.payee).toHaveText('Fast Internet');
    await expect(transaction.category).toHaveText('General');
    await expect(transaction.debit).toHaveText('12.34');
    await expect(page).toMatchThemeScreenshots();
  });

  test('duplicates a rule without changing the original', async () => {
    await rulesPage.searchFor('Fast Internet');
    const createModal = await rulesPage.createNewRule();
    await createModal.fill({
      conditions: [{ field: 'payee', op: 'is', value: 'Fast Internet' }],
      actions: [{ field: 'category', value: 'General' }],
    });
    await createModal.save();
    await expect(createModal.locator).toBeHidden();
    await expect(rulesPage.getNthRule(0).actions).toHaveText([
      'set category to General',
    ]);

    // Duplicate only appears when exactly one rule is selected
    await expect(rulesPage.duplicateButton).toBeHidden();

    await rulesPage.selectNthRule(0);
    await expect(rulesPage.duplicateButton).toBeVisible();

    await rulesPage.selectNthRule(1);
    await expect(rulesPage.duplicateButton).toBeHidden();

    await rulesPage.selectNthRule(1);
    await expect(rulesPage.duplicateButton).toBeVisible();

    const duplicateModal = await rulesPage.duplicateSelectedRule();
    await expect(
      duplicateModal.conditionList.getByRole('textbox').first(),
    ).toHaveValue('Fast Internet');
    await duplicateModal.fill({
      actions: [{ field: 'category', value: 'Food' }],
    });
    await duplicateModal.save();
    await expect(duplicateModal.locator).toBeHidden();

    // The demo budget also has a schedule rule for this payee
    const rows = page.getByTestId('table').getByTestId('row');
    const categoryActions = async () =>
      (await rows.getByTestId('actions').allTextContents())
        .filter(text => text.startsWith('set category'))
        .sort();
    await expect(rows).toHaveCount(3);
    await expect
      .poll(categoryActions)
      .toEqual(['set category to Food', 'set category to General']);

    // The new rule is persisted
    await page.reload();
    await rulesPage.searchFor('Fast Internet');
    await expect(rows).toHaveCount(3);
    await expect
      .poll(categoryActions)
      .toEqual(['set category to Food', 'set category to General']);
  });

  test('duplicates a schedule rule without taking over the schedule', async () => {
    // The demo budget has a single schedule rule for this payee
    await rulesPage.searchFor('Fast Internet');
    const rows = page.getByTestId('table').getByTestId('row');
    await expect(rows).toHaveCount(1);
    await expect(rulesPage.getNthRule(0).actions).toHaveText([
      /^link schedule/,
    ]);

    await rulesPage.selectNthRule(0);
    const duplicateModal = await rulesPage.duplicateSelectedRule();
    await duplicateModal.fill({
      actions: [{ field: 'category', value: 'Food' }],
    });
    await duplicateModal.save();
    await expect(duplicateModal.locator).toBeHidden();

    await expect(rows).toHaveCount(2);
    await expect
      .poll(async () =>
        (await rows.getByTestId('actions').allTextContents()).sort(),
      )
      .toEqual([
        expect.stringMatching(/^link schedule/),
        'set category to Food',
      ]);
  });

  test('creates a split transaction rule and makes sure it is applied when creating a transaction', async () => {
    const editRuleModal = await rulesPage.createNewRule();
    await editRuleModal.fill({
      conditions: [
        {
          field: 'payee',
          op: 'is',
          value: 'Ikea',
        },
      ],
      actions: [
        {
          op: 'set',
          field: 'notes',
          value: 'food / entertainment',
        },
      ],
      splits: [
        [
          {
            field: 'a fixed percent of the remainder',
            value: '90',
          },
          {
            field: 'category',
            value: 'Entertainment',
          },
        ],
        [
          {
            field: 'an equal portion of the remainder',
          },
          {
            field: 'category',
            value: 'Food',
          },
        ],
      ],
    });
    await editRuleModal.save();

    const accountPage = await navigation.goToAccountPage(
      'Capital One Checking',
    );

    await accountPage.createSingleTransaction({
      debit: '100.00',
      payee: 'Ikea',
    });

    const transaction = accountPage.getNthTransaction(0);
    await expect(transaction.payee).toHaveText('Ikea');
    await expect(transaction.notes).toHaveText('food / entertainment');
    await expect(transaction.category).toHaveText('Split');
    await expect(transaction.debit).toHaveText('100.00');
    await expect(page).toMatchThemeScreenshots();

    const firstSplitTransaction = accountPage.getNthTransaction(1);
    await expect(firstSplitTransaction.payee).toHaveText('Ikea');
    await expect(firstSplitTransaction.debit).toHaveText('90.00');
    await expect(firstSplitTransaction.category).toHaveText('Entertainment');

    const secondSplitTransaction = accountPage.getNthTransaction(2);
    await expect(secondSplitTransaction.payee).toHaveText('Ikea');
    await expect(secondSplitTransaction.debit).toHaveText('10.00');
    await expect(secondSplitTransaction.category).toHaveText('Food');
  });

  test('right clicking a rule opens context menu', async () => {
    await rulesPage.searchFor('Fast Internet');
    await rulesPage.rightClickNthRule(0);
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Edit' })).toBeVisible();
  });
});
