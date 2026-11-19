import { join } from 'path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileAccountPage } from './page-models/mobile-account-page';
import { MobileNavigation } from './page-models/mobile-navigation';

const RECEIPT = join(__dirname, 'data/receipt.png');

test.describe('Mobile transaction attachments', () => {
  let page: Page;
  let navigation: MobileNavigation;
  let accountPage: MobileAccountPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new MobileNavigation(page);
    const configurationPage = new ConfigurationPage(page);

    await page.setViewportSize({
      width: 350,
      height: 600,
    });
    await page.goto('/');
    await configurationPage.createTestFile();

    const accountsPage = await navigation.goToAccountsPage();
    // Ally Savings has no schedules, so its first row is a real transaction
    // rather than an upcoming one (which doesn't open the edit form)
    await accountsPage.accountListItems
      .filter({ hasText: 'Ally Savings' })
      .click();
    accountPage = new MobileAccountPage(page);
    await accountPage.waitFor();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('attaches a file, shows the paperclip, opens it, removes and undoes', async () => {
    const paperclips =
      accountPage.transactionList.getByTestId('attachment-icon');
    await expect(paperclips).toHaveCount(0);

    // Open a transaction and its attachments
    const transactionPage = await accountPage.openNthTransaction(0);
    const field =
      transactionPage.transactionForm.getByTestId('attachments-field');
    await expect(field).toHaveText('None');
    await field.click();

    const modal = page.getByTestId('transaction-attachments-modal');
    await expect(modal).toContainText('No files attached yet.');
    // Narrow layouts offer the camera too
    await expect(
      modal.getByRole('button', { name: 'Take photo' }),
    ).toBeVisible();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await modal.getByRole('button', { name: 'Attach files' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([RECEIPT]);

    const openReceipt = modal.getByRole('button', { name: 'Open receipt.png' });
    await expect(openReceipt).toBeVisible();

    // The image shows in the viewer
    await openReceipt.click();
    const viewer = page.getByTestId('attachment-viewer-modal');
    const image = viewer.getByRole('img', { name: 'receipt.png' });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate(img => (img as HTMLImageElement).naturalWidth))
      .toBe(4);
    await viewer.getByRole('button', { name: 'Close' }).click();
    await expect(viewer).toBeHidden();

    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toBeHidden();
    await expect(field).toHaveText('1 file');

    // Back in the list, the transaction shows a paperclip
    await page.getByRole('button', { name: 'Back' }).click();
    await accountPage.waitFor();
    await expect(paperclips).toHaveCount(1);
    await expect(paperclips).toHaveAccessibleName('1 attachment');

    // Remove it, then undo from the notification
    await accountPage.openNthTransaction(0);
    await field.click();
    await modal.getByRole('button', { name: 'Remove receipt.png' }).click();
    const confirm = page.getByTestId('confirm-delete-modal');
    await expect(confirm).toContainText('"receipt.png"');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(openReceipt).toHaveCount(0);
    await expect(modal).toContainText('No files attached yet.');

    // Undo is reachable while the modal is still open, and pressing it
    // doesn't close the modal
    const notification = page
      .getByRole('alert')
      .filter({ hasText: 'Removed "receipt.png".' });
    await notification.getByRole('button', { name: 'Undo' }).click();
    await expect(openReceipt).toBeVisible();
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(field).toHaveText('1 file');
    await page.getByRole('button', { name: 'Back' }).click();
    await accountPage.waitFor();
    await expect(paperclips).toHaveCount(1);
  });
});
