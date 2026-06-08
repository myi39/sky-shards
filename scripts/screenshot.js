const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();

    await page.setViewportSize({ width: 480, height: 1200 });

    const indexPath = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
    await page.goto(indexPath, { waitUntil: 'networkidle' });

    await page.waitForSelector('#calendar-grid .day-cell');
    await page.waitForSelector('.page-label');
    await page.waitForSelector('.calendar-section');

    const headerBox  = await page.locator('.page-label').first().boundingBox();
    const calBox     = await page.locator('.calendar-section').first().boundingBox();

    if (!headerBox) throw new Error('.page-label has no bounding box (element may be hidden)');
    if (!calBox)    throw new Error('.calendar-section has no bounding box (element may be hidden)');

    const clip = {
      x:      Math.min(headerBox.x, calBox.x),
      y:      headerBox.y,
      width:  Math.max(headerBox.width, calBox.width),
      height: calBox.y + calBox.height - headerBox.y,
    };

    const outDir = path.resolve(__dirname, '../images');
    fs.mkdirSync(outDir, { recursive: true });

    await page.screenshot({
      path: path.join(outDir, 'shard_info_discord.png'),
      clip,
    });

    console.log('Saved: images/shard_info_discord.png');
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
