// Visual QA captures for the newest screens. Run: node scripts/shots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import { BASE, enterDemoWorkspace } from './helpers.mjs';

fs.mkdirSync('shots/ui', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
const P = 'prj_kabadiwala';

await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Create demo account/i }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui/auth-register.png', fullPage: true });

await page.goto(`${BASE}/forgot`, { waitUntil: 'networkidle' });
await page.getByLabel('Account email').fill('someone@example.com');
await page.getByRole('button', { name: /Request a reset/i }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/ui/auth-forgot.png', fullPage: true });

await enterDemoWorkspace(page);
await page.goto(`${BASE}/projects/${P}/proof`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const diagram = page.locator('.card').filter({ hasText: 'Traceability diagram' }).first();
await diagram.screenshot({ path: 'shots/ui/graph-diagram.png' });
await page.screenshot({ path: 'shots/ui/graph-page.png', fullPage: true });

await page.getByRole('tab', { name: /Traceability table/i }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui/graph-table.png', fullPage: true });

// A selected node, to check the detail panel and link lists.
await page.getByRole('tab', { name: /^Diagram/i }).click();
await page.getByRole('button', { name: /Recyclers need proof/i }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui/graph-detail.png', fullPage: true });

await page.goto(`${BASE}/projects/${P}/assurance`, { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: /Coverage by criterion/i }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui/assurance-coverage.png', fullPage: true });
await page.getByRole('tab', { name: /External CI/i }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui/assurance-ci.png', fullPage: true });

// Mobile views of the new modules and the auth screens.
await page.setViewportSize({ width: 390, height: 844 });
for (const [name, path] of [['graph', `/projects/${P}/proof`], ['assurance', `/projects/${P}/assurance`], ['login', '/login']]) {
  if (name === 'login') {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  }
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/ui/mobile-${name}.png`, fullPage: true });
}

console.log(`captured. runtime problems: ${problems.length}`);
console.log(problems.slice(0, 8).join('\n') || 'none');
await browser.close();
