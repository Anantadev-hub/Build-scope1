// Shared Playwright helpers.
//
// The workspace is now stored per signed-in demo account, so scripts sign in
// through the real UI (that is itself a check) and read state from the key that
// belongs to the current session.
export const BASE = 'http://127.0.0.1:3000';
export const WORKSPACE_PREFIX = 'buildscope.ai.workspace.v2';
export const SESSION_KEY = 'buildscope.ai.session.v1';

export async function enterDemoWorkspace(page, { expectWelcome = true } = {}) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const button = page.getByRole('button', { name: /Enter demo workspace/i });
  await button.click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 });
  if (expectWelcome) {
    await page.waitForTimeout(300);
    const onWelcome = page.url().includes('/welcome');
    if (onWelcome) {
      await page.getByRole('button', { name: /Explore the Kabadiwala Connect case/i }).click();
      await page.waitForURL(/\/projects\/prj_kabadiwala/);
    } else {
      await page.goto(`${BASE}/projects/prj_kabadiwala`, { waitUntil: 'networkidle' });
    }
  }
  return page.url();
}

// Mirrors the app's own lookup: a remembered session lives in localStorage, an
// unremembered one only in sessionStorage for the current tab.
export async function workspaceState(page) {
  return page.evaluate((prefix) => {
    const sessionRaw = localStorage.getItem('buildscope.ai.session.v1') || sessionStorage.getItem('buildscope.ai.session.v1');
    const session = sessionRaw ? JSON.parse(sessionRaw) : null;
    if (!session?.accountId) return {};
    return JSON.parse(localStorage.getItem(`${prefix}:${session.accountId}`) || '{}');
  }, WORKSPACE_PREFIX);
}

// The sidebar button is used deliberately: it is the visible, labelled control
// rather than the compact top-bar chip.
export async function signOut(page) {
  await page.getByRole('button', { name: 'SIGN OUT OF THIS DEMO ACCOUNT', exact: true }).click();
  await page.waitForURL(/\/login/, { timeout: 10000 });
}
