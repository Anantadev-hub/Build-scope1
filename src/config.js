// ============================================================================
// Frontend configuration
//
// Everything exported here is PUBLIC. Vite inlines VITE_* values into the
// browser bundle, so no token, key, or password may ever live in one. Server
// credentials belong in the backend that these variables point at.
//
// Modes
//   VITE_APP_MODE=demo        fixtures may be loaded (default in `vite dev`)
//   VITE_APP_MODE=production  no automatic fixtures (default in `vite build`)
//   VITE_DEMO_DATA=on|off     explicit override in either direction
//
// A signed-in demo account also counts as explicit demo mode: the user chose
// "Enter demo workspace", so its seeded case is expected. A registered account
// never receives fixtures automatically.
// ============================================================================

const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {};

function truthy(value) {
  return ['1', 'true', 'on', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

function falsy(value) {
  return ['0', 'false', 'off', 'no'].includes(String(value ?? '').trim().toLowerCase());
}

export const APP_MODE = String(ENV.VITE_APP_MODE || (ENV.DEV ? 'demo' : 'production')).trim().toLowerCase() === 'demo'
  ? 'demo'
  : 'production';

// Fixtures are allowed when the build is in demo mode, when the operator forces
// them on, or for an explicitly signed-in demo account.
export const DEMO_DATA_ENABLED = truthy(ENV.VITE_DEMO_DATA)
  ? true
  : (falsy(ENV.VITE_DEMO_DATA) ? false : APP_MODE === 'demo');

export function demoDataEnabled(session) {
  return DEMO_DATA_ENABLED || Boolean(session?.demo);
}

export const AUTH_ADAPTER = ['local-demo', 'backend'].includes(String(ENV.VITE_AUTH_ADAPTER || '').trim().toLowerCase())
  ? String(ENV.VITE_AUTH_ADAPTER).trim().toLowerCase()
  : 'local-demo';

export const API_BASE_URL = String(ENV.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
export const REPOSITORY_SEARCH_PATH = String(ENV.VITE_REPOSITORY_SEARCH_PATH || '/api/search/repositories').trim();

function isAbsolute(url) {
  return /^https?:\/\//i.test(url);
}

// Absolute URLs are used as-is. Relative paths are resolved against the API
// base when one is configured, and otherwise stay same-origin (which is what a
// backend served from the same host expects).
export function resolveEndpoint(path) {
  const target = String(path || '').trim();
  if (!target) return '';
  if (isAbsolute(target)) return target;
  if (API_BASE_URL) return `${API_BASE_URL}${target.startsWith('/') ? '' : '/'}${target}`;
  return target;
}

// The endpoint is only considered configured when a URL is actually supplied.
// VITE_REPOSITORY_SEARCH_PATH documents the default route the backend should
// expose; it is not used as an implicit endpoint.
export const REPOSITORY_SEARCH_ENDPOINT = resolveEndpoint(
  String(ENV.VITE_REPOSITORY_SEARCH_URL || '').trim(),
);

// Non-fatal configuration problems, surfaced in the UI instead of failing
// silently at request time. Empty array means the configuration is usable.
export function configIssues() {
  const issues = [];
  const pageIsHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';

  [
    ['VITE_API_BASE_URL', API_BASE_URL],
    ['VITE_REPOSITORY_SEARCH_URL', REPOSITORY_SEARCH_ENDPOINT],
  ].forEach(([name, value]) => {
    if (!value) return;
    if (!isAbsolute(value) && !value.startsWith('/')) {
      issues.push(`${name} must be an absolute URL or a path beginning with "/" (received "${value}").`);
      return;
    }
    if (pageIsHttps && /^http:\/\//i.test(value)) {
      issues.push(`${name} uses http:// on a secure page; browsers will block the request as mixed content.`);
    }
  });

  if (AUTH_ADAPTER === 'backend') {
    issues.push('VITE_AUTH_ADAPTER=backend was requested, but this build ships only the local demo adapter. The backend auth contract must be implemented before real sign-in works.');
  }

  if (APP_MODE === 'production' && DEMO_DATA_ENABLED) {
    issues.push('VITE_DEMO_DATA is forcing fixtures on in a production build. Disable it once real data is connected.');
  }

  return issues;
}

export function isRepositorySearchConfigured() {
  return Boolean(REPOSITORY_SEARCH_ENDPOINT);
}

// Small, non-secret summary for diagnostics and documentation.
export const CONFIG_SUMMARY = {
  appMode: APP_MODE,
  demoData: DEMO_DATA_ENABLED ? 'enabled' : 'disabled',
  authAdapter: AUTH_ADAPTER,
  apiBaseUrl: API_BASE_URL || '(same origin)',
  repositorySearch: isRepositorySearchConfigured() ? 'configured' : 'not configured',
};
