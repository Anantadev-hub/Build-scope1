// Demo authentication adapter.
//
// BuildScope AI is frontend-only, so this module is the whole "identity system":
// accounts live in this browser, passwords are stored as a salted PBKDF2 digest
// (never plaintext), and the session is a local record. It is deliberately
// structured like a real adapter - every page talks to `auth` through these
// methods only - so a backend/FishAPI adapter can replace `demoAuth` later
// without touching the screens.
//
// What this is NOT: server authentication, identity verification, email
// delivery, or password recovery. Nothing here survives clearing browser data,
// and any XSS on this origin could read the stored session. The UI says so.
import { ProviderNotConfiguredError } from './providers';

export const ACCOUNTS_KEY = 'buildscope.ai.accounts.v1';
export const SESSION_KEY = 'buildscope.ai.session.v1';
export const WORKSPACE_PREFIX = 'buildscope.ai.workspace.v2';
export const LEGACY_WORKSPACE_KEY = 'buildscope.ai.workspace.v1';

export const DEMO_ACCOUNT_EMAIL = 'field.analyst@buildscope.demo';

export const AUTH_CONTRACT = {
  mode: 'local-demo',
  // Contract a backend adapter must satisfy. Documented, not implemented.
  endpoints: [
    { method: 'POST', path: '/api/auth/register', body: '{ name, email, password }', returns: '{ account, session }' },
    { method: 'POST', path: '/api/auth/login', body: '{ email, password, remember }', returns: '{ account, session }' },
    { method: 'POST', path: '/api/auth/logout', body: '-', returns: '204' },
    { method: 'GET', path: '/api/auth/session', body: '-', returns: '{ account } | 401' },
    { method: 'POST', path: '/api/auth/password/request', body: '{ email }', returns: '202 (always, to avoid account enumeration)' },
    { method: 'POST', path: '/api/auth/password/reset', body: '{ token, password }', returns: '204' },
  ],
  notes: [
    'Session cookies must be httpOnly + Secure; this demo cannot do that and does not pretend to.',
    'Password hashing belongs on the server. Here it is local-only so the prototype never stores plaintext.',
    'No API keys or provider tokens are used by the authentication screens.',
  ],
};

export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/* ---------------- storage helpers (defensive: storage can be unavailable) ---------------- */
function readJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sessionStore() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function workspaceKeyFor(accountId) {
  return `${WORKSPACE_PREFIX}:${accountId}`;
}

/* ---------------- password digests ---------------- */
const PBKDF2_ITERATIONS = 120000;

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fallbackDigest(password, salt) {
  // Only used when the context has no Web Crypto (for example plain http on a
  // LAN address). It is a salted, iterated digest, not a good password hash,
  // and accounts created this way are flagged so the UI can say so.
  let h = 2166136261;
  const input = `${salt}:${password}:${salt}`;
  for (let round = 0; round < 5000; round += 1) {
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i) + round;
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return `weak_${h.toString(16)}_${input.length.toString(16)}`;
}

export function cryptoAvailable() {
  return Boolean(typeof window !== 'undefined' && window.crypto && window.crypto.subtle && window.crypto.getRandomValues);
}

function randomId(prefix) {
  if (cryptoAvailable()) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return `${prefix}_${toHex(bytes)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function derive(password, salt, iterations = PBKDF2_ITERATIONS) {
  if (cryptoAvailable()) {
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
      key,
      256,
    );
    return { kdf: 'pbkdf2-sha256', iterations, hash: toHex(bits), weak: false };
  }
  return { kdf: 'local-iterated-digest', iterations: 5000, hash: fallbackDigest(password, salt), weak: true };
}

function equalish(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------------- accounts ---------------- */
function readAccounts() {
  const store = localStore();
  if (!store) return [];
  const raw = readJson(store, ACCOUNTS_KEY, { version: 1, accounts: [] });
  return Array.isArray(raw.accounts) ? raw.accounts : [];
}

function writeAccounts(accounts) {
  const store = localStore();
  if (!store) return false;
  return writeJson(store, ACCOUNTS_KEY, { version: 1, accounts });
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicAccount(account) {
  if (!account) return null;
  const { id, name, email, demo, passwordless, createdAt, kdf, weak } = account;
  return { id, name, email, demo: Boolean(demo), passwordless: Boolean(passwordless), createdAt, kdf, weak: Boolean(weak) };
}

/* ---------------- session ---------------- */
function clearSessions() {
  const l = localStore();
  const s = sessionStore();
  if (l) l.removeItem(SESSION_KEY);
  if (s) s.removeItem(SESSION_KEY);
}

function writeSession(session) {
  clearSessions();
  const target = session.remember ? localStore() : sessionStore();
  if (!target) return false;
  return writeJson(target, SESSION_KEY, session);
}

function readSessionRaw() {
  const l = localStore();
  const s = sessionStore();
  return readJson(l, SESSION_KEY, null) || readJson(s, SESSION_KEY, null);
}

function issueSession(account, remember) {
  const session = {
    accountId: account.id,
    name: account.name,
    email: account.email,
    demo: Boolean(account.demo),
    weak: Boolean(account.weak),
    remember: Boolean(remember),
    issuedAt: new Date().toISOString(),
    expiresAt: remember ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
  };
  if (!writeSession(session)) {
    throw new AuthError('storage-unavailable', 'This browser is blocking local storage, so the demo session could not be kept.');
  }
  return session;
}

/* ---------------- legacy workspace adoption ---------------- */
// Existing builds stored one workspace with no owner. The first account to sign
// in adopts it (copied, then the legacy key is removed) so nobody loses work and
// a second account cannot see it.
function adoptLegacyWorkspace(accountId) {
  const store = localStore();
  if (!store) return false;
  const legacy = store.getItem(LEGACY_WORKSPACE_KEY);
  if (!legacy) return false;
  const target = workspaceKeyFor(accountId);
  if (store.getItem(target)) return false;
  try {
    store.setItem(target, legacy);
    store.removeItem(LEGACY_WORKSPACE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- adapter ---------------- */
export const demoAuth = {
  mode: 'local-demo',

  async getSession() {
    const raw = readSessionRaw();
    if (!raw || !raw.accountId) return null;
    if (raw.expiresAt && new Date(raw.expiresAt).getTime() < Date.now()) {
      clearSessions();
      return null;
    }
    const account = readAccounts().find((a) => a.id === raw.accountId);
    if (!account) {
      clearSessions();
      return null;
    }
    // Keep the session's display fields in step with the stored account.
    const merged = { ...raw, name: account.name, email: account.email, demo: Boolean(account.demo), weak: Boolean(account.weak) };
    return merged;
  },

  async listDemoHint() {
    const accounts = readAccounts();
    return {
      hasAccounts: accounts.length > 0,
      demoAccountExists: accounts.some((a) => a.email === DEMO_ACCOUNT_EMAIL),
      weakFallback: accounts.some((a) => a.weak) || !cryptoAvailable(),
    };
  },

  async register({ name, email, password, remember = true }) {
    const store = localStore();
    if (!store) throw new AuthError('storage-unavailable', 'This browser is blocking local storage, so a demo account cannot be created.');
    const accounts = readAccounts();
    const cleanEmail = normalizeEmail(email);
    if (accounts.some((a) => a.email === cleanEmail)) {
      throw new AuthError('email-in-use', 'A demo account already exists for this email in this browser.');
    }
    const salt = randomId('salt');
    const digest = await derive(password, salt);
    const account = {
      id: randomId('acct'),
      name: String(name || '').trim(),
      email: cleanEmail,
      salt,
      hash: digest.hash,
      kdf: digest.kdf,
      iterations: digest.iterations,
      weak: digest.weak,
      demo: false,
      passwordless: false,
      createdAt: new Date().toISOString(),
      resetRequests: [],
    };
    if (!writeAccounts([...accounts, account])) {
      throw new AuthError('storage-unavailable', 'The demo account could not be saved in this browser.');
    }
    const session = issueSession(account, remember);
    const migrated = adoptLegacyWorkspace(account.id);
    return { account: publicAccount(account), session, migrated };
  },

  async signIn({ email, password, remember = false }) {
    const accounts = readAccounts();
    const cleanEmail = normalizeEmail(email);
    const account = accounts.find((a) => a.email === cleanEmail);
    if (!account) throw new AuthError('invalid-credentials', 'No demo account matches that email in this browser.');
    if (account.passwordless) {
      throw new AuthError('demo-account-password', 'That demo account has no password. Use the demo access option instead.');
    }
    const digest = await derive(password, account.salt, account.iterations || PBKDF2_ITERATIONS);
    if (!equalish(digest.hash, account.hash)) {
      throw new AuthError('invalid-credentials', 'That password does not match the demo account in this browser.');
    }
    const session = issueSession(account, remember);
    const migrated = adoptLegacyWorkspace(account.id);
    return { account: publicAccount(account), session, migrated };
  },

  async demoAccess({ remember = true } = {}) {
    const accounts = readAccounts();
    let account = accounts.find((a) => a.email === DEMO_ACCOUNT_EMAIL);
    if (!account) {
      account = {
        id: randomId('acct'),
        name: 'Field Analyst',
        email: DEMO_ACCOUNT_EMAIL,
        salt: '',
        hash: '',
        kdf: 'none',
        iterations: 0,
        weak: false,
        demo: true,
        passwordless: true,
        createdAt: new Date().toISOString(),
        resetRequests: [],
      };
      writeAccounts([...accounts, account]);
    }
    const session = issueSession(account, remember);
    const migrated = adoptLegacyWorkspace(account.id);
    return { account: publicAccount(account), session, migrated };
  },

  async signOut() {
    clearSessions();
    return true;
  },

  // Password recovery cannot be real without email delivery. This records the
  // request and explains what happened, and gives local accounts a way back in.
  async requestPasswordReset(email) {
    const accounts = readAccounts();
    const cleanEmail = normalizeEmail(email);
    const idx = accounts.findIndex((a) => a.email === cleanEmail);
    const exists = idx >= 0;
    if (exists) {
      accounts[idx] = {
        ...accounts[idx],
        resetRequests: [...(accounts[idx].resetRequests || []), new Date().toISOString()].slice(-5),
      };
      writeAccounts(accounts);
    }
    return {
      delivered: false,
      accountExists: exists,
      // Deliberately the same message either way: no account enumeration.
      message: 'No email was sent — this build has no mail service. Nothing about your account changed.',
    };
  },

  // Demo-only local reset. Stands in for the "follow the emailed link" step.
  async resetPasswordLocal({ email, password }) {
    const accounts = readAccounts();
    const idx = accounts.findIndex((a) => a.email === normalizeEmail(email));
    if (idx < 0) throw new AuthError('invalid-credentials', 'No demo account matches that email in this browser.');
    if (accounts[idx].passwordless) throw new AuthError('demo-account-password', 'The demo access account has no password to reset.');
    const salt = randomId('salt');
    const digest = await derive(password, salt);
    accounts[idx] = { ...accounts[idx], salt, hash: digest.hash, kdf: digest.kdf, iterations: digest.iterations, weak: digest.weak };
    writeAccounts(accounts);
    return { updated: true, account: publicAccount(accounts[idx]) };
  },

  async deleteAccount(accountId) {
    const accounts = readAccounts().filter((a) => a.id !== accountId);
    writeAccounts(accounts);
    const store = localStore();
    if (store) {
      store.removeItem(workspaceKeyFor(accountId));
      store.removeItem(`buildscope.ai.prefs.${accountId}`);
    }
    const session = readSessionRaw();
    if (session?.accountId === accountId) clearSessions();
    return true;
  },

};

// The integration boundary. Selecting a backend adapter later means implementing
// this same shape; no page component needs to change.
export function createBackendAuthAdapter({ baseUrl = '', fetcher } = {}) {
  const notReady = () => {
    const error = new ProviderNotConfiguredError('Backend authentication');
    error.contract = AUTH_CONTRACT;
    error.baseUrl = baseUrl || undefined;
    error.fetcher = fetcher ? 'injected' : undefined;
    throw error;
  };
  return {
    mode: 'backend',
    contract: AUTH_CONTRACT,
    getSession: notReady,
    signIn: notReady,
    register: notReady,
    signOut: notReady,
    requestPasswordReset: notReady,
    resetPasswordLocal: notReady,
    demoAccess: notReady,
  };
}

export const auth = demoAuth;
