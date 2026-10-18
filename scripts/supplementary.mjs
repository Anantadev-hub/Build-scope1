import { chromium } from 'playwright';
import { BASE, enterDemoWorkspace, workspaceState } from './helpers.mjs';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
const results = [];
const check = (n, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} — ${n}${extra ? ` (${extra})` : ''}`);
const state = () => workspaceState(page);

/* sign in, then straight into the demo case */
await enterDemoWorkspace(page);
await page.waitForTimeout(300);

/* command palette */
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.keyboard.press('Control+k');
await page.waitForTimeout(200);
check('command palette opens with keyboard', await page.getByRole('dialog', { name: 'Command palette' }).isVisible());
await page.getByRole('textbox', { name: 'Search commands' }).fill('learning');
await page.waitForTimeout(150);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('command palette navigates to module', page.url().includes('/learning'), page.url());

/* report section selection */
await page.goto(BASE + '/projects/prj_kabadiwala/reports', { waitUntil: 'networkidle' });
const riskBox = page.getByRole('checkbox', { name: /Risk register & mitigations/i });
await riskBox.uncheck();
await page.getByRole('button', { name: 'Generate report' }).click();
await page.waitForTimeout(600);
const rep = (await state()).projects.find((p) => p.id === 'prj_kabadiwala').reports.slice(-1)[0];
check('unselected section omitted from saved report', rep && !rep.sections.includes('risks'), rep ? `${rep.sections.length} sections` : 'no report');
check('preview reflects selected sections', !(await page.locator('#report-preview').getByText('Risk register and mitigations', { exact: true }).isVisible().catch(() => false)));

/* print media */
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/33-report-print.png', fullPage: true });
const navVisible = await page.locator('.sidebar').isVisible();
check('print stylesheet hides navigation', !navVisible);
await page.emulateMedia({ media: 'screen' });

/* hackathon filters + empty state */
await page.goto(BASE + '/hackathons', { waitUntil: 'networkidle' });
await page.selectOption('select[aria-label="Filter by format"]', 'Online');
await page.waitForTimeout(250);
const onlineBadges = await page.locator('article.hack-card').count();
check('format filter returns listings', onlineBadges > 0, `${onlineBadges} online`);
const formats = await page.locator('article.hack-card').evaluateAll((els) => els.map((e) => e.textContent));
check('format filter excludes other formats', formats.every((t) => t.includes('Online')));
await page.getByRole('searchbox', { name: 'Search hackathons' }).fill('zzzz-no-event');
await page.waitForTimeout(250);
check('hackathon empty state appears', (await page.getByText(/No events match these filters/i).count()) > 0);
await page.screenshot({ path: 'shots/34-hackathon-empty.png', fullPage: true });

/* report saved before delete */
const before = await state();
const projectCount = before.projects.length;
const xpCount = before.xpEvents.filter((e) => e.projectId === 'prj_kabadiwala').length;
check('demo project xp exists before deletion', xpCount > 0, `${xpCount} events`);

/* delete demo project */
await page.goto(BASE + '/projects', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Delete Kabadiwala Connect' }).click();
await page.getByRole('button', { name: 'Delete case' }).click();
await page.waitForTimeout(500);
const afterDelete = await state();
check('project deleted', afterDelete.projects.length === projectCount - 1);
check('dependent xp removed with project', afterDelete.xpEvents.filter((e) => e.projectId === 'prj_kabadiwala').length === 0);
check('dependent tracking removed', afterDelete.hackathonTracking.filter((t) => t.projectId === 'prj_kabadiwala').length === 0);
check('dependent learning removed', afterDelete.learningProgress.filter((l) => l.projectId === 'prj_kabadiwala').length === 0);

/* empty workspace */
await page.getByRole('button', { name: /^Clear$/ }).click();
await page.getByRole('button', { name: 'Clear everything' }).click();
await page.waitForTimeout(500);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
check('cleared workspace returns to first-run screen', await page.getByRole('heading', { name: /Investigate before you build/i }).isVisible());
await page.getByRole('button', { name: /Start a new investigation/i }).click();
await page.waitForURL(/projects\/new/);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
check('empty workspace mission control CTA', (await page.getByText(/No active investigation/i).count()) > 0);
await page.screenshot({ path: 'shots/35-empty-workspace.png', fullPage: true });
await page.goto(BASE + '/projects', { waitUntil: 'networkidle' });
check('projects empty state', (await page.getByText(/No case files yet/i).count()) > 0);
await page.goto(BASE + '/projects/prj_deleted/prior-art', { waitUntil: 'networkidle' });
check('missing case shows recovery state', (await page.getByText(/could not be found/i).count()) > 0);

/* malformed local storage (written to the signed-in account's own key) */
await page.evaluate((prefix) => {
  const raw = localStorage.getItem('buildscope.ai.session.v1') || sessionStorage.getItem('buildscope.ai.session.v1');
  const session = raw ? JSON.parse(raw) : null;
  if (session?.accountId) localStorage.setItem(`${prefix}:${session.accountId}`, '{not valid json');
}, 'buildscope.ai.workspace.v2');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
check('malformed storage does not crash app', await page.getByRole('heading', { name: /Investigate before you build/i }).isVisible());
check('malformed storage is reported', (await page.getByText(/could not be read|was malformed/i).count()) > 0);
await page.screenshot({ path: 'shots/36-storage-recovery.png', fullPage: true });

console.log(results.join('\n'));
console.log(`\nRuntime problems (${problems.length}):`);
console.log(problems.slice(0, 20).join('\n') || 'none');
console.log(`\nSUMMARY: ${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
await browser.close();
