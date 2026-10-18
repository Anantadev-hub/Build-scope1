import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, Plus, Trash2, ClipboardCheck, Plug, Link2, Info, ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  Btn, Card, Confirm, EmptyState, Kpi, MissingCase, Modal, Notice, PageHead, SegTabs, StatusBadge,
} from '../../components/ui';
import { TEST_METHODS, TEST_RESULTS, TEST_PROVENANCE } from '../../lib/constants';
import { testRecord } from '../../lib/models';
import { assuranceSummary, ciContract, methodMeta, resultMeta } from '../../lib/assurance';
import { SOURCE_CAPABILITIES, createCiResultsProvider } from '../../services/providers';
import { fmtDate } from '../../lib/format';
import { nowIso } from '../../lib/id';

const EMPTY = {
  title: '', criterionId: '', requirementId: '', proofNodeId: '', method: 'manual', result: 'not-run',
  ranAt: '', ranBy: '', environment: '', expected: '', actual: '', steps: '', evidenceNote: '', evidenceUrl: '',
};

export default function Assurance() {
  const project = useRouteProject();
  const { actions, pushToast } = useApp();
  const navigate = useNavigate();
  usePageTitle('Assurance & testing');
  const [view, setView] = useState('log');
  const [editor, setEditor] = useState(null); // { record } | { draft }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filters, setFilters] = useState({ q: '', result: 'all', method: 'all', criterion: 'all', demo: true });

  const summary = useMemo(() => (project ? assuranceSummary(project) : null), [project]);
  const ci = useMemo(() => createCiResultsProvider(), []);

  if (!project) return <MissingCase />;

  const criteriaById = new Map(project.acceptance.map((a) => [a.id, a]));
  const requirementById = new Map(project.requirements.map((r) => [r.id, r]));

  const filtered = project.tests.filter((t) => {
    if (!filters.demo && (t.demo || t.seeded)) return false;
    if (filters.result !== 'all' && t.result !== filters.result) return false;
    if (filters.method !== 'all' && t.method !== filters.method) return false;
    if (filters.criterion !== 'all') {
      if (filters.criterion === 'none' && t.criterionId) return false;
      if (filters.criterion !== 'none' && t.criterionId !== filters.criterion) return false;
    }
    const q = filters.q.trim().toLowerCase();
    if (q) {
      const hay = [t.title, t.actual, t.expected, t.evidenceNote, criteriaById.get(t.criterionId)?.title, requirementById.get(t.requirementId)?.text]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const save = (draft, existing) => {
    const patch = { ...draft };
    if (existing) {
      actions.updateItem('tests', existing.id, patch, `Test result updated: ${patch.title}`);
      pushToast('Test record updated.');
    } else {
      const record = testRecord({ ...patch, ranAt: patch.ranAt || nowIso() });
      actions.addItem('tests', record, `Test recorded: ${record.title} — ${resultMeta(record.result).label}`);
      pushToast('Test result recorded by hand. Nothing was re-run for you.');
    }
    setEditor(null);
  };

  const startFor = (criterion) => setEditor({
    draft: { ...EMPTY, criterionId: criterion.id, title: `Verify: ${criterion.title}`, proofNodeId: (project.proofNodes.find((n) => n.kind === 'test') || {}).id || '' },
  });

  return (
    <>
      <PageHead
        eyebrow={`Mission 04 · Prove the demo · ${project.caseId}`}
        title="Assurance & testing"
        description="What was actually run, what happened, and what is still unproven. Every record here is entered by a person — there is no CI connection in this build."
        actions={(
          <div className="row wrap">
            <Btn variant="ghost" onClick={() => navigate(`/projects/${project.id}/proof`)}><Link2 size={14} aria-hidden="true" /> Traceability graph</Btn>
            <Btn variant="primary" onClick={() => setEditor({ draft: { ...EMPTY, ranAt: nowIso() } })}>
              <Plus size={14} aria-hidden="true" /> Record a test
            </Btn>
          </div>
        )}
      />

      <div className="mb16">
        <Notice tone="warn">
          <b>Manual records only.</b> BuildScope has no CI, webhook, or GitHub connection, so it cannot observe
          your pipeline and will never display a run, log, or badge it did not receive. “Passed” below means
          <i> a person ran this and it behaved as expected</i> — not that an external system confirmed it.
        </Notice>
      </div>

      <div className="g4 grid mb16">
        <Kpi label="Tests recorded" value={summary.counts.total} sub={`${summary.counts.real} non-demo · ${summary.counts.demo} demo fixtures`} />
        <Kpi label="Passing / failing" value={`${summary.counts.passed}/${summary.counts.failed}`} sub={`${summary.counts.partial} partly passed · ${summary.counts.blocked} could not run`} />
        <Kpi label="Criteria with a result" value={`${summary.touched}/${summary.criteriaTotal}`} sub={`${summary.proven} with a passing run`} />
        <Kpi label="External results" value="0" sub="No CI provider is connected" />
      </div>

      {summary.counts.withoutNote > 0 && (
        <div className="mb16">
          <Notice tone="danger">
            {summary.counts.withoutNote} record(s) claim an outcome with nothing recorded about what was actually
            observed. Add the observed behaviour — a result with no note is an assertion, not evidence.
          </Notice>
        </div>
      )}

      <div className="row between mb12 wrap">
        <SegTabs
          value={view}
          onChange={setView}
          label="Assurance view"
          options={[
            { value: 'log', label: 'Test log', count: project.tests.length },
            { value: 'coverage', label: 'Coverage by criterion', count: summary.criteriaTotal },
            { value: 'requirements', label: 'By requirement', count: project.requirements.length },
            { value: 'ci', label: 'External CI' },
          ]}
        />
      </div>

      {view === 'log' && (
        <>
          <Card className="mb16">
            <div className="g4 grid">
              <div className="field">
                <label htmlFor="f-q">Search</label>
                <input id="f-q" type="search" value={filters.q} placeholder="Title, observed behaviour, note…" onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="f-result">Result</label>
                <select id="f-result" value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })}>
                  <option value="all">All results</option>
                  {Object.entries(TEST_RESULTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-method">Method</label>
                <select id="f-method" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
                  <option value="all">All methods</option>
                  {TEST_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-criterion">Acceptance criterion</label>
                <select id="f-criterion" value={filters.criterion} onChange={(e) => setFilters({ ...filters, criterion: e.target.value })}>
                  <option value="all">All criteria</option>
                  <option value="none">Not linked to a criterion</option>
                  {project.acceptance.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
            </div>
            <label className="auth-check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={filters.demo} onChange={(e) => setFilters({ ...filters, demo: e.target.checked })} />
              <span>Include demo fixtures (they never count as proof in the Passport)</span>
            </label>
          </Card>

          {project.tests.length === 0 ? (
            <Card>
              <EmptyState
                icon={FlaskConical}
                title="No test has been recorded"
                action={<Btn variant="primary" onClick={() => setEditor({ draft: { ...EMPTY, ranAt: nowIso() } })}>Record the first test</Btn>}
              >
                A test record states what you expected, what actually happened, and how someone else could
                repeat it. Failed and blocked runs belong here too — they are evidence about the project.
              </EmptyState>
            </Card>
          ) : (
            <Card
              title="Test log"
              eyebrow={`${filtered.length} of ${project.tests.length} records`}
              flush
            >
              {filtered.length === 0 ? (
                <div style={{ padding: 16 }}>
                  <EmptyState icon={FlaskConical} title="No record matches those filters">
                    Clear the filters to see every recorded run.
                    <Btn variant="ghost" size="sm" onClick={() => setFilters({ q: '', result: 'all', method: 'all', criterion: 'all', demo: true })}>Clear filters</Btn>
                  </EmptyState>
                </div>
              ) : (
                <div className="scroll-x">
                  <table className="table">
                    <caption className="sr-only">Recorded tests with results and provenance</caption>
                    <thead>
                      <tr>
                        <th scope="col">Test</th>
                        <th scope="col">Criterion</th>
                        <th scope="col">Method</th>
                        <th scope="col">Result</th>
                        <th scope="col">Ran</th>
                        <th scope="col">Provenance</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <span className="cell-title">{t.title || 'Untitled test'}</span>
                            {t.demo || t.seeded ? <span className="badge demo" style={{ marginLeft: 6 }}>DEMO</span> : null}
                            {t.actual && <span className="sub">{t.actual}</span>}
                          </td>
                          <td className="small">{criteriaById.get(t.criterionId)?.title || <span className="muted">not linked</span>}</td>
                          <td className="small">{methodMeta(t.method).label}</td>
                          <td><StatusBadge meta={resultMeta(t.result)} /></td>
                          <td className="small muted">{t.ranAt ? fmtDate(t.ranAt) : 'not recorded'}</td>
                          <td><StatusBadge meta={TEST_PROVENANCE[t.provenance] || TEST_PROVENANCE['self-reported']} /></td>
                          <td>
                            <div className="row nowrap actions-cell" style={{ gap: 4 }}>
                              <Btn variant="quiet" size="xs" onClick={() => setEditor({ record: t })}>Edit</Btn>
                              <Btn variant="quiet" size="xs" onClick={() => setConfirmDelete(t)} aria-label={`Delete ${t.title || 'test'}`}><Trash2 size={12} aria-hidden="true" /></Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {view === 'coverage' && (
        <Card
          title="Coverage by acceptance criterion"
          eyebrow="Targets come from the Feasibility Lab scope tab"
          flush
        >
          {summary.criteriaTotal === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState
                icon={ClipboardCheck}
                title="No acceptance criteria defined yet"
                action={<Btn variant="primary" to={`/projects/${project.id}/feasibility?tab=scope`}>Define acceptance criteria</Btn>}
              >
                Testing has a target only once the demo has criteria. Add Given/When/Then statements first.
              </EmptyState>
            </div>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <caption className="sr-only">Acceptance criteria and their recorded test coverage</caption>
                <thead>
                  <tr>
                    <th scope="col">Criterion</th>
                    <th scope="col">Tests</th>
                    <th scope="col">Latest result</th>
                    <th scope="col">Reading</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.coverage.map(({ criterion, tests, latest, proven, failing }) => (
                    <tr key={criterion.id}>
                      <td>
                        <span className="cell-title">{criterion.title}</span>
                        <span className="sub">{criterion.kind === 'workflow' ? 'End-to-end workflow' : 'Capability'} · proof required: {criterion.proof || 'not stated'}</span>
                      </td>
                      <td className="num">{tests.length}</td>
                      <td>{latest ? <StatusBadge meta={resultMeta(latest.result)} /> : <span className="muted small">no run recorded</span>}</td>
                      <td className="small">
                        {proven ? <span className="badge sage">Passing run recorded</span>
                          : failing ? <span className="badge red">Failing or blocked</span>
                          : latest ? <span className="badge amber">Recorded, not passing</span>
                          : <span className="badge outline">Unproven</span>}
                      </td>
                      <td>
                        <Btn variant="ghost" size="xs" onClick={() => startFor(criterion)}><Plus size={11} aria-hidden="true" /> Record a test</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted" style={{ padding: '10px 14px 0', marginBottom: 0 }}>
            {summary.allCriteriaProven
              ? 'Every criterion has a passing run recorded by the team. The Passport still treats this as self-reported proof.'
              : `${summary.criteriaTotal - summary.proven} criterion(s) have no passing run recorded yet.`}
          </p>
        </Card>
      )}

      {view === 'requirements' && (
        <Card
          title="Requirements versus recorded tests"
          eyebrow="Assurance view only — implementation status stays in Requirements"
          flush
        >
          {project.requirements.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState
                icon={ClipboardCheck}
                title="No requirements mapped"
                action={<Btn variant="primary" to={`/projects/${project.id}/requirements`}>Map the official brief</Btn>}
              >
                Nothing can be assured against a brief that has not been read and recorded.
              </EmptyState>
            </div>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <caption className="sr-only">Requirements and their recorded tests</caption>
                <thead>
                  <tr>
                    <th scope="col">Requirement</th>
                    <th scope="col">Implementation (Requirements tab)</th>
                    <th scope="col">Tests recorded</th>
                    <th scope="col">Latest result</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.requirements.map(({ requirement, tests, latest }) => (
                    <tr key={requirement.id}>
                      <td>
                        <span className="cell-title">{requirement.text.slice(0, 90)}</span>
                        <span className="sub">{requirement.mandatory ? 'Mandatory' : 'Optional'} · source: {requirement.source || 'not recorded'}</span>
                      </td>
                      <td className="small">{requirement.status}</td>
                      <td className="num">{tests.length}</td>
                      <td>{latest ? <StatusBadge meta={resultMeta(latest.result)} /> : <span className="muted small">no run recorded</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '12px 14px 0' }}>
            <Notice>
              A passing test here does <b>not</b> change a requirement’s evidence status. Evidence status is set in
              the Requirements workspace, where the check date and source are recorded — keeping “built” and
              “proven” separate is the point of that screen.
            </Notice>
          </div>
        </Card>
      )}

      {view === 'ci' && (
        <div className="g-1-2 grid">
          <Card title="External CI results" eyebrow="Provider status">
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="badge outline">NOT CONNECTED</span>
              <Plug size={15} aria-hidden="true" />
            </div>
            <p className="small">
              This build has no pipeline integration. No run, webhook delivery, badge, log, or commit status is
              fabricated anywhere in BuildScope — see the provider record in{' '}
              <span className="mono">src/services/providers.js</span>.
            </p>
            <Btn
              variant="ghost"
              onClick={async () => {
                try {
                  await ci.listRuns();
                } catch (error) {
                  pushToast(`${error.name}: ${error.message}`);
                }
              }}
            >
              <ShieldAlert size={14} aria-hidden="true" /> Try a CI request (it will refuse)
            </Btn>
          </Card>

          <Card title="Integration contract" eyebrow="What a real connection must provide">
            <div className="mono xs muted">PROVIDER · {SOURCE_CAPABILITIES.ci.label}</div>
            <div className="scroll-x" style={{ marginTop: 8 }}>
              <table className="table">
                <caption className="sr-only">CI integration endpoints</caption>
                <thead>
                  <tr><th scope="col">Method</th><th scope="col">Endpoint</th><th scope="col">Returns</th></tr>
                </thead>
                <tbody>
                  {ciContract().endpoints.map((e) => (
                    <tr key={e.path}>
                      <td className="mono xs">{e.method}</td>
                      <td className="mono xs">{e.path}</td>
                      <td className="small">{e.returns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="small muted" style={{ paddingLeft: 16, marginTop: 10 }}>
              {ciContract().notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
            <div className="row wrap">
              {SOURCE_CAPABILITIES.ci.configuration.map((c) => <span key={c} className="tag">{c}</span>)}
            </div>
            <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
              <Info size={12} style={{ verticalAlign: -1 }} /> When this is connected, results would arrive with
              provenance <span className="mono">external-ci</span>; the tracker already labels the difference.
            </p>
          </Card>
        </div>
      )}

      <TestEditor
        open={Boolean(editor)}
        editor={editor}
        project={project}
        onClose={() => setEditor(null)}
        onSave={save}
      />

      <Confirm
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => actions.removeItem('tests', confirmDelete.id, `Test record removed: ${confirmDelete.title}`)}
        title="Delete this test record?"
        confirmLabel="Delete record"
        danger
      >
        <p className="small">
          <b>{confirmDelete?.title || 'This record'}</b> will be removed. Deleting a failing result is allowed,
          but the log is meant to keep them.
        </p>
      </Confirm>
    </>
  );
}

function TestEditor({ open, editor, project, onClose, onSave }) {
  const existing = editor?.record || null;
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!open) return;
    setDraft(existing ? { ...EMPTY, ...existing } : { ...EMPTY, ...(editor?.draft || {}) });
    setError('');
  }, [open, editor, existing]);

  if (!open || !editor) return null;
  const proofTestNodes = project.proofNodes.filter((n) => n.kind === 'test');
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const submit = (e) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError('Name the test so the log is readable later.');
      return;
    }
    if (draft.result !== 'not-run' && !`${draft.actual}${draft.evidenceNote}`.trim()) {
      setError('Record what was actually observed. A result without an observation is an assertion.');
      return;
    }
    onSave({ ...draft, title: draft.title.trim() }, existing);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={existing ? 'Edit test record' : 'Record a test'}
      eyebrow="Self-reported result"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={submit}>{existing ? 'Save record' : 'Record result'}</Btn></>}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field span2">
            <label htmlFor="t-title">What was tested<span className="req" aria-hidden="true">*</span></label>
            <input id="t-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Pickup request survives a reload" />
          </div>
          <div className="field">
            <label htmlFor="t-criterion">Acceptance criterion</label>
            <select id="t-criterion" value={draft.criterionId} onChange={(e) => set({ criterionId: e.target.value })}>
              <option value="">Not linked</option>
              {project.acceptance.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="t-requirement">Requirement</label>
            <select id="t-requirement" value={draft.requirementId} onChange={(e) => set({ requirementId: e.target.value })}>
              <option value="">Not linked</option>
              {project.requirements.map((r) => <option key={r.id} value={r.id}>{r.text.slice(0, 60)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="t-method">Method</label>
            <select id="t-method" value={draft.method} onChange={(e) => set({ method: e.target.value })}>
              {TEST_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <span className="hint">{methodMeta(draft.method).hint}</span>
          </div>
          <div className="field">
            <label htmlFor="t-result">Result</label>
            <select id="t-result" value={draft.result} onChange={(e) => set({ result: e.target.value })}>
              {Object.entries(TEST_RESULTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="t-ran">Run date</label>
            <input id="t-ran" type="date" value={String(draft.ranAt || '').slice(0, 10)} onChange={(e) => set({ ranAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
          </div>
          <div className="field">
            <label htmlFor="t-by">Run by</label>
            <input id="t-by" value={draft.ranBy} onChange={(e) => set({ ranBy: e.target.value })} placeholder="Name or initials" />
          </div>
          <div className="field span2">
            <label htmlFor="t-env">Environment</label>
            <input id="t-env" value={draft.environment} onChange={(e) => set({ environment: e.target.value })} placeholder="e.g. Chrome 130 on macOS, local build, seeded demo data" />
          </div>
          <div className="field">
            <label htmlFor="t-expected">Expected</label>
            <textarea id="t-expected" rows={3} value={draft.expected} onChange={(e) => set({ expected: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="t-actual">Actually observed<span className="req" aria-hidden="true">*</span></label>
            <textarea id="t-actual" rows={3} value={draft.actual} onChange={(e) => set({ actual: e.target.value })} placeholder="What you saw, including anything that went wrong." />
          </div>
          <div className="field span2">
            <label htmlFor="t-steps">Steps to repeat</label>
            <textarea id="t-steps" rows={3} value={draft.steps} onChange={(e) => set({ steps: e.target.value })} placeholder="1. … 2. … 3. …" />
          </div>
          <div className="field">
            <label htmlFor="t-note">Evidence note</label>
            <input id="t-note" value={draft.evidenceNote} onChange={(e) => set({ evidenceNote: e.target.value })} placeholder="Where the screenshot or log lives" />
          </div>
          <div className="field">
            <label htmlFor="t-url">Evidence link</label>
            <input id="t-url" value={draft.evidenceUrl} onChange={(e) => set({ evidenceUrl: e.target.value })} placeholder="https://…" />
            <span className="hint">Optional. Nothing here is fetched or verified automatically.</span>
          </div>
          <div className="field span2">
            <label htmlFor="t-node">Traceability node</label>
            <select id="t-node" value={draft.proofNodeId} onChange={(e) => set({ proofNodeId: e.target.value })}>
              <option value="">Not linked</option>
              {proofTestNodes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Untitled test node'}</option>)}
            </select>
            <span className="hint">Links this result to a “test result” node so the chain shows an observed outcome.</span>
          </div>
        </div>

        <div className="row wrap mb8">
          <span className="badge outline">SELF-REPORTED</span>
          <span className="small muted">Nothing in this record is independently verified.</span>
        </div>

        {draft.result === 'passed' && !draft.evidenceNote && (
          <Notice tone="warn">A passing result without a traceable artefact is hard to defend later. Add an evidence note if you have one.</Notice>
        )}
        {draft.result === 'failed' && (
          <Notice>Keeping a failing run is expected. It is what makes the passing runs credible.</Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  );
}
