// Route-by-route audit: console errors, horizontal overflow, a11y basics.
// Run: node scripts/audit.mjs [--shots]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { enterDemoWorkspace } from './helpers.mjs';

const SHOTS = process.argv.includes('--shots');
const BASE = 'http://127.0.0.1:3000';
fs.mkdirSync('shots/audit', { recursive: true });

const CASE = 'prj_kabadiwala';
const ROUTES = [
  ['/welcome', 'welcome'],
  ['/', 'mission-control'],
  ['/projects', 'projects'],
  ['/projects/new', 'project-new'],
  [`/projects/${CASE}`, 'case-overview'],
  [`/projects/${CASE}/edit`, 'project-edit'],
  [`/projects/${CASE}/prior-art`, 'prior-art'],
  [`/projects/${CASE}/differentiation`, 'differentiation'],
  [`/projects/${CASE}/feasibility`, 'feasibility'],
  [`/projects/${CASE}/requirements`, 'requirements'],
  [`/projects/${CASE}/learning`, 'learning'],
  [`/projects/${CASE}/proof`, 'proof'],
  [`/projects/${CASE}/assurance`, 'assurance'],
  [`/projects/${CASE}/reports`, 'reports'],
  [`/projects/${CASE}/passport`, 'passport'],
  ['/hackathons', 'hackathons'],
  ['/achievements', 'achievements'],
  ['/definitely-not-a-route', 'not-found'],
];

const WIDTHS = [
  ['desktop', 1440, 1000],
  ['tablet', 1024, 900],
  ['small', 768, 900],
  ['mobile', 390, 844],
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
// Sign in through the real demo entry point so every protected route resolves a
// case and the session is live for the rest of the run.
const seed = await context.newPage();
await enterDemoWorkspace(seed);
await seed.close();

const problems = [];
const rows = [];

for (const [label, width, height] of WIDTHS) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

  for (const [route, name] of ROUTES) {
    const before = consoleErrors.length;
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(180);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth - window.innerWidth;
      const offenders = [];
      if (overflowX > 1) {
        const limit = window.innerWidth + 1;
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.right > limit || r.left < -1)) {
            const style = getComputedStyle(el);
            if (style.position === 'fixed' || style.overflowX === 'hidden' || style.overflowX === 'auto' || style.overflowX === 'scroll') return;
            offenders.push(`${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')} (${Math.round(r.left)}→${Math.round(r.right)})`);
          }
        });
      }
      const h1 = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim());
      const namelessButtons = [...document.querySelectorAll('button')].filter((b) => {
        const t = (b.textContent || '').trim();
        return !t && !b.getAttribute('aria-label') && !b.getAttribute('title') && !b.hasAttribute('aria-hidden');
      }).map((b) => b.outerHTML.slice(0, 90));
      const unlabelledInputs = [...document.querySelectorAll('input, select, textarea')].filter((el) => {
        if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder')) return false;
        if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
        if (el.closest('label')) return false;
        if (el.type === 'hidden') return false;
        return true;
      }).map((el) => `${el.tagName.toLowerCase()}[type=${el.getAttribute('type') || ''}]`);
      const imagesNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
      return {
        overflowX, offenders: [...new Set(offenders)].slice(0, 4), h1,
        namelessButtons, unlabelledInputs, imagesNoAlt,
        title: document.title,
      };
    });

    const errs = consoleErrors.slice(before);
    const a11y = [
      metrics.namelessButtons.length ? `nameless buttons: ${metrics.namelessButtons.join(' | ')}` : null,
      metrics.unlabelledInputs.length ? `unlabelled inputs: ${metrics.unlabelledInputs.join(', ')}` : null,
      metrics.imagesNoAlt ? `${metrics.imagesNoAlt} img without alt` : null,
    ].filter(Boolean);

    if (errs.length) problems.push(`[${label}] ${route} console: ${errs.join(' || ')}`);
    if (metrics.overflowX > 1) problems.push(`[${label}] ${route} overflowX=${metrics.overflowX}px — ${metrics.offenders.join(', ')}`);
    if (!metrics.h1.length) problems.push(`[${label}] ${route} no h1`);
    a11y.forEach((a) => problems.push(`[${label}] ${route} a11y — ${a}`));

    rows.push(`${label.padEnd(8)} ${String(width).padStart(4)}px  ${route.padEnd(46)} overflow=${String(metrics.overflowX).padStart(5)}  h1=${metrics.h1.join(' / ') || 'NONE'}`);

    if (SHOTS && label === 'desktop') {
      await page.screenshot({ path: `shots/audit/${name}-desktop.png`, fullPage: true });
    }
    if (SHOTS && label === 'mobile') {
      await page.screenshot({ path: `shots/audit/${name}-mobile.png`, fullPage: true });
    }
  }
  await page.close();
}

// Signed-out screens get the same treatment in a clean context.
const anonContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
for (const [label, width, height] of WIDTHS) {
  const page = await anonContext.newPage();
  await page.setViewportSize({ width, height });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  for (const [route, name] of [['/login', 'login'], ['/register', 'register'], ['/forgot', 'forgot']]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const h1 = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim());
      return { overflowX: doc.scrollWidth - window.innerWidth, h1 };
    });
    if (consoleErrors.length) problems.push(`[${label}] ${route} console: ${consoleErrors.join(' || ')}`);
    if (metrics.overflowX > 1) problems.push(`[${label}] ${route} overflowX=${metrics.overflowX}px`);
    if (!metrics.h1.length) problems.push(`[${label}] ${route} no h1`);
    rows.push(`auth     ${String(width).padStart(4)}px  ${route.padEnd(46)} overflow=${String(metrics.overflowX).padStart(5)}  h1=${metrics.h1.join(' / ') || 'NONE'}`);
    if (SHOTS && label === 'desktop') await page.screenshot({ path: `shots/audit/${name}-desktop.png`, fullPage: true });
    if (SHOTS && label === 'mobile') await page.screenshot({ path: `shots/audit/${name}-mobile.png`, fullPage: true });
  }
  await page.close();
}
await anonContext.close();

console.log(rows.join('\n'));
console.log(`\n===== PROBLEMS (${problems.length}) =====`);
console.log(problems.join('\n') || 'none');
await browser.close();
