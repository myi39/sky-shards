const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();

  await page.setViewportSize({ width: 480, height: 1200 });

  const indexPath = pathToFileURL(path.resolve('index.html')).href;
  await page.goto(indexPath, { waitUntil: 'networkidle' });

  await page.waitForSelector('#calendar-grid .day-cell');

  const headerEl   = await page.$('.page-label');
  const calendarEl = await page.$('.calendar-section');
  const headerBox  = await headerEl.boundingBox();
  const calBox     = await calendarEl.boundingBox();

  const clip = {
    x:      Math.min(headerBox.x, calBox.x),
    y:      headerBox.y,
    width:  Math.max(headerBox.width, calBox.width),
    height: calBox.y + calBox.height - headerBox.y,
  };

  fs.mkdirSync('images', { recursive: true });

  await page.screenshot({
    path: 'images/shard_info_discord.png',
    clip,
  });

  await browser.close();
  console.log('Saved: images/shard_info_discord.png');
}

main().catch(err => { console.error(err); process.exit(1); });
