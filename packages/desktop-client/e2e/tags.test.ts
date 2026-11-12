import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';
import type { TagsPage } from './page-models/tags-page';

test.describe('Tags', () => {
  let page: Page;
  let configurationPage: ConfigurationPage;
  let navigation: Navigation;
  let tagsPage: TagsPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    await configurationPage.createTestFile();

    tagsPage = await navigation.goToTagsPage();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('creates a tag with a description', async () => {
    // The test budget already seeds common tags like #groceries, so use a
    // name it doesn't include
    await tagsPage.createTag('pet-supplies', 'Food and vet visits');

    const row = tagsPage.getTagRow('pet-supplies');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Food and vet visits');
  });

  test('recolors a tag from the hex field', async () => {
    await tagsPage.openColorPicker('clothing');
    await tagsPage.setHexColor('3b82f6');

    await expect(tagsPage.hexColorInput).toHaveValue('3b82f6');

    // While the popover is open the tag keeps its pressed style, which
    // darkens the color, so check the color once it closes
    await tagsPage.closeColorPicker();
    await expect(tagsPage.getTagButton('clothing')).toHaveCSS(
      'background-color',
      hexToRgb('3b82f6'),
    );
  });

  test('drops a leading # pasted into the hex field', async () => {
    await tagsPage.openColorPicker('clothing');
    await tagsPage.setHexColor('#3b82f6');

    await expect(tagsPage.hexColorInput).toHaveValue('3b82f6');
    await tagsPage.closeColorPicker();
    await expect(tagsPage.getTagButton('clothing')).toHaveCSS(
      'background-color',
      hexToRgb('3b82f6'),
    );
  });

  test('drops a leading # typed into the hex field', async () => {
    await tagsPage.openColorPicker('clothing');
    await tagsPage.hexColorInput.clear();
    await tagsPage.hexColorInput.pressSequentially('#10b981');

    await expect(tagsPage.hexColorInput).toHaveValue('10b981');
    await tagsPage.closeColorPicker();
    await expect(tagsPage.getTagButton('clothing')).toHaveCSS(
      'background-color',
      hexToRgb('10b981'),
    );
  });

  test('recolors a tag from a swatch and keeps it after a reload', async () => {
    await tagsPage.openColorPicker('clothing');
    // Swatch 6 in the default color set is #1976D2
    await tagsPage.pickSwatch(6);
    await expect(tagsPage.hexColorInput).toHaveValue(/^1976d2$/i);

    await tagsPage.closeColorPicker();
    const tagButton = tagsPage.getTagButton('clothing');
    await expect(tagButton).toHaveCSS('background-color', hexToRgb('1976D2'));

    await tagsPage.reload();
    await tagsPage.moveMouseAway();
    await expect(tagButton).toHaveCSS('background-color', hexToRgb('1976D2'));
  });

  test('expands and collapses the custom color picker', async () => {
    await tagsPage.openColorPicker('clothing');
    await expect(tagsPage.customColorButton).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(tagsPage.colorArea).toHaveCount(0);
    await expect(tagsPage.hueSlider).toHaveCount(0);

    await tagsPage.openCustomColorPicker();
    await expect(tagsPage.customColorButton).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(tagsPage.colorArea).toBeVisible();
    await expect(tagsPage.hueSlider).toBeVisible();

    await tagsPage.closeCustomColorPicker();
    await expect(tagsPage.customColorButton).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(tagsPage.colorArea).toHaveCount(0);
    await expect(tagsPage.hueSlider).toHaveCount(0);
  });

  test('recolors a tag with the hue slider and keeps it after a reload', async () => {
    // Start from a saturated color: changing the hue of a gray leaves its
    // hex value unchanged
    await tagsPage.setTagColor('clothing', '3b82f6');

    await tagsPage.openColorPicker('clothing');
    await tagsPage.openCustomColorPicker();
    await tagsPage.hueSlider.focus();
    for (let i = 0; i < 5; i++) {
      await tagsPage.page.keyboard.press('ArrowRight');
    }

    await expect(tagsPage.hexColorInput).not.toHaveValue(/^3b82f6$/i);
    const newHex = await tagsPage.hexColorInput.inputValue();

    await tagsPage.closeColorPicker();
    const tagButton = tagsPage.getTagButton('clothing');
    await expect(tagButton).toHaveCSS('background-color', hexToRgb(newHex));

    // The color only survives a reload if onChangeEnd saved it
    await tagsPage.reload();
    await tagsPage.moveMouseAway();
    await expect(tagButton).toHaveCSS('background-color', hexToRgb(newHex));
  });

  test('checks the color picker visuals', async () => {
    // The popover is capped to the viewport height, so make room for the
    // expanded custom picker to show in full
    await page.setViewportSize({ width: 1280, height: 900 });

    // Start from a fixed color so the screenshots match between runs
    await tagsPage.setTagColor('clothing', '3b82f6');

    await tagsPage.openColorPicker('clothing');
    await expect(tagsPage.hexColorInput).toHaveValue(/^3b82f6$/i);
    await expect(tagsPage.colorPicker).toMatchThemeScreenshots();

    await tagsPage.openCustomColorPicker();
    await expect(tagsPage.colorPicker).toMatchThemeScreenshots();
  });
});

function hexToRgb(hex: string) {
  const [r, g, b] = [0, 2, 4].map(i =>
    parseInt(hex.replace('#', '').slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
}
