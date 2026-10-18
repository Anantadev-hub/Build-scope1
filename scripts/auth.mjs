// Authentication suite: registration, validation, sign-in, session handling,
// password recovery (demo), sign-out, route guards, and per-account isolation.
// Run: node scripts/auth.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import { BASE, SESSION_KEY, enterDemoWorkspace, workspaceState } from './helpers.mjs';

fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

const out = [];
const check = (n, ok, extra = '') => out.push(`${ok ? 'PASS' : 'FAIL'} — ${n}${extra ? ` (${extra})` : ''}`);
const shot = (name) => page.screenshot({ path: `shots/auth-${name}.png`, fullPage: true });

const NEW_ACCOUNT = { name: 'Ada Okonkwo', email: 'ada.demo@example.com', password: 'collect2026' };

/* ---------------- 1. registration validation ---------------- */
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
check('register screen renders', await page.getByRole('heading', { name: /Create a demo account/i }).isVisible());
check('password requirements are listed up front', await page.getByText('At least 8 characters').isVisible());

await page.getByRole('button', { name: /Create demo account/i }).click();
await page.waitForTimeout(200);
check('empty submit shows field errors', await page.getByText(/Enter the name that should appear/i).isVisible());
check('terms acknowledgement is required', await page.getByText(/Acknowledge how this demo workspace stores data/i).isVisible());
await shot('01-validation-empty');

await page.getByLabel('Full name').fill(NEW_ACCOUNT.name);
await page.getByLabel('Email address').fill('not-an-email');
await page.getByRole('textbox', { name: 'Password', exact: true }).fill('short');
await page.getByRole('textbox', { name: 'Confirm password', exact: true }).fill('different');
await page.getByRole('button', { name: /Create demo account/i }).click();
await page.waitForTimeout(200);
check('invalid email is rejected', await page.getByText(/does not look like an email address/i).isVisible());
check('weak password explains what is missing', await page.getByText(/Password needs:/i).isVisible());
check('mismatched confirmation is rejected', await page.getByText(/two passwords do not match/i).isVisible());

// Password visibility control.
const passwordField = page.getByRole('textbox', { name: 'Password', exact: true });
check('password is masked by default', await passwordField.getAttribute('type') === 'password');
await page.getByRole('button', { name: /Show password/i }).first().click();
check('show-password control reveals it', await passwordField.getAttribute('type') === 'text');
await page.getByRole('button', { name: /Hide password/i }).first().click();

await page.getByLabel('Email address').fill(NEW_ACCOUNT.email);
await page.getByRole('textbox', { name: 'Password', exact: true }).fill(NEW_ACCOUNT.password);
await page.getByRole('textbox', { name: 'Confirm password', exact: true }).fill(NEW_ACCOUNT.password);
await page.getByText(/I understand this is a local demo workspace/i).click();
await shot('02-validation-fixed');
await page.getByRole('button', { name: /Create demo account/i }).click();
await page.waitForURL(/\/welcome/, { timeout: 10000 });
check('registration signs the new account in', page.url().includes('/welcome'), page.url());

const accountState = await page.evaluate(() => JSON.parse(localStorage.getItem('buildscope.ai.accounts.v1') || '{}'));
const stored = accountState.accounts?.find((a) => a.email === NEW_ACCOUNT.email);
check('account is stored without the plaintext password', Boolean(stored) && !JSON.stringify(stored).includes(NEW_ACCOUNT.password), stored?.kdf);
check('password digest is salted per account', Boolean(stored?.salt) && Boolean(stored?.hash), stored?.kdf);

/* ---------------- 2. new accounts start empty ---------------- */
await page.getByRole('button', { name: /Start a new investigation/i }).click();
await page.waitForURL(/projects\/new/);
const fresh = await workspaceState(page);
check('blank start leaves no auto-seeded demo case', (fresh.projects || []).length === 0, `${(fresh.projects || []).length} project(s)`);

/* ---------------- 3. sign out, then wrong password ---------------- */
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'SIGN OUT OF THIS DEMO ACCOUNT', exact: true }).click();
await page.waitForURL(/\/login/);
check('sign-out returns to login', page.url().includes('/login'));

await page.getByLabel('Email address').fill(NEW_ACCOUNT.email);
await page.getByRole('textbox', { name: 'Password', exact: true }).fill('wrong-password-1');
await page.getByRole('button', { name: /Sign in$/ }).click();
await page.waitForTimeout(400);
check('wrong password shows a clear error', await page.getByText(/does not match the demo account/i).isVisible());
await shot('03-wrong-password');

/* ---------------- 4. remember-me: session vs persisted ---------------- */
await page.getByRole('textbox', { name: 'Password', exact: true }).fill(NEW_ACCOUNT.password);
await page.getByRole('button', { name: /Sign in$/ }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'));
const sessionStore = await page.evaluate((key) => ({
  local: Boolean(localStorage.getItem(key)),
  session: Boolean(sessionStorage.getItem(key)),
}), SESSION_KEY);
check('unchecked “keep me signed in” keeps the session in this tab only', sessionStore.session && !sessionStore.local, JSON.stringify(sessionStore));

await page.reload({ waitUntil: 'networkidle' });
check('refresh preserves the intended session', !page.url().includes('/login'), page.url());

await page.getByRole('button', { name: 'SIGN OUT OF THIS DEMO ACCOUNT', exact: true }).click();
await page.waitForURL(/\/login/);
await page.getByLabel('Email address').fill(NEW_ACCOUNT.email);
await page.getByRole('textbox', { name: 'Password', exact: true }).fill(NEW_ACCOUNT.password);
await page.getByLabel(/Keep me signed in/i).check();
await page.getByRole('button', { name: /Sign in$/ }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'));
const remembered = await page.evaluate((key) => Boolean(localStorage.getItem(key)), SESSION_KEY);
check('remembered session is written to persistent storage', remembered);
await page.getByRole('button', { name: 'SIGN OUT OF THIS DEMO ACCOUNT', exact: true }).click();
await page.waitForURL(/\/login/);

/* ---------------- 5. password recovery (demo only) ---------------- */
await page.getByRole('link', { name: /Forgot password/i }).click();
await page.waitForURL(/\/forgot/);
check('forgot-password screen renders', await page.getByRole('heading', { name: /Reset a local demo password/i }).isVisible());
await page.getByLabel('Account email').fill(NEW_ACCOUNT.email);
await page.getByRole('button', { name: /Request a reset/i }).click();
await page.waitForTimeout(400);
check('no email is claimed', await page.getByText(/No email was sent/i).isVisible());
await shot('04-recovery');
await page.getByRole('button', { name: /Use the local demo reset/i }).click();
await page.getByRole('textbox', { name: 'New password', exact: true }).fill('handoff2026');
await page.getByRole('textbox', { name: 'Confirm new password', exact: true }).fill('handoff2026');
await page.getByRole('button', { name: /Replace local password/i }).click();
await page.waitForTimeout(500);
check('local reset confirms it replaced the digest', await page.getByText(/password digest in this browser has been replaced/i).isVisible());
await page.getByRole('button', { name: /Return to sign in/i }).click();
await page.waitForURL(/\/login/);
await page.getByLabel('Email address').fill(NEW_ACCOUNT.email);
await page.getByRole('textbox', { name: 'Password', exact: true }).fill('handoff2026');
await page.getByRole('button', { name: /Sign in$/ }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10000 });
check('new password works after the demo reset', !page.url().includes('/login'), page.url());

/* ---------------- 6. per-account isolation ---------------- */
await page.goto(`${BASE}/projects/new`, { waitUntil: 'networkidle' });
await page.getByLabel(/Project name/i).fill('Ada private case');
await page.getByRole('button', { name: /Open case file/i }).click();
await page.waitForURL(/\/projects\/prj_/, { timeout: 10000 });
await page.waitForTimeout(600);
const adaLater = await workspaceState(page);
check('second account keeps its own case', (adaLater.projects || []).some((p) => p.name === 'Ada private case'), `${(adaLater.projects || []).length} project(s)`);

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'SIGN OUT OF THIS DEMO ACCOUNT', exact: true }).click();
await page.waitForURL(/\/login/);
await enterDemoWorkspace(page, { expectWelcome: false });
const demoState = await workspaceState(page);
check('demo account does not see the other account’s case', !(demoState.projects || []).some((p) => p.name === 'Ada private case'));
check('demo account still has its own seeded case', (demoState.projects || []).some((p) => p.id === 'prj_kabadiwala'));

console.log(out.join('\n'));
console.log(`\nRuntime problems (${problems.length}):`);
console.log(problems.slice(0, 12).join('\n') || 'none');
await browser.close();
