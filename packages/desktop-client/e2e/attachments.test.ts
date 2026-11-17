import { readFileSync } from 'fs';
import { join } from 'path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { AccountPage } from './page-models/account-page';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

const RECEIPT = join(__dirname, 'data/receipt.png');
const INVOICE = join(__dirname, 'data/invoice.pdf');

test.describe('Transaction attachments', () => {
  let page: Page;
  let navigation: Navigation;
  let accountPage: AccountPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);
    const configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    await configurationPage.createTestFile();

    accountPage = await navigation.goToAccountPage('Ally Savings');
  });

  test.afterEach(async () => {
    await page?.close();
  });

  function attachmentsModal() {
    return page.getByTestId('transaction-attachments-modal');
  }

  function viewerModal() {
    return page.getByTestId('attachment-viewer-modal');
  }

  function rowsWithAttachments() {
    return accountPage.transactionTableRow.filter({
      has: page.getByTestId('attachment-icon'),
    });
  }

  async function attachFiles(modal: Locator, files: string[]) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await modal.getByRole('button', { name: 'Attach files' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(files);
  }

  async function removeAttachment(modal: Locator, name: string) {
    await modal.getByRole('button', { name: `Remove ${name}` }).click();
    const confirm = page.getByTestId('confirm-delete-modal');
    await expect(confirm).toContainText(`"${name}"`);
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(
      modal.getByRole('button', { name: `Open ${name}` }),
    ).toHaveCount(0);
  }

  // Clicks a button that opens a file in a new tab and returns the file's
  // contents. Headless Chromium has no PDF viewer, so there the PDF becomes
  // a download (reported on the opening page) and the tab closes, instead of
  // the tab showing it.
  async function openInNewTab(button: Locator): Promise<Buffer> {
    const newTabPromise = page.context().waitForEvent('page');
    const downloadPromise = page.waitForEvent('download');
    await button.click();
    const newTab = await newTabPromise;

    const download = await Promise.race([
      downloadPromise,
      newTab.waitForURL(/^blob:/).then(() => null),
    ]);
    if (download == null) {
      // A browser that shows the PDF: fetch what the tab is showing
      const body = await newTab.evaluate(async url => {
        const response = await fetch(url);
        return Array.from(new Uint8Array(await response.arrayBuffer()));
      }, newTab.url());
      await newTab.close();
      return Buffer.from(body);
    }

    expect(download.url()).toMatch(/^blob:/);
    const path = await download.path();
    return readFileSync(path);
  }

  test('attaches files, keeps them after a reload, opens and removes them', async () => {
    await expect(rowsWithAttachments()).toHaveCount(0);

    // Attach from the row menu
    await accountPage.rightClickNthTransaction(0);
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Attachments' })
      .click();

    let modal = attachmentsModal();
    await expect(modal).toContainText('No files attached yet.');
    // The browser version warns where the files are kept
    await expect(modal).toContainText('stored in this browser only');

    await attachFiles(modal, [RECEIPT, INVOICE]);

    const files = modal.getByRole('list', { name: 'Attached files' });
    await expect(files.getByRole('listitem')).toHaveCount(2);
    await expect(
      files.getByRole('button', { name: 'Open receipt.png' }),
    ).toBeVisible();
    await expect(
      files.getByRole('button', { name: 'Open invoice.pdf' }),
    ).toBeVisible();

    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toBeHidden();

    // The row shows a paperclip without reloading
    await expect(rowsWithAttachments()).toHaveCount(1);
    const attachmentIcon = rowsWithAttachments().getByTestId('attachment-icon');
    await expect(attachmentIcon).toHaveAccessibleName('2 attachments');

    // Attachments are still there after a reload. The reload stays on this
    // account; navigating again here could race the app's own load and close
    // the modal opened below.
    await page.reload();
    await expect(rowsWithAttachments()).toHaveCount(1);

    // The paperclip opens the attachments too
    await rowsWithAttachments().getByTestId('attachment-icon').click();
    modal = attachmentsModal();
    await expect(modal.getByRole('listitem')).toHaveCount(2);

    // An image shows in the viewer, decoded from the stored file
    await modal.getByRole('button', { name: 'Open receipt.png' }).click();
    const image = viewerModal().getByRole('img', { name: 'receipt.png' });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate(img => (img as HTMLImageElement).naturalWidth))
      .toBe(4);
    await viewerModal().getByRole('button', { name: 'Close' }).click();
    await expect(viewerModal()).toBeHidden();

    // A PDF opens in a new tab
    await modal.getByRole('button', { name: 'Open invoice.pdf' }).click();
    const pdf = await openInNewTab(
      viewerModal().getByRole('button', { name: 'Open in new tab' }),
    );
    expect(pdf.equals(readFileSync(INVOICE))).toBe(true);
    await viewerModal().getByRole('button', { name: 'Close' }).click();

    // Removing asks first, then the files and the paperclip go away
    await removeAttachment(modal, 'receipt.png');
    await expect(attachmentIcon).toHaveAccessibleName('1 attachment');
    await removeAttachment(modal, 'invoice.pdf');
    await expect(modal).toContainText('No files attached yet.');

    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(rowsWithAttachments()).toHaveCount(0);
  });

  test('refuses a file type that is not allowed', async () => {
    await accountPage.rightClickNthTransaction(0);
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Attachments' })
      .click();
    const modal = attachmentsModal();

    await attachFiles(modal, [join(__dirname, 'data/test.csv')]);

    await expect(modal).toContainText("Couldn't attach test.csv");
    await expect(modal).toContainText(
      'Only JPEG, PNG, WebP and PDF files can be attached.',
    );
    await expect(modal).toContainText('No files attached yet.');
  });
});
