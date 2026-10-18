// ============================================================================
// FUTURE SERVICE INTERFACES
//
// This build is frontend-only. Every provider below is deliberately
// unimplemented: calling it throws ProviderNotConfiguredError rather than
// returning fake "live" data. Demo fixtures live in src/data/demo.js and are
// labelled in the UI; they must never be routed through these interfaces as if
// they were live results.
//
// Production notes:
// - Secret-bearing calls (GitHub tokens, FishAPI keys, event APIs) belong in a
//   backend or server function, never in this client bundle.
// - The normalized models below are intentionally provider-agnostic so the UI
//   keeps working if GitHub search is replaced by FishAPI or another source.
// - When a live provider is added, results should carry retrieval timestamp,
//   source URL, metadata availability, and explicit limitations.
// ============================================================================

export const SOURCE_CAPABILITIES = {
  github: {
    label: 'GitHub REST API — repository search',
    supports: ['repositories', 'repository metadata', 'topics', 'licences', 'stars/forks'],
    limitations: ['public repositories only', 'rate limits', 'not a general web search'],
    configuration: ['GITHUB_TOKEN server-side'],
    status: 'not-connected',
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

export function createRepositorySearchProvider() {
  return {
    id: 'github',
    live: false,
    search: unimplemented('github', 'Repository search', 'search'),
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
