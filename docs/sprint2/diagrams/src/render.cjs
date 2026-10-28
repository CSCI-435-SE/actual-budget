// Renders the diagram HTML sources in this folder to PNGs one level up.
// Usage (from the repo root): node docs/sprint2/diagrams/src/render.cjs [name...]
const path = require('path');

const { chromium } = require(
  require.resolve('@playwright/test', { paths: [process.cwd()] }),
);

const DIAGRAMS = process.argv.length > 2
  ? process.argv.slice(2)
  : ['118-tigerk9-class', '118-tigerk9-sequence'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2400, height: 1800 } });
  for (const name of DIAGRAMS) {
    await page.goto('file://' + path.join(__dirname, `${name}.html`));
    await page.waitForSelector('body[data-ready="1"]');
    await page
      .locator('#canvas')
      .screenshot({ path: path.join(__dirname, '..', `${name}.png`) });
    console.log(`rendered ${name}.png`);
  }
  await browser.close();
})();
