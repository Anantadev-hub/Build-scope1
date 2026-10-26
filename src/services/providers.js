// ============================================================================
// SERVICE INTERFACES
//
// Repository search is the one provider that makes a real request. It posts to
// the endpoint configured in VITE_REPOSITORY_SEARCH_URL and maps the response
// into the app's records. When no endpoint is configured it throws
// ProviderNotConfiguredError: it never returns fixtures, and it never falls back
// to demo data after a failed request.
//
// Every other provider is still deliberately unimplemented and throws
// ProviderNotConfiguredError. Demo fixtures live in src/data/demo.js and are
// labelled in the UI; they must never be routed through these interfaces as if
// they were live results.
//
// Production notes:
// - Secret-bearing calls (GitHub tokens, FishAPI keys, event APIs) belong in the
//   backend route, never in this client bundle. Only the public URL lives here.
// - The normalized models below are intentionally provider-agnostic so the UI
//   keeps working if GitHub search is replaced by FishAPI or another source.
// - Results carry retrieval timestamp, source URL, metadata availability, and
//   explicit limitations.
// ============================================================================
import { repositoryFinding } from '../lib/models';
import { REPOSITORY_SEARCH_ENDPOINT, isRepositorySearchConfigured } from '../config';
import { ApiError, apiRequest } from './api';

// Public route only. No token belongs in a VITE_ variable: Vite inlines these
// values into the client bundle where anyone can read them.
export { REPOSITORY_SEARCH_ENDPOINT, isRepositorySearchConfigured };
export const REPOSITORY_SEARCH_CONFIG_KEY = 'VITE_REPOSITORY_SEARCH_URL';

// Contract the backend route must satisfy. Documented here so the client and
// the server cannot drift apart silently.
export const REPOSITORY_SEARCH_CONTRACT = {
  mode: 'http',
  method: 'POST',
  path: '/api/search/repositories',
  contentType: 'application/json',
  request: {
    query: 'string — primary query, entered or derived from the brief',
    queries: '[string] — additional derived queries, may be empty',
    limit: 'number — maximum results requested (client sends 20)',
    investigation: '{ name, problem, solution, desiredOutcome, targetUsers: [string], features: [string], stack: [string] }',
  },
  response: {
    results: '[{ name, owner, url, description, language, topics: [string], stars, forks, lastUpdated, licence, docs, matchReason?, overlap?, relevantFeatures?: [string], limitations? }]',
    retrievedAt: 'ISO timestamp of the provider retrieval (optional; client timestamps the response otherwise)',
    source: 'string, e.g. "github" (optional)',
    warnings: '[string] (optional) — surfaced in the UI',
  },
  errors: 'Non-2xx with a JSON body { error?: string }. The client shows the status and message and keeps previously saved records; it never substitutes fixtures.',
  notes: [
    'The server holds the GitHub/FishAPI credential and applies caching and rate limits.',
    'The response must be JSON; HTML error pages are reported as an invalid response.',
    'Owned by the backend team. This client is the only consumer.',
  ],
};

export const SOURCE_CAPABILITIES = {
  github: {
    label: 'Repository search — backend route in front of GitHub or FishAPI',
    supports: ['repositories', 'repository metadata', 'topics', 'licences', 'stars/forks'],
    limitations: ['public repositories only', 'rate limits', 'not a general web search'],
    configuration: [REPOSITORY_SEARCH_CONFIG_KEY, 'provider token stays server-side'],
    // Live only when the build was given an endpoint; otherwise nothing is sent.
    status: isRepositorySearchConfigured() ? 'configured' : 'not-connected',
  },
  fishapi: {
    label: 'FishAPI — general web / source retrieval',
    supports: ['needs confirmation against current documentation'],
    limitations: ['capabilities must be verified before depending on them'],
    configuration: ['FISHAPI_KEY server-side'],
    status: 'not-connected',
  },
  hackathonProvider: {
    label: 'Hackathon source provider',
    supports: ['event discovery (future)'],
    limitations: ['verification still requires an official organiser source per field'],
    configuration: ['provider key server-side'],
    status: 'not-connected',
  },
  ci: {
    label: 'CI run results (GitHub Actions or equivalent)',
    supports: ['run status', 'conclusions', 'artefact links', 'commit SHA'],
    limitations: [
      'a run URL and commit SHA are required before a result may be shown as external',
      'tokens belong in a server route, never in this bundle',
      'no results are simulated while this is disconnected',
    ],
    configuration: ['CI_PROVIDER', 'CI_TOKEN (server-side only)'],
    status: 'not-connected',
  },
};

export class ProviderNotConfiguredError extends Error {
  constructor(provider) {
    super(`${provider} is not connected in this build. No request was made.`);
    this.name = 'ProviderNotConfiguredError';
    this.provider = provider;
  }
}

function unimplemented(id, label, method) {
  return async function notConfigured() {
    // Intentionally no network call. Wire this to a server route such as
    // POST /api/search/repositories when a backend exists.
    throw new ProviderNotConfiguredError(`${label} (${id}.${method})`);
  };
}

export class RepositorySearchError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'RepositorySearchError';
    this.code = code;
    if (Number.isFinite(extra.status)) this.status = extra.status;
  }
}

function ownerOf(raw) {
  const owner = raw.owner;
  if (typeof owner === 'string') return owner;
  if (owner && typeof owner === 'object') return owner.login || owner.name || '';
  return typeof raw.ownerName === 'string' ? raw.ownerName : '';
}

function numberOrNull(...values) {
  const hit = values.find((v) => Number.isFinite(v));
  return hit === undefined ? null : hit;
}

function platformLabel(source) {
  const s = String(source || '').toLowerCase();
  if (!s) return 'Live search';
  if (s === 'github') return 'GitHub';
  if (s === 'fishapi') return 'FishAPI';
  return source;
}

// One provider record -> the app's repository record. Unknown fields become
// explicit "Unknown"/'' values instead of plausible-looking placeholders.
export function mapRepositoryResult(raw, { retrievedAt = '', source = 'github' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const fullName = typeof raw.full_name === 'string' ? raw.full_name : '';
  const name = String(raw.name || (fullName.includes('/') ? fullName.split('/').pop() : '') || '').trim();
  if (!name) return null;
  const url = String(raw.url || raw.html_url || raw.repositoryUrl || '').trim();
  const licence = raw.licence ?? raw.license?.spdx_id ?? raw.license?.name ?? 'Unknown';
  return repositoryFinding({
    name,
    owner: ownerOf(raw) || (fullName.includes('/') ? fullName.split('/')[0] : ''),
    description: String(raw.description || ''),
    platform: raw.platform || platformLabel(source),
    url,
    language: raw.language || 'Unknown',
    topics: Array.isArray(raw.topics) ? raw.topics.map(String) : [],
    stars: numberOrNull(raw.stars, raw.stargazers_count),
    forks: numberOrNull(raw.forks, raw.forks_count),
    lastUpdated: String(raw.lastUpdated || raw.updated_at || raw.pushed_at || ''),
    licence: String(licence),
    docs: String(raw.docs || (raw.has_wiki === true ? 'Wiki present' : 'Unknown')),
    relevantFeatures: Array.isArray(raw.relevantFeatures) ? raw.relevantFeatures.map(String) : [],
    matchReason: String(raw.matchReason || ''),
    overlap: String(raw.overlap || ''),
    possibleDifferences: String(raw.possibleDifferences || ''),
    limitations: String(raw.limitations || `Retrieved by live search on ${retrievedAt.slice(0, 10) || 'this session'}. Public metadata only; documented capability requires reading the source itself.`),
    retrieval: 'live',
    checkedAt: retrievedAt,
    demo: false,
    seeded: false,
  });
}

// Validates the envelope before anything reaches the UI. A response that does
// not contain a results array is an error, never an empty success.
export function toRepositorySearchResult(payload, { query = '', endpoint = '' } = {}) {
  const list = Array.isArray(payload) ? payload : payload?.results ?? payload?.items;
  if (!Array.isArray(list)) {
    throw new RepositorySearchError(
      'invalid-response',
      'The search service responded, but the body has no results array. Expected { results: [...] }.',
    );
  }
  const envelope = Array.isArray(payload) ? {} : payload;
  const retrievedAt = envelope?.retrievedAt ? String(envelope.retrievedAt) : new Date().toISOString();
  const source = envelope?.source || 'github';
  const results = list.map((raw) => mapRepositoryResult(raw, { retrievedAt, source })).filter(Boolean);
  return {
    query,
    endpoint,
    source: platformLabel(source),
    retrievedAt,
    results,
    skipped: list.length - results.length,
    warnings: Array.isArray(envelope?.warnings) ? envelope.warnings.map(String) : [],
  };
}

export function createRepositorySearchProvider() {
  const configured = isRepositorySearchConfigured();
  return {
    id: 'github',
    live: configured,
    isConfigured: configured,
    endpoint: REPOSITORY_SEARCH_ENDPOINT,
    configKey: REPOSITORY_SEARCH_CONFIG_KEY,
    async search({ query, queries = [], investigation = {}, limit = 20, signal, timeoutMs = 20000 } = {}) {
      if (!configured) {
        throw new ProviderNotConfiguredError(`Repository search (${REPOSITORY_SEARCH_CONFIG_KEY} is not set)`);
      }
      const primary = String(query || '').trim();
      if (!primary) {
        throw new RepositorySearchError('empty-query', 'A search query is required. BuildScope does not send blank requests.');
      }
      let payload;
      try {
        payload = await apiRequest(REPOSITORY_SEARCH_ENDPOINT, {
          method: 'POST',
          body: { query: primary, queries, limit, investigation },
          signal,
          timeoutMs,
        });
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        if (err.code === 'aborted') throw new RepositorySearchError('aborted', 'The search was cancelled.');
        if (err.code === 'timeout') {
          throw new RepositorySearchError('timeout', `The search service did not answer within ${Math.round(timeoutMs / 1000)}s.`);
        }
        if (err.code === 'network') {
          throw new RepositorySearchError(
            'network',
            'The request could not reach the configured search service. Check that it is running and that it allows this origin (CORS).',
          );
        }
        throw new RepositorySearchError(err.code, err.message, { status: err.status });
      }
      return toRepositorySearchResult(payload, { query: primary, endpoint: REPOSITORY_SEARCH_ENDPOINT });
    },
    fetchMetadata: unimplemented('github', 'Repository search', 'fetchMetadata'),
    fetchDocs: unimplemented('github', 'Repository search', 'fetchDocs'),
  };
}

export function createWebSearchProvider() {
  return {
    id: 'fishapi',
    live: false,
    search: unimplemented('fishapi', 'General web search', 'search'),
    fetchPage: unimplemented('fishapi', 'General web search', 'fetchPage'),
  };
}

export function createHackathonProvider() {
  return {
    id: 'hackathon',
    live: false,
    search: unimplemented('hackathon', 'Hackathon discovery', 'search'),
    verifyEvent: unimplemented('hackathon', 'Hackathon discovery', 'verifyEvent'),
  };
}

// The Assurance tracker distinguishes self-reported results from genuine CI
// output. Only this provider could ever produce the latter, and it is not
// connected: no run, status, webhook, or log is fabricated anywhere in the UI.
export function createCiResultsProvider() {
  return {
    id: 'ci',
    live: false,
    provenance: 'external-ci',
    listRuns: unimplemented('ci', 'CI results', 'listRuns'),
    fetchArtifacts: unimplemented('ci', 'CI results', 'fetchArtifacts'),
    subscribe: unimplemented('ci', 'CI results', 'subscribe'),
  };
}

/* ----------------------------------------------------------------------------
   Normalisation & dedupe
   Pure helpers that a real provider adapter should use. Keeping these here
   means the UI can consume a consistent model regardless of the source.
---------------------------------------------------------------------------- */

export function normalizeRepository(raw = {}) {
  return {
    id: raw.id ? String(raw.id) : '',
    source: 'github',
    name: raw.name || '',
    owner: raw.owner?.login || raw.owner || '',
    description: raw.description || '',
    url: raw.html_url || raw.url || '',
    language: raw.language || 'Unknown',
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    stars: Number.isFinite(raw.stargazers_count) ? raw.stargazers_count : null,
    forks: Number.isFinite(raw.forks_count) ? raw.forks_count : null,
    lastUpdated: raw.updated_at || '',
    licence: raw.license?.spdx_id || 'Unknown',
    docs: raw.has_wiki === true ? 'Wiki present' : 'Unknown',
    retrieval: 'live',
    checkedAt: new Date().toISOString(),
    limitations: 'Public metadata only. Documented capabilities require reading the actual documentation.',
  };
}

export function dedupeResults(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.source || ''}:${item.url || item.name || ''}`.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rankByRelevance(items = [], terms = []) {
  const needles = terms.map((t) => String(t).toLowerCase()).filter((t) => t.length > 3);
  return [...items]
    .map((item) => {
      const hay = `${item.name || ''} ${item.description || ''} ${(item.topics || []).join(' ')}`.toLowerCase();
      const hits = needles.filter((n) => hay.includes(n)).length;
      return { ...item, heuristicRelevance: hits };
    })
    .sort((a, b) => b.heuristicRelevance - a.heuristicRelevance);
}

// Report data preparation lives in src/lib/report.js because it is pure and
// shared with the PDF renderer. Evidence storage remains local until a backend
// is introduced; if one is added, scope records by authenticated user ID.
