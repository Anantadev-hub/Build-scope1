// ============================================================================
// Central API client
//
// One place for request construction, timeouts, JSON handling, error shape, and
// unauthorized handling. Services below this layer translate the result into
// their own domain errors; components never call fetch directly.
//
// Security notes:
// - No credentials are read here. With a cookie-based backend, `credentials`
//   is 'include'; the browser owns the cookie and JavaScript cannot read it.
// - Tokens must never be stored in localStorage by this app. If a backend needs
//   bearer tokens, it should issue httpOnly cookies instead.
// - Error bodies are surfaced only as a short message/detail, never as a raw
//   server stack trace.
// ============================================================================
import { resolveEndpoint } from '../config';

export class ApiError extends Error {
  constructor(code, message, { status, detail, url } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code; // not-configured | network | timeout | aborted | http | invalid-response
    if (Number.isFinite(status)) this.status = status;
    if (detail) this.detail = String(detail).slice(0, 300);
    if (url) this.url = url;
  }
}

export const UNAUTHORIZED_EVENT = 'buildscope:unauthorized';

// The auth provider subscribes here so an expired backend session signs the
// user out once, in one place, instead of every screen handling 401.
export function notifyUnauthorized(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail }));
}

export function onUnauthorized(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => handler(event.detail);
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, listener);
}

function firstString(...values) {
  const hit = values.find((v) => typeof v === 'string' && v.trim());
  return hit ? hit.trim().slice(0, 300) : '';
}

async function readBody(response) {
  if (response.status === 204 || response.status === 205) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // An HTML error page from a proxy is a failure, not a payload. Handlers that
    // expect JSON get null and report an invalid response.
    return { __nonJson: true, snippet: text.slice(0, 120).replace(/\s+/g, ' ') };
  }
}

export async function apiRequest(path, {
  method = 'GET',
  body,
  headers = {},
  signal,
  timeoutMs = 20000,
  credentials = 'same-origin',
  expectJson = true,
} = {}) {
  const url = resolveEndpoint(path);
  if (!url) {
    throw new ApiError('not-configured', 'No endpoint is configured for this request.');
  }

  // Combine the caller's signal with our own timeout so a stalled request can
  // never leave a screen in a permanent loading state.
  const local = new AbortController();
  let timedOut = false;
  const forwardAbort = () => local.abort();
  if (signal) {
    if (signal.aborted) local.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }
  const timer = setTimeout(() => { timedOut = true; local.abort(); }, timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method,
      credentials,
      signal: local.signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (local.signal.aborted) {
      if (timedOut) throw new ApiError('timeout', `The request did not answer within ${Math.round(timeoutMs / 1000)}s.`, { url });
      throw new ApiError('aborted', 'The request was cancelled.', { url });
    }
    throw new ApiError('network', 'The request could not reach the server. Check the connection, the API base URL, and whether the server allows this origin.', { url });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  const payload = await readBody(response);

  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized({ status: 401 });
    const detail = firstString(payload?.error, payload?.message, payload?.detail);
    throw new ApiError('http', `The server returned HTTP ${response.status}${detail ? ` — ${detail}` : ''}.`, {
      status: response.status,
      detail,
      url,
    });
  }

  if (payload?.__nonJson) {
    if (!expectJson) return null;
    throw new ApiError('invalid-response', 'The server returned a page instead of JSON. Check that the endpoint path and API base URL are correct.', { status: response.status, url });
  }
  if (payload === null && expectJson && response.status !== 204) {
    throw new ApiError('invalid-response', 'The server returned an empty body where JSON was expected.', { status: response.status, url });
  }
  return payload;
}

// Kept separate so the shape of a successful call is obvious at call sites.
export async function apiRequestJson(path, options) {
  return apiRequest(path, { ...options, expectJson: true });
}
