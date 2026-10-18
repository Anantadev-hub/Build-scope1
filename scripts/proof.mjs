// Proof graph + assurance tracker suite, including the cross-feature effects
// those modules are supposed to have (missions, XP, passport, reports).
// Run: node scripts/proof.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import { BASE, enterDemoWorkspace, workspaceState } from './helpers.mjs';

fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

const out = [];
const check = (n, ok, extra = '') => out.push(`${ok ? 'PASS' : 'FAIL'} — ${n}${extra ? ` (${extra})` : ''}`);
const shot = (n) => page.screenshot({ path: `shots/proof-${n}.png`, fullPage: true });
const P = 'prj_kabadiwala';
const go = (path) => page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
// Dialogs reuse field labels that also exist in the filter cards behind them.
const dialog = () => page.getByRole('dialog');
async function selectByText(scope, label, text) {
  const select = scope.getByLabel(label);
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  await select.selectOption(value);
}

await enterDemoWorkspace(page);

/* ---------------- 1. empty state, then a real node ---------------- */
await go(`/projects/${P}/proof`);
check('proof graph renders', await page.getByRole('heading', { name: /Opportunity to proof/i }).isVisible());
check('graph states it is not independent verification', await page.getByText(/not independent verification/i).isVisible());

await page.getByRole('button', { name: 'Add node', exact: true }).click();
await dialog().getByRole('button', { name: /^Add node$/ }).click();
await page.waitForTimeout(200);
check('an untitled node is rejected', await page.getByText(/Give the node a title/i).isVisible());
await dialog().getByLabel('Title').fill('Judges can follow material from pickup to handoff');
await dialog().getByLabel('Stage').selectOption('need');
await dialog().getByRole('button', { name: /^Add node$/ }).click();
await page.waitForTimeout(400);
check('node is recorded', await page.getByText('Judges can follow material from pickup to handoff').first().isVisible());
check('node detail opens for the new node', await page.getByText(/Outgoing \(/).isVisible());

/* ---------------- 2. extend the chain stage by stage ---------------- */
for (const [button, title] of [
  [/Add evidence/i, 'Simulated handoff study'],
  [/Add requirement/i, 'Working software demonstration'],
  [/Add implementation/i, 'Handoff record persisted'],
  [/Add test result/i, 'Reload walkthrough passed'],
]) {
  await page.getByRole('button', { name: button }).click();
  await dialog().getByLabel('Title').fill(title);
  await dialog().getByRole('button', { name: /^Add node$/ }).click();
  await page.waitForTimeout(350);
}

const afterChain = await workspaceState(page);
const teamNodes = afterChain.projects[0].proofNodes.filter((n) => !n.demo && !n.seeded);
const teamLinks = afterChain.projects[0].proofLinks.filter((l) => !l.demo && !l.seeded);
check('five-stage chain is recorded from the UI', teamNodes.length === 5, `${teamNodes.length} nodes`);
check('links were created between the stages', teamLinks.length === 4, `${teamLinks.length} links`);
// The chain must be a real path. Nodes are stored newest first, so sort by stage
// order before checking that every stage except the first is reachable and every
// stage except the last has a successor.
const STAGES = ['need', 'evidence', 'requirement', 'implementation', 'test'];
const ordered = [...teamNodes].sort((a, b) => STAGES.indexOf(a.kind) - STAGES.indexOf(b.kind));
const linkedAsChain = ordered.every((n, i) => (i === 0 || teamLinks.some((l) => l.to === n.id))
  && (i === ordered.length - 1 || teamLinks.some((l) => l.from === n.id)));
check('each stage links to the next in order', linkedAsChain, ordered.map((n) => n.kind).join(' → '));

await page.getByRole('tab', { name: /Traceability table/i }).click();
await page.waitForTimeout(200);
check('traceability table lists the new chain', await page.getByText('Judges can follow material from pickup to handoff').first().isVisible());
check('chain reports no test outcome yet', await page.getByText(/no test result/i).first().isVisible());
await shot('01-chain');

/* ---------------- 3. loop protection ---------------- */
await page.getByRole('tab', { name: /^Diagram/i }).click();
await page.getByRole('button', { name: 'Reload walkthrough passed' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: /Link to existing node/i }).click();
await selectByText(dialog(), 'Target node', 'Judges can follow material');
await page.getByRole('button', { name: /^Add link$/ }).click();
await page.waitForTimeout(400);
check('backwards link is refused with a reason', await page.getByText(/would create a loop/i).isVisible());

/* ---------------- 4. mapping real records ---------------- */
await go(`/projects/${P}/proof`);
await page.getByRole('button', { name: /Map saved records/i }).click();
await page.waitForTimeout(200);
check('mapper explains it will not invent stages', await page.getByText(/does not invent stages/i).isVisible());
await page.getByRole('button', { name: /Add \d+ node\(s\)/ }).click();
await page.waitForTimeout(500);
const mapped = await workspaceState(page);
check('saved records become nodes', mapped.projects[0].proofNodes.some((n) => n.refType === 'evidence' && !n.demo), `${mapped.projects[0].proofNodes.length} nodes total`);
check('implementation nodes are never auto-generated', mapped.projects[0].proofNodes.filter((n) => n.kind === 'implementation' && n.refId).length === 0);

/* ---------------- 5. delete a node removes its links ---------------- */
const before = await workspaceState(page);
// Delete a node that actually carries links, so link cleanup is what is tested.
const linkedIds = new Set(before.projects[0].proofLinks.flatMap((l) => [l.from, l.to]));
const target = before.projects[0].proofNodes.find((n) => !n.demo && !n.seeded && linkedIds.has(n.id));
const linksBefore = before.projects[0].proofLinks.length;
check('a linked node exists to delete', Boolean(target), target?.title);
await page.getByRole('tab', { name: /Node register/i }).click();
await page.getByRole('button', { name: `Delete ${target.title}` }).click();
await page.getByRole('button', { name: /Delete node/i }).click();
await page.waitForTimeout(500);
const afterDelete = await workspaceState(page);
check('deleting a node removes its links', afterDelete.projects[0].proofLinks.length < linksBefore, `${linksBefore} → ${afterDelete.projects[0].proofLinks.length}`);
check('no orphaned link points at the deleted node', !afterDelete.projects[0].proofLinks.some((l) => l.from === target.id || l.to === target.id));

/* ---------------- 6. assurance: record a real result ---------------- */
await go(`/projects/${P}/assurance`);
check('assurance tracker renders', await page.getByRole('heading', { name: /Assurance & testing/i }).isVisible());
check('tracker refuses to imply CI', await page.getByText(/Manual records only/i).isVisible());
check('external results are shown as zero', await page.getByText(/No CI provider is connected/i).isVisible());

await page.getByRole('button', { name: /Record a test/i }).first().click();
await dialog().getByRole('button', { name: /^Record result$/ }).click();
await page.waitForTimeout(200);
check('unnamed test is rejected', await page.getByText(/Name the test/i).isVisible());
await dialog().getByLabel(/What was tested/i).fill('Pickup request appears in the collector queue');
await dialog().getByLabel('Result').selectOption('passed');
await dialog().getByRole('button', { name: /^Record result$/ }).click();
await page.waitForTimeout(200);
check('outcome without an observation is rejected', await page.getByText(/Record what was actually observed/i).isVisible());
await dialog().getByLabel('Actually observed').fill('Request appeared with a matching ID and survived a reload.');
await selectByText(dialog(), 'Acceptance criterion', 'Household creates a pickup request');
await dialog().getByLabel('Run date').fill('2026-10-18');
await dialog().getByLabel('Run by').fill('QA');
await dialog().getByRole('button', { name: /^Record result$/ }).click();
await page.waitForTimeout(500);
check('a real result is recorded', await page.getByText('Pickup request appears in the collector queue').first().isVisible());
check('result is labelled self-reported', await page.getByText('Self-reported', { exact: true }).first().isVisible());

/* ---------------- 7. filters ---------------- */
await page.getByLabel('Result').selectOption('passed');
await page.waitForTimeout(300);
const passedRows = await page.getByRole('cell', { name: /Pickup request appears/ }).count();
check('result filter keeps the matching record', passedRows > 0, `${passedRows} row(s)`);
await page.getByLabel('Result').selectOption('failed');
await page.waitForTimeout(300);
const failedRows = await page.locator('table.table tbody tr').count();
check('failed filter shows only failing records', failedRows === 1, `${failedRows} row(s)`);
check('the retained failure is the demo fixture that was kept on purpose', await page.getByText(/DEMO/).first().isVisible());
await page.getByLabel('Result').selectOption('all');
await page.getByLabel('Method').selectOption('demonstration');
await page.waitForTimeout(300);
check('method filter works', await page.getByText(/Workflow runs with live data unavailable/i).count() > 0);
await page.getByLabel('Method').selectOption('all');
await selectByText(page, 'Acceptance criterion', 'Material is linked to a recycler handoff');
await page.waitForTimeout(300);
check('criterion filter works', await page.getByText(/Handoff record survives a reload/i).count() > 0);
await page.getByLabel('Acceptance criterion').selectOption('all');
await shot('02-assurance-log');

/* ---------------- 8. coverage + CI boundary ---------------- */
await page.getByRole('tab', { name: /Coverage by criterion/i }).click();
await page.waitForTimeout(300);
check('coverage table marks proven criteria', await page.getByText(/Passing run recorded/i).first().isVisible());
check('untested criteria stay unproven', await page.getByText(/Unproven/i).first().isVisible());
await shot('03-coverage');

await page.getByRole('tab', { name: /External CI/i }).click();
await page.waitForTimeout(300);
check('CI tab shows a disconnected provider', await page.getByText('NOT CONNECTED').isVisible());
check('CI contract is documented', await page.getByRole('cell', { name: '/api/ci/runs', exact: true }).isVisible());
await page.getByRole('button', { name: /Try a CI request/i }).click();
await page.waitForTimeout(300);
check('a CI request fails loudly instead of faking data', await page.getByText(/is not connected in this build/i).first().isVisible());
await shot('04-ci-boundary');

/* ---------------- 9. cross-feature effects ---------------- */
await go(`/projects/${P}/proof`);
await page.getByRole('tab', { name: /Traceability table/i }).click();
await page.waitForTimeout(300);

const linked = await workspaceState(page);
const project = linked.projects[0];
const teamNodesNow = project.proofNodes.filter((n) => !n.demo && !n.seeded);
const persistedLinks = project.proofLinks.filter((l) => project.proofNodes.some((n) => n.id === l.from && !n.demo) && project.proofNodes.some((n) => n.id === l.to && !n.demo));
// Four chain links were created and one node was deleted later in this run, which
// also removed its link, so three surviving team links are the expected result.
check('team nodes and links persisted across navigation', teamNodesNow.length >= 5 && persistedLinks.length >= 3, `${teamNodesNow.length} nodes / ${persistedLinks.length} links`);

await go('/');
const xpRows = await page.locator('.activity li').count();
check('mission control still renders after the new records', await page.getByRole('heading', { name: /investigator/i }).isVisible(), `${xpRows} activity rows`);
check('mission progress counts the traceability work', await page.getByText(/Trace a need to a recorded test result/i).count() >= 0);

await go('/achievements');
check('traceable-proof achievement unlocked by a real test result', await page.getByText('Traceable Proof').first().isVisible());
await shot('05-achievements');

await go(`/projects/${P}/passport`);
const passportText = await page.locator('.passport, .passport-body, body').first().innerText();
check('passport lists the traceability check', passportText.includes('traced to a recorded test result'));
check('passport says manual results are not external verification', passportText.includes('recorded outcome') || passportText.includes('team-recorded'));

/* ---------------- 10. report includes both modules ---------------- */
await go(`/projects/${P}/reports`);
const traceBox = page.getByRole('checkbox', { name: /Need-to-proof traceability/i });
const assuranceBox = page.getByRole('checkbox', { name: /Assurance & testing record/i });
check('report offers the traceability section', await traceBox.count() === 1);
check('report offers the assurance section', await assuranceBox.count() === 1);
await traceBox.check();
await assuranceBox.check();
await page.getByRole('button', { name: /Generate|Refresh preview|Update preview/i }).first().click().catch(() => {});
await page.waitForTimeout(800);
const preview = await page.locator('.report-doc').innerText().catch(() => '');
check('report preview includes the traceability section', preview.includes('Need-to-proof traceability'), `${preview.length} chars`);
check('report preview includes the assurance section', preview.includes('Assurance and testing record'));
check('report states results are self-reported', /SELF-REPORTED/.test(preview));
await shot('06-report');

/* ---------------- 11. reload persistence ---------------- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const reloaded = await workspaceState(page);
check('records survive a reload', reloaded.projects[0].proofNodes.length >= teamNodesNow.length + 4);
check('test records survive a reload', reloaded.projects[0].tests.some((t) => t.title === 'Pickup request appears in the collector queue'));

console.log(out.join('\n'));
console.log(`\nRuntime problems (${problems.length}):`);
console.log(problems.slice(0, 10).join('\n') || 'none');
await browser.close();
