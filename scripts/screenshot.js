const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const PADDING = 16;

const SCENARIOS = [
  { mockTime: '2026-06-07T23:00:00+09:00', label: '1_before-first-slot' },
  { mockTime: '2026-06-08T04:00:00+09:00', label: '2_between-slots' },
  { mockTime: '2026-06-08T07:40:00+09:00', label: '3_mid-second-slot' },
  { mockTime: '2026-06-08T15:50:00+09:00', label: '4_after-all-slots' },
];

async function screenshot(page, outPath) {
  await page.waitForSelector('#calendar-grid .day-cell');
  await page.waitForSelector('.page-label');
  await page.waitForSelector('.calendar-section');

  await page.addStyleTag({
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap',
  });
  await page.addStyleTag({
    content: `* { font-family: 'Noto Sans JP', sans-serif !important; }`,
  });
  await page.evaluate(() => document.fonts.ready);

  const headerBox = await page.locator('.page-label').first().boundingBox();
  const calBox    = await page.locator('.calendar-section').first().boundingBox();

  if (!headerBox) throw new Error('.page-label has no bounding box');
  if (!calBox)    throw new Error('.calendar-section has no bounding box');

  const clip = {
    x:      Math.max(0, Math.min(headerBox.x, calBox.x) - PADDING),
    y:      Math.max(0, headerBox.y - PADDING),
    width:  Math.max(headerBox.width, calBox.width) + PADDING * 2,
    height: calBox.y + calBox.height - headerBox.y + PADDING * 2,
  };

  await page.screenshot({ path: outPath, clip });
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const outDir  = path.resolve(__dirname, '../images');
  fs.mkdirSync(outDir, { recursive: true });

  const isSingleShot = SCENARIOS.length === 0 || process.argv[2] === '--prod';

  try {
    const context = await browser.newContext({ deviceScaleFactor: 3 });
    const page    = await context.newPage();
    await page.setViewportSize({ width: 390, height: 1200 });

    const baseUrl = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

    if (isSingleShot) {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      const outPath = path.join(outDir, 'shard_info_discord.png');
      await screenshot(page, outPath);
      console.log('Saved: images/shard_info_discord.png');
    } else {
      for (const { mockTime, label } of SCENARIOS) {
        const url = `${baseUrl}?mockTime=${encodeURIComponent(mockTime)}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        const outPath = path.join(outDir, `test_${label}.png`);
        await screenshot(page, outPath);
        console.log(`Saved: images/test_${label}.png`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
