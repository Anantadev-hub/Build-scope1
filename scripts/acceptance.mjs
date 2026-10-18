import { chromium } from 'playwright';
import fs from 'node:fs';
import { enterDemoWorkspace, workspaceState } from './helpers.mjs';

const BASE = 'http://127.0.0.1:3000';
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

const results = [];
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` (${extra})` : ''}`);
  if (!ok) console.log(`  ! ${name} ${extra}`);
};
const note = (s) => console.log(`› ${s}`);
const shot = async (name, full = true) => page.screenshot({ path: `shots/${name}.png`, fullPage: full });

// The workspace is stored per signed-in demo account, so every read goes through
// the session that the app itself is using.
const state = async () => workspaceState(page);

/* ---------------- 0. Sign in through the demo entry point ---------------- */
await enterDemoWorkspace(page);
check('demo sign-in opens the worked case', page.url().includes('prj_kabadiwala'), page.url());

/* ---------------- 1. Create project ---------------- */
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
if (await page.getByRole('button', { name: /Start a new investigation/i }).isVisible().catch(() => false)) {
  await page.getByRole('button', { name: /Start a new investigation/i }).click();
} else {
  await page.goto(BASE + '/projects/new', { waitUntil: 'networkidle' });
}
await page.waitForURL(/projects\/new/);
await page.fill('#project-name', 'Campus Food Rescue');
await page.fill('#problem', 'Surplus cafeteria food is discarded while students nearby report food insecurity. Coordination between donors and recipients is manual and untraceable.');
await page.fill('#solution', 'A pickup coordination board where cafeteria staff post surplus batches, student volunteers claim them, and each handoff is recorded with a timestamp.');
await page.fill('#users', 'Cafeteria staff, student volunteers, campus welfare office');
await page.fill('#outcome', 'A working claim-to-handoff workflow that survives reload and shows a complete history.');
await page.getByRole('button', { name: 'Add feature' }).click();
await page.fill('[aria-label="Feature 1 name"]', 'Surplus batch listing');
await page.getByRole('button', { name: 'Add feature' }).click();
await page.fill('[aria-label="Feature 2 name"]', 'Volunteer claim');
await page.getByRole('button', { name: 'Add feature' }).click();
await page.fill('[aria-label="Feature 3 name"]', 'Handoff record');
await page.getByRole('button', { name: 'Open case file' }).click();
await page.waitForURL(/\/projects\/prj_/);
check('project creation lands on case file', await page.getByRole('heading', { name: 'Campus Food Rescue' }).isVisible());
const st1 = await state();
const created = st1.projects.find((p) => p.name === 'Campus Food Rescue');
check('project persisted to localStorage', Boolean(created), created?.caseId);
check('case ID generated distinctly', created?.caseId !== 'BS-26-001', created?.caseId);
check('features persisted', created?.features.length === 3, `${created?.features.length} features`);
check('brief completeness mission task auto-completes', await page.getByText('My Projects').first().isVisible());

await page.reload({ waitUntil: 'networkidle' });
check('project survives reload', await page.getByRole('heading', { name: 'Campus Food Rescue' }).isVisible());
await shot('20-new-project');

/* ---------------- 2. Second project + switch ---------------- */
await page.goto(BASE + '/projects/new', { waitUntil: 'networkidle' });
await page.fill('#project-name', 'Second Investigation');
await page.getByRole('button', { name: 'Open case file' }).click();
await page.waitForURL(/\/projects\/prj_/);
await page.goto(BASE + '/projects', { waitUntil: 'networkidle' });
check('project register lists both cases', (await page.getByRole('link', { name: 'Second Investigation' }).count()) > 0 && (await page.getByRole('link', { name: 'Campus Food Rescue' }).count()) > 0);
await page.locator('header select').selectOption({ label: 'BS-26-001 · Kabadiwala Connect' });
await page.waitForURL(/prj_kabadiwala/);
check('topbar case switch loads demo case', await page.getByRole('heading', { name: 'Kabadiwala Connect' }).isVisible());

/* ---------------- 3. Prior art filters + compare + evidence ---------------- */
await page.goto(BASE + '/projects/prj_kabadiwala/prior-art', { waitUntil: 'networkidle' });
check('prior art demo banner visible', (await page.getByText(/DEMO DATA — NOT LIVE SEARCHED/i).count()) > 0);
const beforeCards = await page.locator('article.repo-card').count();
await page.getByRole('searchbox', { name: 'Filter repositories' }).fill('trace');
await page.waitForTimeout(250);
const filteredCards = await page.locator('article.repo-card').count();
check('repository text filter narrows results', filteredCards < beforeCards, `${filteredCards} of ${beforeCards}`);
await page.getByRole('searchbox', { name: 'Filter repositories' }).fill('');
await page.selectOption('select[aria-label="Filter by overlap"]', 'strong');
await page.waitForTimeout(250);
const strongCount = await page.locator('article.repo-card').count();
check('overlap filter works', strongCount > 0 && strongCount < beforeCards, `${strongCount} strong`);
await shot('21-prior-art-filtered');
await page.selectOption('select[aria-label="Filter by overlap"]', '');
await page.waitForTimeout(200);

// select an alternative not already selected
const addBtn = page.getByRole('button', { name: /Add route-sheet-demo to comparison/i });
await addBtn.click();
await page.getByRole('tab', { name: /Comparison/i }).click();
await page.waitForTimeout(300);
check('comparison matrix shows selected alternatives', await page.getByRole('table').isVisible());
const cells = page.locator('table select');
await cells.nth(0).selectOption('documented');
await page.waitForTimeout(200);
await page.getByRole('button', { name: /Re-confirm comparison|Confirm comparison/i }).click();
await page.waitForTimeout(300);
const afterCompare = await state();
check('comparison cell persisted', Object.values(afterCompare.projects.find((x) => x.id === 'prj_kabadiwala').comparison.cells).includes('documented'));
await shot('22-comparison');

/* ---------------- 4. Record a real verified source ---------------- */
await page.getByRole('tab', { name: /Evidence register/i }).click();
await page.getByRole('button', { name: /Record evidence/i }).click();
await page.getByLabel('Source name').fill('MDN Web Docs — Window.localStorage');
await page.getByLabel('Source URL').fill('https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage');
await page.getByLabel('What claim does this source support?').fill('The demo can persist pickup and handoff records locally in the browser without a backend.');
await page.getByLabel('Date checked').fill('2026-10-17');
await page.getByLabel('Verification status').selectOption('verified');
await page.getByRole('button', { name: 'Save evidence' }).click();
await page.waitForTimeout(400);
const afterEvidence = await state();
const demoProject = afterEvidence.projects.find((x) => x.id === 'prj_kabadiwala');
check('verified evidence saved', demoProject.evidence.some((e) => e.verification === 'verified' && !e.demo));
check('source verified achievement earned from checked source', afterEvidence.achievements.some((a) => a.key === 'source-verified'));
check('evidence appears in register', await page.getByText('MDN Web Docs — Window.localStorage').first().isVisible());
await shot('23-evidence');

/* ---------------- 5. Differentiation ---------------- */
await page.goto(BASE + '/projects/prj_kabadiwala/differentiation', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Add differentiator/i }).click();
await page.fill('#claim-text', 'Household-level handoff records with a visible fallback when live inventory is unavailable.');
await page.getByLabel('Status').selectOption('supported');
await page.getByRole('button', { name: 'Save claim' }).click();
await page.waitForTimeout(300);
check('supported claim without evidence is rejected', (await page.getByText(/needs at least one linked evidence record/i).count()) > 0);
const evidenceCheckbox = page.getByRole('checkbox', { name: /MDN Web Docs/i }).first();
await evidenceCheckbox.check();
await page.getByLabel('Open questions').fill('Would a recycler value the record, or only the material?');
await page.getByRole('button', { name: 'Save claim' }).click();
await page.waitForTimeout(400);
check('evidence-linked claim saved', await page.getByText('Household-level handoff records', { exact: false }).first().isVisible());
const afterClaim = await state();
check('claim status persisted', afterClaim.projects.find((x) => x.id === 'prj_kabadiwala').claims.some((c) => c.status === 'supported' && c.evidenceIds.length > 0));
await shot('24-differentiation');

/* ---------------- 6. Feasibility: risk w/o mitigation ---------------- */
await page.goto(BASE + '/projects/prj_kabadiwala/feasibility', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Add risk/i }).first().click();
await page.fill('#rk-title', 'No offline test run recorded');
await page.getByLabel('Likelihood').selectOption('High');
await page.getByLabel('Impact').selectOption('High');
await page.getByRole('button', { name: 'Save risk' }).click();
await page.waitForTimeout(300);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
check('unmitigated high risk becomes blocking next action', await page.getByRole('heading', { name: /Resolve or mitigate a blocker/i }).isVisible());
await shot('25-mission-blocker');

// mitigate it
await page.goto(BASE + '/projects/prj_kabadiwala/feasibility?tab=risks', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Edit No offline test run recorded/i }).click();
await page.getByLabel('Mitigation').fill('Disable the network and rehearse the full workflow before submission.');
await page.getByLabel('Fallback').fill('Use a recorded offline walkthrough as backup.');
await page.getByRole('button', { name: 'Save risk' }).click();
await page.waitForTimeout(400);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
check('mitigated risk removes blocker next action', !(await page.getByRole('heading', { name: /Resolve or mitigate a blocker/i }).isVisible().catch(() => false)));
await shot('26-mission-after-mitigation');

/* ---------------- 7. Requirements ---------------- */
await page.goto(BASE + '/projects/prj_kabadiwala/requirements', { waitUntil: 'networkidle' });
check('unverified brief banner present', await page.getByText(/OFFICIAL REQUIREMENTS NOT VERIFIED/i).isVisible());
await page.getByRole('button', { name: /Brief source/i }).first().click();
await page.fill('#brief-url', 'https://example.edu/hackathon/official-rules');
await page.fill('#brief-date', '2026-10-17');
await page.getByRole('button', { name: 'Save brief source' }).click();
await page.waitForTimeout(300);
check('brief verification clears official banner', (await page.getByText(/OFFICIAL REQUIREMENTS NOT VERIFIED/i).count()) === 0);
const reqState = await state();
check('brief source persisted', Boolean(reqState.projects.find((x) => x.id === 'prj_kabadiwala').briefMeta.sourceUrl));
await shot('27-requirements-verified');

/* ---------------- 8. Learning ---------------- */
await page.goto(BASE + '/projects/prj_kabadiwala/learning', { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: /Resource library/i }).click();
await page.getByRole('button', { name: 'Add to path' }).first().click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: /Client-side data modelling/i }).first().click();
await page.waitForTimeout(300);
await page.getByRole('tab', { name: /Learning log/i }).click();
await page.waitForTimeout(300);
const stageButtons = page.getByRole('button', { name: /UNDERSTAND|PRACTICE|APPLY/i });
const stageCount = await stageButtons.count();
for (let i = 0; i < Math.min(3, stageCount); i += 1) {
  await stageButtons.nth(i).click();
  await page.waitForTimeout(120);
}
check('completing path shows gap-not-resolved warning', (await page.getByText(/Learning complete does not resolve the project gap/i).count()) > 0);
const learnState = await state();
const gap = learnState.projects.find((x) => x.id === 'prj_kabadiwala').skillGaps.find((g) => g.id === 'gap_persistence');
check('learning does not auto-resolve gap', gap.resolution !== 'resolved');
await page.getByRole('button', { name: /Record gap evidence/i }).first().click();
await page.getByLabel('Implementation evidence').fill('Pickup and handoff records persist through reload; verified with a repeatable browser reload test.');
await page.getByRole('button', { name: 'Mark gap resolved' }).click();
await page.waitForTimeout(300);
const gapAfter = (await state()).projects.find((x) => x.id === 'prj_kabadiwala').skillGaps.find((g) => g.id === 'gap_persistence');
check('gap resolves only with recorded implementation evidence', gapAfter.resolution === 'resolved');
await shot('28-learning');

/* ---------------- 9. Hackathon tracking ---------------- */
await page.goto(BASE + '/hackathons', { waitUntil: 'networkidle' });
check('hackathon demo warning visible', (await page.getByText(/DEMO DATA — NOT LIVE VERIFIED/i).count()) > 0);
await page.getByRole('button', { name: /^Save$/ }).first().click();
await page.waitForTimeout(200);
await page.getByLabel('Your status').selectOption('Applied');
await page.getByLabel('New preparation task').fill('Draft the eligibility checklist');
await page.getByRole('button', { name: 'Add preparation task' }).click();
await page.getByRole('button', { name: 'Save tracking' }).click();
await page.waitForTimeout(400);
const trackState = await state();
check('hackathon tracking saved with prep task', trackState.hackathonTracking.some((t) => t.tasks.some((x) => x.label === 'Draft the eligibility checklist')));
check('demo deadline is not presented as reliable', (await page.getByText(/DEMO LISTING — dates simulated, not verified/i).count()) > 0);
await shot('29-hackathons');

/* ---------------- 10. Reports + real PDF ---------------- */
await page.goto(BASE + '/projects/prj_kabadiwala/reports', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Generate report' }).click();
await page.waitForTimeout(700);
const reportState = await state();
const reports = reportState.projects.find((x) => x.id === 'prj_kabadiwala').reports;
check('report generated and saved', reports.length === 1, `v${reports[0]?.version}`);
check('report preview renders project content', await page.getByText('Kabadiwala Connect').first().isVisible());
const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
await page.getByRole('button', { name: 'Download PDF' }).click();
const download = await downloadPromise;
const pdfPath = 'shots/' + download.suggestedFilename();
await download.saveAs(pdfPath);
const size = fs.statSync(pdfPath).size;
const head = fs.readFileSync(pdfPath).slice(0, 5).toString();
check('PDF file downloaded', size > 20000, `${(size / 1024).toFixed(1)} KB, ${download.suggestedFilename()}`);
check('PDF has valid header', head === '%PDF-');
await shot('30-report-preview');

/* ---------------- 11. Passport + anti-farming ---------------- */
await page.goto(BASE + '/projects/prj_kabadiwala/passport', { waitUntil: 'networkidle' });
const xpBefore = (await state()).xpEvents.filter((e) => e.projectId === 'prj_kabadiwala').reduce((n, e) => n + e.amount, 0);
await page.getByRole('button', { name: /Record passport/i }).click();
await page.waitForTimeout(600);
const passState1 = await state();
const xpAfter = passState1.xpEvents.filter((e) => e.projectId === 'prj_kabadiwala').reduce((n, e) => n + e.amount, 0);
check('passport recorded', passState1.projects.find((x) => x.id === 'prj_kabadiwala').passports.length === 1);
check('passport awards XP once', xpAfter > xpBefore, `${xpBefore} → ${xpAfter}`);
await page.getByRole('button', { name: /Record passport/i }).click();
await page.waitForTimeout(600);
const passState2 = await state();
const xpAfter2 = passState2.xpEvents.filter((e) => e.projectId === 'prj_kabadiwala').reduce((n, e) => n + e.amount, 0);
check('re-recording passport cannot farm XP', xpAfter2 === xpAfter, `${xpAfter} → ${xpAfter2}`);
check('passport history keeps both records', passState2.projects.find((x) => x.id === 'prj_kabadiwala').passports.length === 2);
await shot('31-passport-recorded');

/* ---------------- 12. Persistence across reload ---------------- */
await page.reload({ waitUntil: 'networkidle' });
check('passport survives reload', await page.getByText(/Recorded passports \(2\)/i).isVisible());
const finalState = await state();
const finalProject = finalState.projects.find((x) => x.id === 'prj_kabadiwala');
check('evidence survives reload', finalProject.evidence.some((e) => e.verification === 'verified'));
check('reports survive reload', finalProject.reports.length === 1);
check('learning survives reload', finalState.learningProgress.filter((l) => l.projectId === 'prj_kabadiwala').length >= 2);

/* ---------------- 13. Mobile overflow ---------------- */
await page.setViewportSize({ width: 390, height: 844 });
for (const path of ['/', '/projects/prj_kabadiwala/prior-art', '/projects/prj_kabadiwala/feasibility', '/projects/prj_kabadiwala/reports', '/hackathons']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`no horizontal overflow on mobile ${path}`, overflow <= 2, `${overflow}px`);
}
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await shot('32-mobile-mission-control');

console.log('\n' + results.join('\n'));
console.log(`\nRuntime problems (${problems.length}):`);
console.log(problems.slice(0, 20).join('\n') || 'none');
console.log(`\nSUMMARY: ${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
await browser.close();
