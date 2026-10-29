import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { BudgetPage } from './page-models/budget-page';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

test.describe('Budget', () => {
  let page: Page;
  let configurationPage: ConfigurationPage;
  let budgetPage: BudgetPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    budgetPage = await configurationPage.createTestFile();

    // Move mouse to corner of the screen;
    // sometimes the mouse hovers on a budget element thus rendering an input box
    // and this breaks screenshot tests
    await page.mouse.move(0, 0);
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('renders the summary information: available funds, overspent, budgeted and for next month', async () => {
    const summary = budgetPage.budgetSummary.first();

    await expect(summary.getByText('Available funds')).toBeVisible({
      timeout: 10000,
    });
    await expect(summary.getByText(/^Overspent in /)).toBeVisible();
    await expect(summary.getByText('Budgeted')).toBeVisible();
    await expect(summary.getByText('For next month')).toBeVisible();
    await expect(page).toMatchThemeScreenshots();
  });

  test('transfer funds to another category', async () => {
    const currentFundsA = await budgetPage.getBalanceForRow(1);
    const currentFundsB = await budgetPage.getBalanceForRow(2);

    await budgetPage.transferAllBalance(1, 2);

    await expect
      .poll(() => budgetPage.getBalanceForRow(2))
      .toEqual(currentFundsA + currentFundsB);
    await expect(page).toMatchThemeScreenshots();
  });

  test('budget table is rendered', async () => {
    await expect(budgetPage.budgetTable).toBeVisible();
    expect(await budgetPage.getTableTotals()).toEqual({
      budgeted: expect.any(Number),
      spent: expect.any(Number),
      balance: expect.any(Number),
    });
  });

  test('clicking on spent amounts opens a transaction page', async () => {
    const accountPage = await budgetPage.clickOnSpentAmountForRow(1);
    expect(page.url()).toContain('/accounts');
    expect(await accountPage.accountName.textContent()).toMatch('All Accounts');
    await page.getByRole('button', { name: 'Back' }).click();
  });

  test('right clicking a category opens context menu', async () => {
    await budgetPage.rightClickCategory(1);
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Rename' })).toBeVisible();
  });

  test('right clicking a category group opens context menu', async () => {
    await budgetPage.rightClickCategoryGroup('Usual Expenses');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Rename' })).toBeVisible();
  });

  test('right clicking budget name opens context menu', async () => {
    await page.getByTestId('budget-name').click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole('button', { name: 'Switch file' }),
    ).toBeVisible();
  });
});

test.describe('Budget scroll position', () => {
  let page: Page;
  let configurationPage: ConfigurationPage;
  let budgetPage: BudgetPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    budgetPage = await configurationPage.createTestFile();

    // Add enough categories to make the budget table scrollable.
    const categoryCount = 20;
    await page.evaluate(async count => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const $send = (window as any).$send as (
        type: string,
        args?: unknown,
      ) => Promise<string>;
      const groupId = await $send('category-group-create', {
        name: 'Extra Categories',
      });
      for (let i = 1; i <= count; i++) {
        await $send('category-create', { name: `Category ${i}`, groupId });
      }
      // Invalidate the category query so React re-renders with the new categories.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).__TANSTACK_QUERY_CLIENT__.invalidateQueries({
        queryKey: ['categories', 'lists'],
      });
    }, categoryCount);
    await page
      .getByText(`Category ${categoryCount}`, { exact: true })
      .waitFor({ state: 'visible' });

    await page.mouse.move(0, 0);
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('scroll position is restored when navigating back from spent transactions page', async () => {
    await budgetPage.scrollToBottom();
    const scrollTopBeforeViewingSpent = await budgetPage.getScrollTop();
    expect(scrollTopBeforeViewingSpent).toBeGreaterThan(0);

    // Click a spent-amount cell that is already visible at the current scroll position so the scroll does not change
    // before the handler captures it.
    await budgetPage.clickOnSpentAmountForLastVisibleRow();
    expect(page.url()).toContain('/accounts');

    await page.getByRole('button', { name: 'Back' }).click();
    await budgetPage.waitFor();

    const scrollTopAfterReturningFromSpent = await budgetPage.getScrollTop();
    expect(scrollTopAfterReturningFromSpent).toBe(scrollTopBeforeViewingSpent);
  });
});

test.describe('Budget subcategories', () => {
  let page: Page;
  let configurationPage: ConfigurationPage;
  let budgetPage: BudgetPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    budgetPage = await configurationPage.createTestFile();
    await page.mouse.move(0, 0);

    // Start from a known parent amount; the demo's amounts vary by month
    await budgetPage.setBudgetedAmount('Food', '200');
    await expect
      .poll(() => budgetPage.getBudgetedForCategory('Food'))
      .toBe(20000);
    await budgetPage.addSubcategory('Food', 'Dining Out');
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('a subcategory is listed under its parent and funded from it', async () => {
    const names = await budgetPage.getCategoryNames();
    expect(names[names.indexOf('Food') + 1]).toBe('Dining Out');

    const totalBefore = await budgetPage.getTotalBudgetedAmount();
    await budgetPage.setBudgetedAmount('Dining Out', '50');

    await expect
      .poll(() => budgetPage.getBudgetedForCategory('Dining Out'))
      .toBe(5000);
    await expect
      .poll(() => budgetPage.getBudgetedForCategory('Food'))
      .toBe(15000);
    expect(await budgetPage.getTotalBudgetedAmount()).toBe(totalBefore);
    await expect(
      budgetPage
        .getCategoryRow('Food')
        .getByTestId('parent-total-hint')
        .first(),
    ).toBeVisible();
  });

  test('a subcategory cannot take more than its parent has', async () => {
    await budgetPage.setBudgetedAmount('Food', '100');
    await expect
      .poll(() => budgetPage.getBudgetedForCategory('Food'))
      .toBe(10000);

    await budgetPage.setBudgetedAmount('Dining Out', '250');

    await expect
      .poll(() => budgetPage.getBudgetedForCategory('Dining Out'))
      .toBe(10000);
    await expect.poll(() => budgetPage.getBudgetedForCategory('Food')).toBe(0);
  });

  test('removing a subcategory from its parent keeps its money', async () => {
    await budgetPage.setBudgetedAmount('Dining Out', '50');
    await expect
      .poll(() => budgetPage.getBudgetedForCategory('Food'))
      .toBe(15000);

    await budgetPage.removeFromParent('Dining Out');

    await expect(
      budgetPage.getCategoryRow('Food').getByTestId('parent-total-hint'),
    ).toHaveCount(0);
    expect(await budgetPage.getBudgetedForCategory('Dining Out')).toBe(5000);
    expect(await budgetPage.getBudgetedForCategory('Food')).toBe(15000);
  });
});

// Below this width the sidebar always floats and cannot be pinned
// (see `alwaysFloats` in SidebarProvider).
const ALWAYS_FLOATS_BELOW = 668;
// Below this width the app switches to the mobile pages.
const MOBILE_BELOW = 512;
// The narrowest width at which the demo budget still fits next to the pinned
// sidebar at its default width. Between this and ALWAYS_FLOATS_BELOW the
// budgeted amounts get cut off (known issue).
const MIN_PINNED_WIDTH = 750;
const VIEWPORT_HEIGHT = 900;

type LayoutProblems = {
  pageScrollsHorizontally: boolean;
  offscreen: string[];
  clippedAmounts: string[];
};

async function getLayoutProblems(page: Page): Promise<LayoutProblems> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const describe = (el: Element) => {
      const testId = el.getAttribute('data-testid');
      const text = (el.textContent ?? '').trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${testId ? `[${testId}]` : ''} ${text}`;
    };
    const isRendered = (el: Element) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(el).visibility !== 'hidden'
      );
    };

    // Only the part of an element left visible by ancestors that hide
    // overflow counts; e.g. the budget summary keeps the neighbouring months
    // rendered but clipped out of view.
    const offscreen = [...document.querySelectorAll('body *')]
      .filter(isRendered)
      .filter(el => {
        const rect = el.getBoundingClientRect();
        let visibleLeft = rect.left;
        let visibleRight = rect.right;
        for (
          let ancestor = el.parentElement;
          ancestor && ancestor !== document.body;
          ancestor = ancestor.parentElement
        ) {
          if (getComputedStyle(ancestor).overflowX !== 'visible') {
            const clip = ancestor.getBoundingClientRect();
            visibleLeft = Math.max(visibleLeft, clip.left);
            visibleRight = Math.min(visibleRight, clip.right);
          }
        }
        return visibleRight > visibleLeft && visibleRight > viewportWidth + 1;
      })
      .map(describe);

    // An amount is clipped when its text doesn't fit inside its own cell or
    // inside any element that hides overflow, whether that element wraps the
    // cell or sits inside it. Text that spills out of its cell overlaps the
    // next one, and clipped text hides digits (even with an ellipsis).
    const clippedAmounts = [...document.querySelectorAll('[data-cellname]')]
      .filter(isRendered)
      .filter(el => {
        const ancestors: Element[] = [];
        for (
          let ancestor = el.parentElement;
          ancestor && ancestor !== document.body;
          ancestor = ancestor.parentElement
        ) {
          if (getComputedStyle(ancestor).overflowX !== 'visible') {
            ancestors.push(ancestor);
          }
        }
        const cell = el.getBoundingClientRect();
        // Skip cells that are clipped out of view entirely, such as the
        // budget summary's neighbouring months.
        const isInView = ancestors.every(ancestor => {
          const clip = ancestor.getBoundingClientRect();
          return cell.right > clip.left && cell.left < clip.right;
        });
        if (!isInView) {
          return false;
        }

        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const text = range.getBoundingClientRect();
          if (!node.textContent?.trim() || text.width === 0) {
            continue;
          }
          const clips: Element[] = [el, ...ancestors];
          for (
            let parent = node.parentElement;
            parent && parent !== el;
            parent = parent.parentElement
          ) {
            if (getComputedStyle(parent).overflowX !== 'visible') {
              clips.push(parent);
            }
          }
          const isClipped = clips.some(clip => {
            const bounds = clip.getBoundingClientRect();
            return text.left < bounds.left - 1 || text.right > bounds.right + 1;
          });
          if (isClipped) {
            return true;
          }
        }
        return false;
      })
      .map(describe);

    return {
      pageScrollsHorizontally:
        document.documentElement.scrollWidth > viewportWidth,
      offscreen,
      clippedAmounts,
    };
  });
}

function hasLayoutProblems(problems: LayoutProblems) {
  return (
    problems.pageScrollsHorizontally ||
    problems.offscreen.length > 0 ||
    problems.clippedAmounts.length > 0
  );
}

test.describe('Budget responsive layout', () => {
  let page: Page;
  let configurationPage: ConfigurationPage;
  let budgetPage: BudgetPage;

  const sidebar = () => page.getByTestId('sidebar');

  async function setWidth(width: number) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  }

  // Keep the mouse off the sidebar so a floating sidebar stays hidden and
  // nothing in the budget table renders a hover state.
  async function moveMouseToContent() {
    const viewport = page.viewportSize();
    if (viewport) {
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
    }
  }

  async function expectSidebarHidden() {
    await expect
      .poll(async () => {
        const box = await sidebar().boundingBox();
        return box ? box.x + box.width : 0;
      })
      .toBeLessThanOrEqual(0);
  }

  async function unpinSidebar() {
    // The pin button only becomes visible while the sidebar is hovered.
    await page.getByTestId('budget-name').hover();
    await page.getByRole('button', { name: 'Unpin sidebar' }).click();
    await moveMouseToContent();
    await expectSidebarHidden();
  }

  async function waitForBudgetLayout() {
    await budgetPage.waitFor();
    // Let the sidebar transition and the AutoSizer settle.
    await page.waitForTimeout(600);
  }

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    budgetPage = await configurationPage.createTestFile();
    await page.mouse.move(0, 0);
  });

  test.afterEach(async () => {
    await page?.close();
  });

  for (const width of [1440, 1024, 768]) {
    for (const sidebarState of ['pinned', 'unpinned'] as const) {
      test(`budget fits at ${width}px with the sidebar ${sidebarState}`, async () => {
        await setWidth(width);
        if (sidebarState === 'unpinned') {
          await unpinSidebar();
        } else {
          await expect(sidebar()).toBeVisible();
          await moveMouseToContent();
        }
        await waitForBudgetLayout();

        expect(await getLayoutProblems(page)).toEqual({
          pageScrollsHorizontally: false,
          offscreen: [],
          clippedAmounts: [],
        });
        await expect(page).toMatchThemeScreenshots();
      });
    }
  }

  test('budget fits at 600px where the sidebar always floats', async () => {
    const pinButton = page.getByRole('button', {
      name: /^(Pin|Unpin) sidebar$/,
    });
    await setWidth(ALWAYS_FLOATS_BELOW);
    await expect(pinButton).toHaveCount(1);
    await setWidth(ALWAYS_FLOATS_BELOW - 1);
    await expect(pinButton).toHaveCount(0);

    await setWidth(600);
    await moveMouseToContent();
    await expectSidebarHidden();
    await waitForBudgetLayout();

    expect(await getLayoutProblems(page)).toEqual({
      pageScrollsHorizontally: false,
      offscreen: [],
      clippedAmounts: [],
    });
    await expect(page).toMatchThemeScreenshots();
  });

  test('switches to the mobile layout below the small breakpoint', async () => {
    await setWidth(MOBILE_BELOW);
    await expect(budgetPage.budgetTable).toBeVisible();
    await expect(sidebar()).toHaveCount(1);

    await setWidth(MOBILE_BELOW - 1);
    await expect(sidebar()).toHaveCount(0);
    await expect(budgetPage.budgetTable).toHaveCount(0);
  });

  test('pinned sidebar is clamped to a third of the viewport after the window shrinks', async () => {
    await setWidth(1440);
    const box = await sidebar().boundingBox();
    if (!box) {
      throw new Error('Sidebar is not rendered');
    }

    // Drag the resize handle on the sidebar's right edge as far as it goes.
    const handleY = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 2, handleY);
    await page.mouse.down();
    await page.mouse.move(1200, handleY, { steps: 10 });
    await page.mouse.up();
    await expect
      .poll(async () => (await sidebar().boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(1440 / 3 - 1);

    await setWidth(900);
    await expect
      .poll(async () => (await sidebar().boundingBox())?.width ?? Infinity)
      .toBeLessThanOrEqual(900 / 3 + 1);
  });

  test(`budget fits with the sidebar pinned at every width down to ${MIN_PINNED_WIDTH}px`, async () => {
    const widths: number[] = [];
    for (let width = 1100; width > MIN_PINNED_WIDTH; width -= 20) {
      widths.push(width);
    }
    widths.push(MIN_PINNED_WIDTH);

    const failures: Record<number, LayoutProblems> = {};
    for (const width of widths) {
      await setWidth(width);
      await moveMouseToContent();
      await waitForBudgetLayout();
      const problems = await getLayoutProblems(page);
      if (hasLayoutProblems(problems)) {
        failures[width] = problems;
      }
    }

    expect(failures).toEqual({});
  });

  test(`budget fits with the sidebar pinned just below ${MIN_PINNED_WIDTH}px`, async () => {
    // Known issue: between MIN_PINNED_WIDTH and ALWAYS_FLOATS_BELOW the pinned
    // sidebar leaves too little room and budgeted amounts get cut off. Remove
    // `test.fail()` and lower MIN_PINNED_WIDTH once that is handled.
    test.fail();

    await setWidth(MIN_PINNED_WIDTH - 10);
    await expect(sidebar()).toBeVisible();
    await moveMouseToContent();
    await waitForBudgetLayout();

    expect((await getLayoutProblems(page)).clippedAmounts).toEqual([]);
  });

  test('amounts with a long currency symbol fit next to the pinned sidebar', async () => {
    // Known issue: with a long prefix such as "Arg$", amounts in the budget
    // table spill into the next column or get cut off even at widths where
    // the default currency fits. Remove `test.fail()` once the table handles
    // long amounts.
    test.fail();

    const settingsPage = await new Navigation(page).goToSettingsPage();
    await settingsPage.waitFor();
    await settingsPage.settings
      .getByRole('button', { name: 'None', exact: true })
      .first()
      .click();
    await page
      .getByRole('button', { name: 'ARS - Argentinian Peso (Arg$)' })
      .click();
    await page.getByRole('link', { name: 'Budget', exact: true }).click();

    // Tablet portrait, which fits with the default currency.
    await setWidth(768);
    await expect(sidebar()).toBeVisible();
    await moveMouseToContent();
    await waitForBudgetLayout();
    await expect(
      budgetPage.budgetTableTotals.getByTestId(/total-budgeted$/).first(),
    ).toContainText('Arg$');

    expect((await getLayoutProblems(page)).clippedAmounts).toEqual([]);
  });
});
