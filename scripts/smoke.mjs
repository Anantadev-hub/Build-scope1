import { chromium } from 'playwright';
import fs from 'node:fs';
import { BASE, enterDemoWorkspace, signOut } from './helpers.mjs';

fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

const out = [];
const check = (name, ok, extra = '') => {
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` (${extra})` : ''}`);
};

/* ---------------- authentication ---------------- */
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
check('logged-out visit is redirected to sign-in', page.url().includes('/login'), page.url());
await page.screenshot({ path: 'shots/00-login.png', fullPage: true });
check('login screen renders', await page.getByRole('heading', { name: /Sign in to the investigation workspace/i }).isVisible());
check('login states the demo boundary', await page.getByText(/No email is sent, no identity is/i).isVisible());

await page.goto(`${BASE}/projects/prj_kabadiwala/assurance`, { waitUntil: 'networkidle' });
check('protected route redirects when signed out', page.url().includes('/login'), page.url());

await page.getByRole('button', { name: /Enter demo workspace/i }).click();
await page.waitForURL(/\/welcome/);
check('demo access opens the workspace', page.url().includes('/welcome'), page.url());
check('welcome screen renders', await page.getByRole('heading', { name: /Investigate before you build/i }).isVisible());
check('welcome shows demo honesty', await page.getByText('DEMO DATA IS LABELLED WHEREVER IT APPEARS').isVisible());
await page.screenshot({ path: 'shots/01-welcome.png', fullPage: true });

await page.getByRole('button', { name: /Explore the Kabadiwala Connect case/i }).click();
await page.waitForURL(/\/projects\/prj_kabadiwala/);
await page.waitForTimeout(500);
check('demo case opens', await page.getByRole('heading', { name: /Kabadiwala Connect/i }).first().isVisible());
await page.screenshot({ path: 'shots/02-project.png', fullPage: true });

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
check('mission control renders', await page.getByRole('heading', { name: /investigator/i }).isVisible());
check('mission control shows rank', await page.getByText('Field rank', { exact: false }).first().isVisible());
await page.screenshot({ path: 'shots/03-mission-control.png', fullPage: true });

const routes = [
  ['prior-art', /Prior Art Lab/i, '04-prior-art'],
  ['differentiation', /Differentiation$/i, '05-differentiation'],
  ['feasibility', /Feasibility Lab/i, '06-feasibility'],
  ['requirements', /Requirements & compliance/i, '07-requirements'],
  ['learning', /Learning Hub/i, '08-learning'],
  ['proof', /Opportunity to proof/i, '09-proof'],
  ['assurance', /Assurance & testing/i, '10-assurance'],
  ['reports', /Buildability Reports/i, '11-reports'],
  ['passport', /Buildability Passport/i, '12-passport'],
];
for (const [route, heading, shot] of routes) {
  await page.goto(`${BASE}/projects/prj_kabadiwala/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const ok = await page.getByRole('heading', { name: heading }).first().isVisible().catch(() => false);
  check(`${route} renders`, ok);
  await page.screenshot({ path: `shots/${shot}.png`, fullPage: true });
}

await page.goto(`${BASE}/hackathons`, { waitUntil: 'networkidle' });
check('hackathon radar renders', await page.getByRole('heading', { name: /Hackathon Radar/i }).isVisible());
check('radar demo warning present', (await page.getByText(/DEMO DATA — NOT LIVE VERIFIED/i).count()) > 0);
await page.screenshot({ path: 'shots/11-hackathons.png', fullPage: true });

await page.goto('http://127.0.0.1:3000/achievements', { waitUntil: 'networkidle' });
check('achievements renders', await page.getByRole('heading', { name: /Achievements & field rank/i }).isVisible());
await page.screenshot({ path: 'shots/13-achievements.png', fullPage: true });

await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
check('projects list renders', await page.getByRole('heading', { name: /My Projects/i }).isVisible());
await page.screenshot({ path: 'shots/14-projects.png', fullPage: true });

// responsive
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/15-mobile.png', fullPage: true });
const menuBtn = page.getByRole('button', { name: /Open navigation/i });
check('mobile nav button visible', await menuBtn.isVisible());
await menuBtn.click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/16-mobile-nav.png', fullPage: false });
await page.keyboard.press('Escape');

/* ---------------- sign out (last, so it cannot disturb the checks above) ---------------- */
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await signOut(page);
check('sign out returns to the login screen', page.url().includes('/login'), page.url());
await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
check('sign out really ends the session', page.url().includes('/login'), page.url());

console.log(out.join('\n'));
console.log(`\nRuntime problems (${problems.length}):`);
console.log(problems.slice(0, 30).join('\n') || 'none');
await browser.close();
