import type { Locator, Page } from '@playwright/test';

export class TagsPage {
  readonly page: Page;
  readonly addNewButton: Locator;
  readonly searchBox: Locator;
  readonly newTagRow: Locator;
  readonly colorPicker: Locator;
  readonly hexColorInput: Locator;
  readonly customColorButton: Locator;
  readonly hueSlider: Locator;
  readonly colorArea: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addNewButton = page.getByRole('button', { name: 'Add New' });
    this.searchBox = page.getByPlaceholder('Filter tags...');
    this.newTagRow = page.getByTestId('new-tag');
    this.colorPicker = page.getByRole('dialog');
    this.hexColorInput = this.colorPicker.getByRole('textbox', {
      name: 'Hex color',
    });
    this.customColorButton = this.colorPicker.getByRole('button', {
      name: 'Pick a custom color',
    });
    this.hueSlider = this.colorPicker.getByRole('slider', { name: 'Hue' });
    // react-aria labels the saturation/brightness area "Color picker"
    this.colorArea = this.colorPicker.getByRole('slider', {
      name: 'Color picker',
      exact: true,
    });
  }

  /**
   * Create a tag through the "Add New" row and wait for it to show in the list.
   */
  async createTag(name: string, description?: string) {
    await this.addNewButton.click();
    await this.newTagRow.getByPlaceholder('New tag').fill(name);

    if (description) {
      // The description cell only becomes an input once it is focused
      await this.page.keyboard.press('Tab');
      await this.newTagRow
        .getByPlaceholder('Tag description')
        .fill(description);
    }

    // Use the Add button rather than Enter: Enter in the description cell
    // currently creates the tag before the typed description is saved
    await this.newTagRow.getByTestId('add-button').click();
    await this.getTagRow(name).waitFor();
  }

  /**
   * The list row for a tag, matched by its exact "#name" button.
   */
  getTagRow(name: string) {
    return this.page
      .getByTestId('table')
      .getByTestId('row')
      .filter({
        has: this.page.getByRole('button', { name: `#${name}`, exact: true }),
      });
  }

  /**
   * The colored "#name" button that opens the tag's color picker.
   */
  getTagButton(name: string) {
    return this.page
      .getByTestId('table')
      .getByRole('button', { name: `#${name}`, exact: true });
  }

  /**
   * Open the color picker popover for a tag in the list.
   */
  async openColorPicker(name: string) {
    await this.getTagButton(name).click();
    await this.colorPicker.waitFor();
    await this.moveMouseAway();
  }

  async closeColorPicker() {
    await this.page.keyboard.press('Escape');
    await this.colorPicker.waitFor({ state: 'hidden' });
    await this.moveMouseAway();
  }

  /**
   * Replace the hex field's value in one step, like a paste. The field only
   * applies the color once it holds six hex digits.
   */
  async setHexColor(hex: string) {
    await this.hexColorInput.fill(hex);
  }

  /**
   * Expand the custom color picker (color area and hue slider) below the hex
   * field.
   */
  async openCustomColorPicker() {
    await this.pressCustomColorButton();
    await this.hueSlider.waitFor();
  }

  async closeCustomColorPicker() {
    await this.pressCustomColorButton();
    await this.hueSlider.waitFor({ state: 'hidden' });
  }

  /**
   * Press the button from the keyboard. Hovering it opens a "Pick a custom
   * color" tooltip after a delay, which covers the color area (and so the
   * screenshots) and swallows the next Escape.
   */
  async pressCustomColorButton() {
    await this.customColorButton.focus();
    await this.page.keyboard.press('Enter');
  }

  /**
   * Give a tag a known color through the hex field, then close the picker.
   * Screenshot tests use this so they always start from the same color.
   */
  async setTagColor(name: string, hex: string) {
    await this.openColorPicker(name);
    await this.setHexColor(hex);
    await this.closeColorPicker();
  }

  /**
   * Click a swatch in the open color picker. `index` is the swatch's position
   * in the picker's default color set; swatches are picked by position
   * because their accessible names are generated color descriptions, not hex
   * values.
   */
  async pickSwatch(index: number) {
    await this.colorPicker.getByRole('option').nth(index).click();
  }

  async reload() {
    await this.page.reload();
    await this.addNewButton.waitFor();
  }

  /**
   * A hovered tag shows a mixed background color, so keep the mouse off the
   * tags before checking their colors
   */
  async moveMouseAway() {
    await this.page.mouse.move(0, 0);
  }

  async searchFor(text: string) {
    await this.searchBox.fill(text);
  }
}
