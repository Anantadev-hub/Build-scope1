import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Radar, GitBranch, FileText, Database, Plug, Package, Trophy, CheckSquare, Square, AlertTriangle, Copy, Trash2, Edit3, ArrowRight, Layers, Info, RefreshCw, } from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  MissingCase, Btn, Card, DemoBanner, EmptyState, Field, Modal, Notice, PageHead, SegTabs, StatusBadge } from '../../components/ui';
import { repositoryFinding, existingSolution, evidenceRecord, feature } from '../../lib/models';
import { EVIDENCE_STATUS, OVERLAP, VERIFICATION_OPTIONS, SOURCE_KINDS } from '../../lib/constants';
import { COMPARISON_LEVELS, COMPARISON_DIMENSIONS } from '../../lib/report';
import { createRepositorySearchProvider, dedupeResults } from '../../services/providers';
import { configIssues } from '../../config';
import { fmtDate, hostOf, safeHref } from '../../lib/format';

const KIND_ICON = { product: Package, paper: FileText, dataset: Database, api: Plug, hackathon: Trophy };

const LIVE_TONE = { idle: 'outline', loading: 'amber', success: 'green', empty: 'outline', error: 'red', 'not-configured': 'orange' };
const LIVE_LABEL = {
  idle: 'READY — NOT RUN',
  loading: 'SEARCHING…',
  success: 'LIVE RESULTS',
  empty: 'LIVE — NO MATCHES',
  error: 'SEARCH FAILED',
  'not-configured': 'NOT CONFIGURED',
};

// Identity of a repository record across sources: its URL, or owner/name.
const repoKey = (r) => String(r.url || `${r.owner || ''}/${r.name || ''}`).trim().toLowerCase();

// Environment problems are static for the life of the page, so they are
// computed once and shown next to the provider status.
const CONFIG_ISSUES = configIssues();

const emptyLive = (configured) => ({
  status: configured ? 'idle' : 'not-configured',
  query: '', found: 0, added: 0, skipped: 0, at: '', source: '', code: '', message: '', warnings: [],
});

function relevance(repo, p) {
  const hay = [repo.name, repo.owner, repo.description, ...(repo.topics || []), ...(repo.relevantFeatures || []), repo.matchReason, repo.possibleDifferences]
    .join(' ').toLowerCase();
  const terms = [
    ...p.features.map((f) => f.name),
    ...p.targetUsers,
    ...p.stack,
    ...String(p.problem).split(/\W+/).filter((w) => w.length > 4),
    ...String(p.solution).split(/\W+/).filter((w) => w.length > 4),
  ].map((t) => t.toLowerCase().trim()).filter(Boolean);
  const seen = new Set();
  let hits = 0;
  terms.forEach((t) => { if (t.length > 3 && !seen.has(t) && hay.includes(t)) { hits += 1; seen.add(t); } });
  return Math.max(28, Math.min(96, 30 + hits * 9));
}

function overlapMeta(key) {
  return OVERLAP[key] || { label: 'Not assessed', cls: 'outline', level: 0 };
}

/* ------------------------------------------------------------------ */
/* Evidence form                                                       */
/* ------------------------------------------------------------------ */
function EvidenceForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    title: initial?.title || '',
    sourceName: initial?.sourceName || '',
    url: initial?.url || '',
    kind: initial?.kind || 'repository',
    claim: initial?.claim || '',
    checkedAt: initial?.checkedAt || '',
    verification: initial?.verification || 'unverified',
    notes: initial?.notes || '',
    demo: Boolean(initial?.demo),
  });
  const [err, setErr] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.sourceName.trim() || !f.claim.trim()) { setErr('A source name and the claim it supports are required. An evidence record without a claim is just a bookmark.'); return; }
        if (f.verification === 'verified' && !f.checkedAt) { setErr('A record marked verified needs the date you checked the source.'); return; }
        onSave(f);
      }}
    >
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <div className="form-grid">
        <Field label="Source name" required htmlFor="ev-source">
          <input id="ev-source" type="text" value={f.sourceName} onChange={(e) => set({ sourceName: e.target.value })} placeholder="e.g. GitHub Docs — Search API" />
        </Field>
        <Field label="Source category" htmlFor="ev-kind">
          <select id="ev-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
            {Object.entries(SOURCE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            <option value="team-note">Team note / internal</option>
          </select>
        </Field>
        <div className="span2">
          <Field label="Source URL" hint="Leave blank if the source has no public URL. Never invent a link." htmlFor="ev-url">
            <input id="ev-url" type="url" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
          </Field>
        </div>
        <div className="span2">
          <Field label="What claim does this source support?" required htmlFor="ev-claim">
            <textarea id="ev-claim" rows={2} value={f.claim} onChange={(e) => set({ claim: e.target.value })} placeholder="State the specific claim, not the topic." />
          </Field>
        </div>
        <Field label="Date checked" hint="Required when marking verified." htmlFor="ev-date">
          <input id="ev-date" type="date" value={f.checkedAt ? f.checkedAt.slice(0, 10) : ''} onChange={(e) => set({ checkedAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
        </Field>
        <Field label="Verification status" htmlFor="ev-ver">
          <select id="ev-ver" value={f.verification} onChange={(e) => set({ verification: e.target.value })} disabled={f.demo}>
            {f.demo ? <option value="demo">Demo record — not evidence</option> : VERIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <div className="span2">
          <Field label="Notes and limitations" htmlFor="ev-notes">
            <textarea id="ev-notes" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="What this source cannot tell you. Missing fields. Conflicting information." />
          </Field>
        </div>
      </div>
      {f.demo && <div className="mt12"><Notice tone="warn">This record comes from a demo fixture. It will be stored as <b>demo</b> and will not count toward verification, passport checks, or source-verified achievements.</Notice></div>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={(e) => { e.preventDefault(); if (!f.sourceName.trim() || !f.claim.trim()) { setErr('A source name and the claim it supports are required.'); return; } if (f.verification === 'verified' && !f.checkedAt) { setErr('A verified record needs the date checked.'); return; } onSave(f); }}>Save evidence</Btn>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Lead form                                                          */
/* ------------------------------------------------------------------ */
function LeadForm({ kind, onSave, onCancel }) {
  const [f, setF] = useState({
    name: '', owner: '', platform: '', url: '', description: '', language: '',
    topics: '', licence: '', lastUpdated: '', docs: '', relevantFeatures: '',
    matchReason: '', overlap: '', possibleDifferences: '', limitations: '', kind: 'product',
  });
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const isRepo = kind === 'repository';
  const [err, setErr] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) { setErr('A name is required.'); return; }
    onSave({
      ...f,
      topics: f.topics.split(',').map((s) => s.trim()).filter(Boolean),
      relevantFeatures: f.relevantFeatures.split(',').map((s) => s.trim()).filter(Boolean),
      url: f.url.trim(),
      stars: null,
      forks: null,
    });
  };

  return (
    <form onSubmit={submit}>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <Notice>
        Manually entered lead. BuildScope did not search or retrieve this record; fields are only as reliable as what you enter.
      </Notice>
      <div className="form-grid mt12">
        <Field label={isRepo ? 'Repository name' : 'Solution name'} required htmlFor="lead-name">
          <input id="lead-name" type="text" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={isRepo ? 'e.g. material-trace' : 'e.g. CityLoop'} />
        </Field>
        <Field label={isRepo ? 'Owner / organisation' : 'Publisher / organisation'} htmlFor="lead-owner">
          <input id="lead-owner" type="text" value={f.owner} onChange={(e) => set({ owner: e.target.value })} />
        </Field>
        {!isRepo && (
          <Field label="Category" htmlFor="lead-kind">
            <select id="lead-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="product">Commercial product</option>
              <option value="paper">Research paper</option>
              <option value="dataset">Public dataset</option>
              <option value="api">API / developer tool</option>
              <option value="hackathon">Hackathon project</option>
            </select>
          </Field>
        )}
        <Field label="Direct URL" hint="Only if you have one." htmlFor="lead-url">
          <input id="lead-url" type="url" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
        </Field>
        <div className="span2">
          <Field label="Short description" htmlFor="lead-desc">
            <textarea id="lead-desc" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </div>
        <div className="span2">
          <Field label="Relevant features (comma separated)" htmlFor="lead-features">
            <input id="lead-features" type="text" value={f.relevantFeatures} onChange={(e) => set({ relevantFeatures: e.target.value })} placeholder="Pickup requests, handoff records" />
          </Field>
        </div>
        <div className="span2">
          <Field label="Why it matches the proposed idea" htmlFor="lead-match">
            <textarea id="lead-match" rows={2} value={f.matchReason} onChange={(e) => set({ matchReason: e.target.value })} />
          </Field>
        </div>
        <Field label="Overlap assessment" htmlFor="lead-overlap">
          <select id="lead-overlap" value={f.overlap} onChange={(e) => set({ overlap: e.target.value })}>
            <option value="">Not assessed</option>
            {Object.entries(OVERLAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Licence" hint="Write Unknown if unchecked." htmlFor="lead-licence">
          <input id="lead-licence" type="text" value={f.licence} onChange={(e) => set({ licence: e.target.value })} placeholder="Unknown" />
        </Field>
        <div className="span2">
          <Field label="Possible differences / limitations" htmlFor="lead-diff">
            <textarea id="lead-diff" rows={2} value={f.possibleDifferences} onChange={(e) => set({ possibleDifferences: e.target.value })} />
          </Field>
        </div>
        <div className="span2">
          <Field label="Evidence limitations" hint="What you did not check." htmlFor="lead-limits">
            <input id="lead-limits" type="text" value={f.limitations} onChange={(e) => set({ limitations: e.target.value })} placeholder="Readme only; no hands-on test." />
          </Field>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={submit}>Save lead</Btn>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */
export default function PriorArtLab() {
  const project = useRouteProject();
  const { actions, state, pushToast } = useApp();
  usePageTitle('Prior Art Lab');

  const [tab, setTab] = useState('repositories');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ language: '', overlap: '', licence: '', updated: '', platform: '' });
  const [sort, setSort] = useState('relevance');
  const [modal, setModal] = useState(null);
  const [claimFeature, setClaimFeature] = useState(null);

  const p = project;
  const repos = p?.repositories || [];
  const solutions = p?.solutions || [];
  const selected = p?.comparison?.selectedIds || [];
  const allAlternatives = [...repos, ...solutions];

  const plan = useMemo(() => {
    if (!p) return [];
    return [
      p.name,
      p.features[0]?.name ? `${p.features[0].name} ${p.targetUsers[0] || ''}` : null,
      p.targetUsers[0] ? `${p.targetUsers[0]} ${p.features[0]?.name || 'platform'}` : null,
      `${p.features.slice(0, 2).map((f) => f.name).join(' ')} github`.trim(),
      `${p.stack.slice(0, 2).join(' ')} ${p.targetUsers[0] || 'app'}`.trim(),
      p.solution ? p.solution.split(/\s+/).slice(0, 7).join(' ') : null,
    ].map((q) => String(q || '').trim()).filter(Boolean);
  }, [p]);

  const provider = useMemo(() => createRepositorySearchProvider(), []);
  const [liveQuery, setLiveQuery] = useState('');
  const [live, setLive] = useState(() => emptyLive(provider.isConfigured));
  const abortRef = useRef(null);
  const autoRan = useRef(new Set());
  const shownProject = useRef(p?.id || null);

  // The status belongs to the case on screen: switching cases resets it rather
  // than leaving another case's result count visible.
  useEffect(() => {
    const id = p?.id || null;
    if (shownProject.current === id) return;
    shownProject.current = id;
    abortRef.current?.abort();
    setLive(emptyLive(provider.isConfigured));
  }, [p?.id, provider.isConfigured]);

  // No unmount abort here: React 18 StrictMode mounts twice in development, and
  // aborting on that first cleanup would cancel the only request while the
  // auto-run guard correctly refuses to start a second one. Superseded searches
  // are still cancelled in runSearch, and the client times out on its own.
  useEffect(() => { setLiveQuery((current) => current || plan[0] || ''); }, [plan]);

  const runSearch = useCallback(async (rawQuery) => {
    if (!p) return;
    const query = String(rawQuery ?? liveQuery ?? '').trim() || plan[0] || p.name || '';
    if (!query) {
      setLive({ status: 'error', query: '', found: 0, added: 0, skipped: 0, at: '', source: '', code: 'empty-query', message: 'Enter a search query first — BuildScope does not send blank requests.', warnings: [] });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLive({ status: 'loading', query, found: 0, added: 0, skipped: 0, at: '', source: '', code: '', message: '', warnings: [] });
    try {
      const out = await provider.search({
        query,
        queries: plan.filter((q) => q !== query),
        investigation: {
          name: p.name,
          problem: p.problem,
          solution: p.solution,
          desiredOutcome: p.desiredOutcome,
          targetUsers: p.targetUsers,
          features: p.features.map((f) => f.name).filter(Boolean),
          stack: p.stack,
        },
        limit: 20,
        signal: controller.signal,
      });
      const seen = new Set(repos.map(repoKey));
      const fresh = dedupeResults(out.results).filter((r) => {
        const key = repoKey(r);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (fresh.length) {
        actions.addItems('repositories', fresh, `Live repository search for “${query}” added ${fresh.length} record(s) from ${out.source}.`);
      }
      setLive({
        status: fresh.length ? 'success' : 'empty',
        query, at: out.retrievedAt, found: out.results.length, added: fresh.length,
        skipped: out.skipped, source: out.source, warnings: out.warnings, code: '', message: '',
      });
      pushToast(fresh.length
        ? `Live search added ${fresh.length} repository record(s).`
        : 'Live search finished: no public repositories matched. That is not proof of originality.');
    } catch (err) {
      if (err?.code === 'aborted') return;
      // The failure is reported as-is. Saved records stay; no fixture is substituted.
      setLive({ status: 'error', query, found: 0, added: 0, skipped: 0, at: '', source: '', code: err?.code || 'unknown', message: err?.message || 'The live search failed.', warnings: [] });
    }
  }, [actions, liveQuery, p, plan, provider, pushToast, repos]);

  // Discovery starts by itself the first time a case without repository
  // records is opened (that is the normal state of a new investigation).
  useEffect(() => {
    if (!p || !provider.isConfigured) return;
    if (p.repositories.length > 0) return;
    if (autoRan.current.has(p.id)) return;
    autoRan.current.add(p.id);
    runSearch(plan[0] || p.name);
  }, [p, plan, provider.isConfigured, runSearch]);

  const scored = useMemo(() => repos.map((r) => ({ ...r, score: relevance(r, p || { features: [], targetUsers: [], stack: [], problem: '', solution: '' }) })), [repos, p]);
  const languages = [...new Set(repos.map((r) => r.language || 'Unknown'))];
  const platforms = [...new Set(repos.map((r) => r.platform || 'Unknown'))];

  const filtered = useMemo(() => {
    let out = scored;
    const term = q.trim().toLowerCase();
    if (term) out = out.filter((r) => `${r.name} ${r.owner} ${r.description} ${(r.topics || []).join(' ')} ${(r.relevantFeatures || []).join(' ')}`.toLowerCase().includes(term));
    if (filters.language) out = out.filter((r) => (r.language || 'Unknown') === filters.language);
    if (filters.overlap) out = out.filter((r) => r.overlap === filters.overlap);
    if (filters.platform) out = out.filter((r) => (r.platform || 'Unknown') === filters.platform);
    if (filters.licence === 'known') out = out.filter((r) => r.licence && r.licence !== 'Unknown');
    if (filters.licence === 'unknown') out = out.filter((r) => !r.licence || r.licence === 'Unknown');
    if (filters.updated === 'recent') {
      out = out.filter((r) => r.lastUpdated && (Date.now() - new Date(r.lastUpdated).getTime()) < 1000 * 60 * 60 * 24 * 180);
    }
    const sorted = [...out];
    if (sort === 'relevance') sorted.sort((a, b) => b.score - a.score);
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'updated') sorted.sort((a, b) => String(b.lastUpdated).localeCompare(String(a.lastUpdated)));
    if (sort === 'stars') sorted.sort((a, b) => (b.stars || -1) - (a.stars || -1));
    return sorted;
  }, [scored, q, filters, sort]);

  const solutionFiltered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return solutions.filter((s) => !term || `${s.name} ${s.description} ${s.matchReason}`.toLowerCase().includes(term));
  }, [solutions, q]);

  if (!p) return <MissingCase />;

  const comparison = p.comparison || { selectedIds: [], notes: {}, cells: {} };
  const updateComparison = (patch) => actions.updateProject(p.id, { comparison: { ...comparison, ...patch } });

  const toggleSelected = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    updateComparison({ selectedIds: next });
  };

  const setCell = (key, value) => {
    updateComparison({ cells: { ...(comparison.cells || {}), [key]: value } });
  };

  const liveRecords = repos.filter((r) => r.retrieval === 'live');
  const demoRecords = repos.filter((r) => r.demo);
  const lastLiveAt = liveRecords.map((r) => r.checkedAt).filter(Boolean).sort().pop() || '';
  const liveStatusText = {
    idle: 'Ready. The configured service has not been queried for this case yet.',
    loading: `Searching the configured service for “${live.query}”…`,
    success: `Live: ${live.found} result(s) returned, ${live.added} new record(s) saved${live.skipped ? `, ${live.skipped} unusable item(s) skipped` : ''}${live.at ? ` · ${fmtDate(live.at)}` : ''}.`,
    empty: `Live search for “${live.query}” returned no public repositories. An empty result is not proof of originality.`,
    error: `The last live search for “${live.query || '—'}” failed. Previously saved records are unchanged.`,
    'not-configured': 'No endpoint is configured, so no request was made.',
  }[live.status];

  const copyQuery = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast('Search query copied. BuildScope has not run it.');
    } catch {
      pushToast('Could not access the clipboard. Select and copy the query manually.');
    }
  };

  const saveEvidence = (record) => {
    const ev = evidenceRecord({
      ...record,
      demo: Boolean(record.demo),
      verification: record.demo ? 'demo' : record.verification,
      seeded: false,
    });
    actions.addItem('evidence', ev, `Evidence recorded: ${ev.sourceName}.`);
    pushToast(record.demo ? 'Demo record saved to the evidence register (not verification).' : 'Evidence saved to the register.');
    setModal(null);
  };

  const saveRepo = (data) => {
    const repo = repositoryFinding({
      ...data,
      retrieval: 'manual',
      demo: false,
      checkedAt: '',
    });
    actions.addItem('repositories', repo, `Existing solution lead added: ${repo.name}.`);
    pushToast('Lead saved. Metadata is only what you entered.');
    setModal(null);
  };

  const saveSolution = (data) => {
    const sol = existingSolution({ ...data, retrieval: 'manual', demo: false });
    actions.addItem('solutions', sol, `Existing solution added: ${sol.name}.`);
    pushToast('Existing solution saved.');
    setModal(null);
  };

  const confirmComparison = () => {
    if (selected.length === 0) return;
    updateComparison({ confirmedAt: new Date().toISOString() });
    actions.log(`Comparison confirmed against ${selected.length} alternative(s).`, 'comparison');
    pushToast('Comparison confirmed. Differentiation claims can now reference it.');
  };

  return (
    <div>
      <PageHead
        eyebrow="03 · Reconnaissance"
        title="Prior Art Lab"
        description="Find out what already exists before investing the build window. Public repositories cannot reveal every private, commercial, unpublished, or undiscovered project — an empty search is not proof of originality."
        actions={<>
          <Btn variant="ghost" onClick={() => setModal({ type: 'solution' })}><Plus size={14} /> Add solution</Btn>
          <Btn variant="primary" onClick={() => setModal({ type: 'repo' })}><Plus size={14} /> Add repository lead</Btn>
        </>}
      />

      {demoRecords.length > 0 && (
        <DemoBanner>
          {demoRecords.length} of the {repos.length} repository record(s) below are demo fixtures attached to the seeded demo
          case — not live search results. Stars, licences, dates, and links are unknown where no verified value exists.
        </DemoBanner>
      )}

      {liveRecords.length > 0 && (
        <Notice tone="ok">
          <b>{liveRecords.length} live record(s)</b> retrieved from the configured repository service
          {lastLiveAt ? ` · last retrieval ${fmtDate(lastLiveAt)}` : ''}. Public metadata only — documented capability still
          requires reading the source.
        </Notice>
      )}

      <div className="grid g-2-1 mb16" style={{ alignItems: 'stretch' }}>
        <Card title="Repository search" eyebrow={provider.isConfigured ? 'Configured service' : 'No service configured'} className="mb0">
          <div className="spread small">
            <span className="muted">Live search status</span>
            <TagBadge tone={LIVE_TONE[live.status]}>{LIVE_LABEL[live.status]}</TagBadge>
          </div>
          <div className="xs muted mt8" role="status" aria-live="polite">{liveStatusText}</div>

          {provider.isConfigured ? (
            <>
              <div className="row nowrap mt12" style={{ gap: 8 }}>
                <input
                  type="search"
                  value={liveQuery}
                  onChange={(e) => setLiveQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(liveQuery); } }}
                  placeholder="Query sent to the repository service…"
                  aria-label="Repository search query"
                  disabled={live.status === 'loading'}
                />
                <Btn variant="primary" size="sm" onClick={() => runSearch(liveQuery)} disabled={live.status === 'loading'}>
                  {live.status === 'loading' ? 'Searching…' : live.status === 'error' ? <><RefreshCw size={12} /> Retry</> : <><Search size={12} /> Search</>}
                </Btn>
              </div>
              {live.status === 'error' && (
                <div className="mt12">
                  <Notice tone="danger">{live.message}</Notice>
                  <div className="row mt8" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="xs muted">Saved records below are unchanged. No demo data was substituted for the failed request.</span>
                    <Btn variant="ghost" size="sm" onClick={() => runSearch(live.query || liveQuery)}><RefreshCw size={12} /> Retry search</Btn>
                  </div>
                </div>
              )}
              {live.warnings.length > 0 && <div className="mt8"><Notice tone="warn">{live.warnings.join(' ')}</Notice></div>}
            </>
          ) : (
            <div className="mt12">
              <Notice tone="warn">
                <b>Live search is not connected in this build.</b> No request was made, and no fixture is displayed in its place.
                Set <code>VITE_REPOSITORY_SEARCH_URL</code> to the backend route that implements <code>POST /api/search/repositories</code>.
              </Notice>
              <p className="xs muted mb0 mt8">
                Request and response shapes are documented in <code>src/services/providers.js</code> (search for
                <code> REPOSITORY_SEARCH_CONTRACT</code>) and in the README.
              </p>
            </div>
          )}

          <div className="line" />
          <div className="eyebrow plain">Derived search plan</div>
          <div className="stack-sm mt8">
            {plan.map((query, i) => (
              <div key={`${query}-${i}`} className="row nowrap" style={{ gap: 8 }}>
                <span className="mono xs muted" style={{ width: 18 }}>{String(i + 1).padStart(2, '0')}</span>
                <code style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '5px 8px', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{query}</code>
                <Btn variant="quiet" size="xs" onClick={() => copyQuery(query)} aria-label={`Copy query: ${query}`}><Copy size={12} /></Btn>
              </div>
            ))}
          </div>
          <div className="xs muted mt8">
            Queries are generated from saved fields. Copying one does not run it; only the search control above sends a request.
          </div>
        </Card>

        <Card title="Provider readiness" eyebrow="Configured services" className="mb0">
          <div className="stack-sm">
            <div className="spread small"><span className="muted">Repository search</span><TagBadge tone={provider.isConfigured ? 'green' : 'orange'}>{provider.isConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'}</TagBadge></div>
            <div className="spread small"><span className="muted">Web / product search</span><TagBadge tone="orange">NOT CONNECTED</TagBadge></div>
            <div className="spread small"><span className="muted">Paper & dataset search</span><TagBadge tone="orange">NOT CONNECTED</TagBadge></div>
            <div className="spread small"><span className="muted">Official source check</span><TagBadge tone="orange">NOT CONNECTED</TagBadge></div>
          </div>
          <div className="line" />
          {provider.isConfigured ? (
            <p className="xs muted mb0">
              Endpoint host: <code>{hostOf(provider.endpoint)}</code>. The request carries the query and the
              investigation summary; tokens stay on the server.
            </p>
          ) : (
            <p className="xs muted mb0">
              Repository search needs <code>{provider.configKey}</code> in the build environment. Secret-bearing requests must
              run through the backend; no credentials belong in this client bundle.
            </p>
          )}
          {CONFIG_ISSUES.length > 0 && (
            <div className="mt8">
              <Notice tone="warn">
                <b>Configuration problem.</b>
                <ul className="xs" style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                  {CONFIG_ISSUES.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </Notice>
            </div>
          )}
          <details className="mt12">
            <summary className="mono xs" style={{ cursor: 'pointer', color: 'var(--ink-2)' }}>WHAT A LIVE SEARCH DOES</summary>
            <ol className="xs muted" style={{ marginTop: 8, paddingLeft: 16 }}>
              <li>Extract problem, users, features, stack, and expected outcome.</li>
              <li>Generate alternative-phrased and technical queries.</li>
              <li>Send the primary query to the configured backend route.</li>
              <li>Deduplicate returned records against those already saved for this case.</li>
              <li>Record the retrieval timestamp and its limitations with each record.</li>
            </ol>
          </details>
        </Card>
      </div>

      <SegTabs
        value={tab}
        onChange={setTab}
        label="Prior art views"
        options={[
          { value: 'repositories', label: 'Repositories', count: repos.length },
          { value: 'solutions', label: 'Other solutions', count: solutions.length },
          { value: 'comparison', label: 'Comparison', count: selected.length },
          { value: 'evidence', label: 'Evidence register', count: p.evidence.length },
        ]}
      />

      {tab === 'repositories' && (
        <>
          <div className="toolbar">
            <div className="search">
              <Search size={14} aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, owner, topic, or feature…" aria-label="Filter repositories" />
            </div>
            <select value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })} aria-label="Filter by language">
              <option value="">All languages</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={filters.overlap} onChange={(e) => setFilters({ ...filters, overlap: e.target.value })} aria-label="Filter by overlap">
              <option value="">Any overlap</option>
              {Object.entries(OVERLAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filters.licence} onChange={(e) => setFilters({ ...filters, licence: e.target.value })} aria-label="Filter by licence availability">
              <option value="">Any licence state</option>
              <option value="known">Licence recorded</option>
              <option value="unknown">Licence unknown</option>
            </select>
            <select value={filters.updated} onChange={(e) => setFilters({ ...filters, updated: e.target.value })} aria-label="Filter by last updated">
              <option value="">Any date</option>
              <option value="recent">Updated in last 180 days</option>
            </select>
            <select value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })} aria-label="Filter by platform">
              <option value="">All platforms</option>
              {platforms.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
            </select>
            <div className="divider" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort results">
              <option value="relevance">Sort: heuristic relevance</option>
              <option value="name">Sort: name</option>
              <option value="updated">Sort: last updated</option>
              <option value="stars">Sort: stars</option>
            </select>
            {(q || Object.values(filters).some(Boolean)) && (
              <Btn variant="quiet" size="sm" onClick={() => { setQ(''); setFilters({ language: '', overlap: '', licence: '', updated: '', platform: '' }); }}>Clear</Btn>
            )}
          </div>

          <div className="spread mb16">
            <span className="mono xs muted">{filtered.length} of {repos.length} RECORDS · {liveRecords.length} LIVE / {demoRecords.length} DEMO · HEURISTIC RELEVANCE IS COMPUTED LOCALLY, NOT A LIVE RANKING</span>
            {selected.length > 0 && (
              <span className="row" style={{ gap: 6 }}>
                <span className="mono xs">{selected.length} selected</span>
                <Btn variant="ghost" size="xs" onClick={() => updateComparison({ selectedIds: [] })}>Clear selection</Btn>
                <Btn variant="ghost" size="xs" onClick={() => setTab('comparison')}>Compare <ArrowRight size={11} /></Btn>
              </span>
            )}
          </div>

          {repos.length === 0 ? (
            <div className="card"><EmptyState icon={Radar} title="No repository leads recorded" action={<Btn variant="primary" onClick={() => setModal({ type: 'repo' })}><Plus size={14} /> Add the first lead</Btn>}>
              {provider.isConfigured
                ? 'The configured service has not returned a usable record for this case yet. Run a search above, or add a lead manually with the claim it supports.'
                : 'Live search is not configured in this build. Use the derived queries to search manually, then save what you find with the claim it supports.'}
            </EmptyState></div>
          ) : filtered.length === 0 ? (
            <div className="card"><EmptyState icon={Search} title="No records match these filters" action={<Btn variant="ghost" onClick={() => { setQ(''); setFilters({ language: '', overlap: '', licence: '', updated: '', platform: '' }); }}>Clear filters</Btn>}>
              Filters are applied together. Clearing them will not delete any saved records.
            </EmptyState></div>
          ) : (
            <div className="grid g2">
              {filtered.map((r) => {
                const isSel = selected.includes(r.id);
                const ov = overlapMeta(r.overlap);
                return (
                  <article key={r.id} className={`card repo-card selectable ${isSel ? 'sel' : ''}`}>
                    <div className="repo-top">
                      <div style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 7 }}>
                          <span className="repo-owner">{r.owner || 'Unknown owner'} /</span>
                          {r.demo && <span className="badge demo">DEMO</span>}
                          {r.retrieval === 'live' && <span className="badge green">LIVE</span>}
                          {isSel && <span className="badge dark">SELECTED</span>}
                        </div>
                        <div className="repo-title">{r.name}</div>
                      </div>
                      <button
                        type="button"
                        className="btn quiet sm"
                        onClick={() => toggleSelected(r.id)}
                        aria-pressed={isSel}
                        aria-label={`${isSel ? 'Remove' : 'Add'} ${r.name} to comparison`}
                      >
                        {isSel ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </div>

                    <p className="repo-desc">{r.description || 'No description recorded.'}</p>

                    <div className="repo-meta">
                      <span><GitBranch size={11} /> {r.language || 'Language unknown'}</span>
                      <span>Stars {r.stars ?? 'unknown'}</span>
                      <span>Forks {r.forks ?? 'unknown'}</span>
                      <span>Updated {r.lastUpdated ? fmtDate(r.lastUpdated) : 'unknown'}</span>
                      <span>Licence {r.licence || 'Unknown'}</span>
                      <span>Docs {r.docs || 'Unknown'}</span>
                    </div>

                    {(r.topics || []).length > 0 && <div className="chip-row">{r.topics.map((t) => <span key={t} className="tag">{t}</span>)}</div>}

                    <div className="match-bar">
                      <span>HEURISTIC MATCH</span>
                      <i style={{ width: `${r.score}%`, maxWidth: 90, minWidth: 8 }} />
                      <span>{r.score}%</span>
                      <span style={{ marginLeft: 'auto' }}><StatusBadge meta={ov} /></span>
                    </div>

                    {r.matchReason && <div className="evidence-strip"><div className="mono xs muted">WHY IT MATCHES</div><div className="xs">{r.matchReason}</div></div>}
                    {r.possibleDifferences && <div className="xs"><span className="mono muted">POSSIBLE DIFFERENCES: </span>{r.possibleDifferences}</div>}
                    {r.limitations && <div className="xs muted"><AlertTriangle size={11} style={{ verticalAlign: -1 }} /> {r.limitations}</div>}

                    <div className="column-gap row between" style={{ marginTop: 'auto', paddingTop: 4 }}>
                      <div className="source-line">
                        {safeHref(r.url) ? <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">{hostOf(r.url)}</a> : <span>No live link — {r.demo ? 'demo record' : 'not provided'}</span>}
                      </div>
                      <div className="row" style={{ gap: 4 }}>
                        <Btn variant="ghost" size="xs" onClick={() => setModal({ type: 'evidence', prefill: { sourceName: `${r.owner ? `${r.owner}/` : ''}${r.name}`, title: r.name, url: r.url, kind: 'repository', demo: r.demo, notes: r.limitations } })}>Save evidence</Btn>
                        {r.demo && <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'editRepo', repo: r })} aria-label={`View demo record limitations for ${r.name}`}><Info size={12} /></Btn>}
                        <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('repositories', r.id); updateComparison({ selectedIds: selected.filter((x) => x !== r.id) }); }} aria-label={`Remove ${r.name}`}><Trash2 size={12} /></Btn>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt16">
            <Notice>
              <b>Not found is not the same as does not exist.</b> A repository search covers public code only. Commercial products,
              private repos, internal tools, unpublished research, and undiscovered work are invisible to it.
            </Notice>
          </div>
        </>
      )}

      {tab === 'solutions' && (
        <>
          <div className="demo-banner" role="note">
            <AlertTriangle size={15} aria-hidden="true" />
            <div><b>DEMO DATA — NOT LIVE VERIFIED</b> — solution records are illustrative. Product pages, pricing, licence terms, and paper metadata have not been checked.</div>
          </div>
          {solutions.length === 0 ? (
            <div className="card"><EmptyState icon={Layers} title="No broader solution research yet" action={<Btn variant="primary" onClick={() => setModal({ type: 'solution' })}><Plus size={14} /> Add a solution</Btn>}>
              Products, papers, datasets, APIs, and past hackathon projects are different kinds of evidence. Record them with their own source fields rather than treating them as repositories.
            </EmptyState></div>
          ) : (
            <div className="grid g2">
              {solutionFiltered.map((s) => {
                const Icon = KIND_ICON[s.kind] || Package;
                const isSel = selected.includes(s.id);
                return (
                  <article key={s.id} className={`card repo-card selectable ${isSel ? 'sel' : ''}`}>
                    <div className="repo-top">
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="badge outline"><Icon size={10} style={{ marginRight: 2 }} />{SOURCE_KINDS[s.kind]?.label || s.kind}</span>
                          {s.demo && <span className="badge demo">DEMO</span>}
                          {isSel && <span className="badge dark">SELECTED</span>}
                        </div>
                        <div className="repo-title" style={{ marginTop: 4 }}>{s.name}</div>
                        <div className="repo-owner">{s.platform || 'Source not recorded'}{s.checkedAt ? ` · checked ${fmtDate(s.checkedAt)}` : ' · not checked'}</div>
                      </div>
                      <button type="button" className="btn quiet sm" onClick={() => toggleSelected(s.id)} aria-pressed={isSel} aria-label={`${isSel ? 'Remove' : 'Add'} ${s.name} to comparison`}>
                        {isSel ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </div>
                    <p className="repo-desc">{s.description || 'No description recorded.'}</p>
                    {(s.features || []).length > 0 && <div className="chip-row">{s.features.map((f) => <span className="tag" key={f}>{f}</span>)}</div>}
                    <div className="row between"><span className="mono xs muted">OVERLAP</span><StatusBadge meta={overlapMeta(s.overlap)} /></div>
                    {s.matchReason && <div className="evidence-strip"><div className="mono xs muted">WHY IT MATCHES</div><div className="xs">{s.matchReason}</div></div>}
                    <div className="xs muted">{s.limitations || 'No evidence limitations recorded.'}</div>
                    <div className="row between" style={{ marginTop: 'auto', paddingTop: 4 }}>
                      <div className="source-line">{safeHref(s.url) ? <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{hostOf(s.url)}</a> : <span>No live link — {s.demo ? 'demo record' : 'not provided'}</span>}</div>
                      <div className="row" style={{ gap: 4 }}>
                        <Btn variant="ghost" size="xs" onClick={() => setModal({ type: 'evidence', prefill: { sourceName: s.name, title: s.name, url: s.url, kind: s.kind === 'product' ? 'product' : s.kind, demo: s.demo, notes: s.limitations } })}>Save evidence</Btn>
                        <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('solutions', s.id); updateComparison({ selectedIds: selected.filter((x) => x !== s.id) }); }} aria-label={`Remove ${s.name}`}><Trash2 size={12} /></Btn>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'comparison' && (
        <>
          <div className="card mb16">
            <div className="spread" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow">Comparison baseline</div>
                <h3 style={{ marginTop: 3 }}>{selected.length} alternative{selected.length === 1 ? '' : 's'} selected</h3>
                <p className="small muted mb0" style={{ maxWidth: '70ch' }}>
                  Compare documented capabilities, not assumptions. “Not found in reviewed material” means exactly that —
                  it does not mean the capability does not exist.
                </p>
              </div>
              <div className="row">
                <Btn variant="ghost" size="sm" onClick={() => setModal({ type: 'feature' })}><Plus size={13} /> Add proposed feature</Btn>
                <Btn variant="primary" size="sm" onClick={confirmComparison} disabled={selected.length === 0}>
                  {comparison.confirmedAt ? 'Re-confirm comparison' : 'Confirm comparison'}
                </Btn>
              </div>
            </div>
            {comparison.confirmedAt && (
              <div className="mt12"><Notice tone="ok">Comparison confirmed {fmtDate(comparison.confirmedAt)}. Re-confirm after material changes so the report reflects the current baseline.</Notice></div>
            )}

            <div className="line" />
            <div className="mono xs muted" style={{ marginBottom: 8, letterSpacing: '.08em' }}>SELECT ALTERNATIVES TO INCLUDE</div>
            <div className="chip-row">
              {allAlternatives.length === 0 && <span className="small muted">No alternatives saved yet. Add leads in the Repositories or Other solutions tabs.</span>}
              {allAlternatives.map((a) => (
                <label key={a.id} className="check" style={{ border: '1px solid var(--line)', padding: '4px 8px', borderRadius: 2, background: selected.includes(a.id) ? 'var(--sage)' : 'transparent' }}>
                  <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleSelected(a.id)} />
                  <span className="xs">{a.name} {a.demo && <span className="mono" style={{ color: '#8f4025' }}>DEMO</span>}</span>
                </label>
              ))}
            </div>
          </div>

          {selected.length === 0 ? (
            <div className="card"><EmptyState icon={Layers} title="Nothing selected to compare" action={<Btn variant="ghost" onClick={() => setTab('repositories')}>Browse repositories</Btn>}>
              Select at least one existing solution to build the feature matrix. Two or more alternatives make overlap patterns visible.
            </EmptyState></div>
          ) : (
            <>
              <div className="table-wrap mb16">
                <table className="table" style={{ minWidth: Math.max(680, 260 + selected.length * 180) }}>
                  <thead>
                    <tr>
                      <th style={{ width: 230 }}>Proposed feature / dimension</th>
                      {selected.map((id) => {
                        const alt = allAlternatives.find((a) => a.id === id);
                        return <th key={id}>{alt?.name || 'Unknown alternative'}<span className="sub" style={{ textTransform: 'none', letterSpacing: 0 }}>{alt?.demo ? 'DEMO record' : 'Your record'}</span></th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {p.features.map((f) => (
                      <tr key={f.id}>
                        <td><span className="cell-title">{f.name}</span>{f.essential && <span className="badge dark" style={{ marginLeft: 5 }}>ESSENTIAL</span>}</td>
                        {selected.map((sid) => {
                          const key = `${f.id}:${sid}`;
                          return (
                            <td key={sid}>
                              <select value={comparison.cells?.[key] || ''} onChange={(e) => setCell(key, e.target.value)} aria-label={`${f.name} in ${allAlternatives.find((a) => a.id === sid)?.name}`} style={{ fontSize: 11, padding: '4px 22px 4px 6px' }}>
                                <option value="">Not assessed</option>
                                {Object.entries(COMPARISON_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {COMPARISON_DIMENSIONS.slice(3, 10).map((dim) => (
                      <tr key={dim}>
                        <td><span className="cell-title">{dim}</span></td>
                        {selected.map((sid) => {
                          const key = `dim:${dim}:${sid}`;
                          return (
                            <td key={sid}>
                              <select value={comparison.cells?.[key] || ''} onChange={(e) => setCell(key, e.target.value)} aria-label={`${dim} for ${allAlternatives.find((a) => a.id === sid)?.name}`} style={{ fontSize: 11, padding: '4px 22px 4px 6px' }}>
                                <option value="">Not assessed</option>
                                {Object.entries(COMPARISON_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr>
                      <td><span className="cell-title">Your current reading</span></td>
                      {selected.map((sid) => {
                        const alt = allAlternatives.find((a) => a.id === sid);
                        return <td key={sid}><StatusBadge meta={overlapMeta(alt?.overlap)} /></td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid g2">
                {selected.map((sid) => {
                  const alt = allAlternatives.find((a) => a.id === sid);
                  if (!alt) return null;
                  return (
                    <Card key={sid} title={`Analyst notes — ${alt.name}`} eyebrow={alt.demo ? 'Demo record' : 'Your record'}>
                      <Field label="What the reviewed material does and does not show" htmlFor={`note-${sid}`}>
                        <textarea id={`note-${sid}`} rows={3} value={comparison.notes?.[sid] || ''} onChange={(e) => updateComparison({ notes: { ...(comparison.notes || {}), [sid]: e.target.value } })} placeholder="Documented capability, unclear area, and what you could not verify." />
                      </Field>
                      <div className="xs muted mt8">Saved automatically to this case. Notes appear in the Buildability Report.</div>
                    </Card>
                  );
                })}
              </div>

              <div className="mt16">
                <Notice tone="warn">
                  A matrix cell marked “Not found in reviewed material” records the limits of your review, not the absence of the feature.
                  Never present it as proof of novelty.
                </Notice>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'evidence' && (
        <>
          <div className="spread mb16" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="eyebrow">Evidence register</div>
              <p className="small muted mb0" style={{ maxWidth: '70ch' }}>
                Every record states the claim it supports, its source, when it was checked, and what it cannot tell you.
                Demo fixtures are stored separately from verified evidence.
              </p>
            </div>
            <Btn variant="primary" size="sm" onClick={() => setModal({ type: 'evidence' })}><Plus size={13} /> Record evidence</Btn>
          </div>

          {p.evidence.length === 0 ? (
            <div className="card"><EmptyState icon={FileText} title="No evidence recorded" action={<Btn variant="primary" onClick={() => setModal({ type: 'evidence' })}>Record the first source</Btn>}>
              Evidence is not a bookmarked link. Record the claim the source supports, when you checked it, and its limitations.
            </EmptyState></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Saved evidence records</caption>
                <thead>
                  <tr><th>Source</th><th>Claim supported</th><th style={{ width: 110 }}>Checked</th><th style={{ width: 150 }}>Status</th><th style={{ width: 80 }}><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {[...p.evidence].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span className="cell-title">{e.sourceName || e.title || 'Untitled source'}</span>
                        <span className="sub">
                          {SOURCE_KINDS[e.kind]?.label || e.kind}
                          {e.demo ? ' · demo fixture' : e.url ? ` · ${hostOf(e.url)}` : ' · no URL'}
                        </span>
                      </td>
                      <td>
                        <span className="small">{e.claim}</span>
                        {e.notes && <span className="sub">{e.notes}</span>}
                      </td>
                      <td><span className="mono xs muted">{e.checkedAt ? fmtDate(e.checkedAt) : 'Not checked'}</span></td>
                      <td><StatusBadge meta={EVIDENCE_STATUS[e.verification]} /></td>
                      <td>
                        <div className="row nowrap" style={{ gap: 2 }}>
                          <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'editEvidence', evidence: e })} aria-label={`Edit ${e.sourceName}`}><Edit3 size={12} /></Btn>
                          <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('evidence', e.id); pushToast('Evidence record removed. Linked claims now cite a missing source.'); }} aria-label={`Delete ${e.sourceName}`}><Trash2 size={12} /></Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt16">
            <Notice tone="warn">
              <b>Evidence quality gate.</b> Only records marked <i>verified</i> by your team count toward passport evidence checks and the
              Source Verified achievement. Demo fixtures never count.
            </Notice>
          </div>
        </>
      )}

      {modal?.type === 'evidence' && (
        <Modal open onClose={() => setModal(null)} title="Record evidence" eyebrow="Evidence register" wide>
          <EvidenceForm initial={modal.prefill} onCancel={() => setModal(null)} onSave={saveEvidence} />
        </Modal>
      )}

      {modal?.type === 'editEvidence' && (
        <Modal open onClose={() => setModal(null)} title="Edit evidence record" eyebrow="Evidence register" wide>
          <EvidenceForm
            initial={modal.evidence}
            onCancel={() => setModal(null)}
            onSave={(f) => {
              actions.updateItem('evidence', modal.evidence.id, { ...modal.evidence, ...f }, 'Evidence record updated.');
              pushToast('Evidence record updated.');
              setModal(null);
            }}
          />
        </Modal>
      )}

      {modal?.type === 'repo' && (
        <Modal open onClose={() => setModal(null)} title="Add repository lead" eyebrow="Manual entry" wide>
          <LeadForm kind="repository" onCancel={() => setModal(null)} onSave={saveRepo} />
        </Modal>
      )}

      {modal?.type === 'editRepo' && (
        <Modal open onClose={() => setModal(null)} title={`Demo record — ${modal.repo.name}`} eyebrow="Limitations">
          <p className="small">This is a simulated fixture used to demonstrate the workflow. BuildScope did not query GitHub, and no stars, licence, date, or URL were retrieved.</p>
          <p className="small muted">To make this a real lead, add a live source with its URL, then record evidence with the date you checked it.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>Close</Btn>
            <Btn variant="primary" onClick={() => { actions.removeItem('repositories', modal.repo.id); setModal(null); }}>Remove demo record</Btn>
          </div>
        </Modal>
      )}

      {modal?.type === 'solution' && (
        <Modal open onClose={() => setModal(null)} title="Add existing solution" eyebrow="Manual entry" wide>
          <LeadForm kind="solution" onCancel={() => setModal(null)} onSave={saveSolution} />
        </Modal>
      )}

      {modal?.type === 'feature' && (
        <Modal open onClose={() => setModal(null)} title="Add proposed feature" eyebrow="Comparison matrix">
          <FeatureQuickAdd onSave={(name, desc) => {
            actions.addItem('features', feature({ name, description: desc, essential: false }), `Proposed feature added: ${name}.`);
            pushToast('Feature added to the project brief.');
            setModal(null);
          }} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

function TagBadge({ children, tone = '' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function FeatureQuickAdd({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div>
      <Field label="Feature name" required htmlFor="qf-name"><input id="qf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Handoff confirmation" /></Field>
      <div className="mt12"><Field label="What it lets the user do" htmlFor="qf-desc"><input id="qf-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field></div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), desc.trim())}>Add feature</Btn>
      </div>
    </div>
  );
}
