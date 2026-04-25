import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, 'style-guide.html');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });
await page.setViewport({ width: 900, height: 1200 });
await new Promise(r => setTimeout(r, 1000));

await page.pdf({
  path: resolve(__dirname, 'alkera-style-guide.pdf'),
  format: 'A4',
  printBackground: true,
  margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
});

await browser.close();
console.log('Generated alkera-style-guide.pdf');
