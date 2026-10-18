import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, FlaskConical, AlertTriangle, Check, Edit3, Trash2, Target, Layers, } from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  MissingCase, Btn, Card, EmptyState, Field, Modal, Notice, PageHead, SegTabs, StatusBadge } from '../../components/ui';
import { feasibilityCheck, riskRecord, scopeItem, acceptanceCriterion, riskPriority } from '../../lib/models';
import {
  FEASIBILITY_CATEGORIES, FEASIBILITY_STATUS, RISK_IMPACT, RISK_LIKELIHOOD, RISK_STATUS, SCOPE_BUCKETS,
} from '../../lib/constants';
import { fmtDate } from '../../lib/format';
import { scopeHours } from '../../lib/scoring';

const RISK_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Closed: 4 };

function FeasibilityForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    category: initial?.category || 'Technical',
    title: initial?.title || '',
    mustBeTrue: initial?.mustBeTrue || '',
    status: initial?.status || 'not-investigated',
    evidence: initial?.evidence || '',
    whyItMatters: initial?.whyItMatters || '',
    consequence: initial?.consequence || '',
    nextAction: initial?.nextAction || '',
    howToVerify: initial?.howToVerify || '',
    fallback: initial?.fallback || '',
    criticality: initial?.criticality || 'Important',
    checkedAt: initial?.checkedAt || '',
  });
  const [err, setErr] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim() && !f.mustBeTrue.trim()) { setErr('Describe what must be true before this dependency can be trusted.'); return; }
    if (f.status === 'verified' && !f.checkedAt) { setErr('Marking a dependency verified requires the date you checked the evidence.'); return; }
    onSave({ ...f, title: f.title.trim() || f.mustBeTrue.slice(0, 70) });
  };

  return (
    <form onSubmit={submit}>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <div className="form-grid">
        <Field label="Category" htmlFor="fs-cat">
          <select id="fs-cat" value={f.category} onChange={(e) => set({ category: e.target.value })}>{FEASIBILITY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Criticality" hint="Critical means a blocker if unresolved." htmlFor="fs-crit">
          <select id="fs-crit" value={f.criticality} onChange={(e) => set({ criticality: e.target.value })}>
            <option>Critical</option><option>Important</option><option>Supporting</option>
          </select>
        </Field>
        <div className="span2">
          <Field label="What must be true" required htmlFor="fs-must">
            <textarea id="fs-must" rows={2} value={f.mustBeTrue} onChange={(e) => set({ mustBeTrue: e.target.value })} placeholder="e.g. Recycler requirements can be entered manually without a live inventory feed." />
          </Field>
        </div>
        <Field label="Status" htmlFor="fs-status">
          <select id="fs-status" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            {Object.entries(FEASIBILITY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Date checked" hint="Only for verified or partial." htmlFor="fs-date">
          <input id="fs-date" type="date" value={f.checkedAt ? f.checkedAt.slice(0, 10) : ''} onChange={(e) => set({ checkedAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
        </Field>
        <div className="span2">
          <Field label="Evidence or assumption" htmlFor="fs-evidence">
            <textarea id="fs-evidence" rows={2} value={f.evidence} onChange={(e) => set({ evidence: e.target.value })} placeholder="What supports the current status? A source, a test, or an explicit assumption?" />
          </Field>
        </div>
        <Field label="Why it matters" htmlFor="fs-why">
          <textarea id="fs-why" rows={2} value={f.whyItMatters} onChange={(e) => set({ whyItMatters: e.target.value })} />
        </Field>
        <Field label="Consequence if unresolved" htmlFor="fs-consequence">
          <textarea id="fs-consequence" rows={2} value={f.consequence} onChange={(e) => set({ consequence: e.target.value })} />
        </Field>
        <Field label="Recommended next action" htmlFor="fs-next">
          <input id="fs-next" type="text" value={f.nextAction} onChange={(e) => set({ nextAction: e.target.value })} />
        </Field>
        <Field label="How to verify" htmlFor="fs-how">
          <input id="fs-how" type="text" value={f.howToVerify} onChange={(e) => set({ howToVerify: e.target.value })} placeholder="A concrete, repeatable check." />
        </Field>
        <div className="span2">
          <Field label="Fallback plan" hint="What the demo does if this cannot be resolved." htmlFor="fs-fallback">
            <textarea id="fs-fallback" rows={2} value={f.fallback} onChange={(e) => set({ fallback: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={submit}>Save check</Btn>
      </div>
    </form>
  );
}

function RiskForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    likelihood: initial?.likelihood || 'Medium',
    impact: initial?.impact || 'Medium',
    evidence: initial?.evidence || '',
    mitigation: initial?.mitigation || '',
    fallback: initial?.fallback || '',
    owner: initial?.owner || '',
    status: initial?.status || 'Open',
    related: initial?.related || '',
  });
  const [err, setErr] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) { setErr('Give the risk a specific title.'); return; }
    onSave(f);
  };
  return (
    <form onSubmit={submit}>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <Field label="Risk title" required htmlFor="rk-title"><input id="rk-title" type="text" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Demo depends on data the team does not have" /></Field>
      <div className="mt12"><Field label="Description" htmlFor="rk-desc"><textarea id="rk-desc" rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field></div>
      <div className="form-grid mt12">
        <Field label="Likelihood" htmlFor="rk-likely"><select id="rk-likely" value={f.likelihood} onChange={(e) => set({ likelihood: e.target.value })}>{RISK_LIKELIHOOD.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Impact" htmlFor="rk-impact"><select id="rk-impact" value={f.impact} onChange={(e) => set({ impact: e.target.value })}>{RISK_IMPACT.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Status" htmlFor="rk-status"><select id="rk-status" value={f.status} onChange={(e) => set({ status: e.target.value })}>{RISK_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Owner (optional)" htmlFor="rk-owner"><input id="rk-owner" type="text" value={f.owner} onChange={(e) => set({ owner: e.target.value })} placeholder="e.g. presenting lead" /></Field>
      </div>
      <div className="mt12"><Field label="Evidence or reason for concern" htmlFor="rk-evidence"><textarea id="rk-evidence" rows={2} value={f.evidence} onChange={(e) => set({ evidence: e.target.value })} /></Field></div>
      <div className="mt12"><Field label="Mitigation" hint="How you reduce likelihood or impact." htmlFor="rk-mit"><textarea id="rk-mit" rows={2} value={f.mitigation} onChange={(e) => set({ mitigation: e.target.value })} /></Field></div>
      <div className="mt12"><Field label="Fallback" hint="What happens if the risk materialises anyway." htmlFor="rk-fallback"><textarea id="rk-fallback" rows={2} value={f.fallback} onChange={(e) => set({ fallback: e.target.value })} /></Field></div>
      <div className="mt12"><Field label="Related feature or requirement" htmlFor="rk-rel"><input id="rk-rel" type="text" value={f.related} onChange={(e) => set({ related: e.target.value })} /></Field></div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={submit}>Save risk</Btn>
      </div>
    </form>
  );
}

function ScopeForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ name: initial?.name || '', bucket: initial?.bucket || 'should', hours: initial?.hours ?? 4, note: initial?.note || '' });
  const [err, setErr] = useState('');
  return (
    <div>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <Field label="Feature or deliverable" required htmlFor="sc-name"><input id="sc-name" type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="form-grid mt12">
        <Field label="Bucket" htmlFor="sc-bucket">
          <select id="sc-bucket" value={f.bucket} onChange={(e) => setF({ ...f, bucket: e.target.value })}>
            {SCOPE_BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Rough estimate (hours)" hint="A planning assumption, not a promise." htmlFor="sc-hours">
          <input id="sc-hours" type="number" min="0" max="200" value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="mt12"><Field label="Note" htmlFor="sc-note"><input id="sc-note" type="text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" disabled={!f.name.trim()} onClick={() => { if (!f.name.trim()) { setErr('A name is required.'); return; } onSave(f); }}>Save item</Btn>
      </div>
    </div>
  );
}

function AcceptanceForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    title: initial?.title || '',
    kind: initial?.kind || 'capability',
    given: initial?.given || '',
    when: initial?.when || '',
    then: initial?.then || '',
    proof: initial?.proof || '',
    evidenceStatus: initial?.evidenceStatus || 'not-started',
  });
  const [err, setErr] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) { setErr('Name the criterion as an observable outcome.'); return; }
    if (!f.then.trim()) { setErr('Describe what must be observable when the criterion passes.'); return; }
    onSave(f);
  };
  return (
    <form onSubmit={submit}>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <Field label="Criterion" required htmlFor="ac-title"><input id="ac-title" type="text" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Material is linked to a recycler handoff" /></Field>
      <div className="form-grid mt12">
        <Field label="Kind" htmlFor="ac-kind">
          <select id="ac-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="workflow">End-to-end workflow</option>
            <option value="capability">Capability</option>
            <option value="evidence">Evidence / repeatable check</option>
          </select>
        </Field>
        <Field label="Evidence status" htmlFor="ac-status">
          <select id="ac-status" value={f.evidenceStatus} onChange={(e) => set({ evidenceStatus: e.target.value })}>
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="verified">Verified by a repeatable check</option>
          </select>
        </Field>
      </div>
      <div className="form-grid mt12">
        <Field label="Given" htmlFor="ac-given"><input id="ac-given" type="text" value={f.given} onChange={(e) => set({ given: e.target.value })} /></Field>
        <Field label="When" htmlFor="ac-when"><input id="ac-when" type="text" value={f.when} onChange={(e) => set({ when: e.target.value })} /></Field>
      </div>
      <div className="mt12"><Field label="Then" required htmlFor="ac-then"><input id="ac-then" type="text" value={f.then} onChange={(e) => set({ then: e.target.value })} /></Field></div>
      <div className="mt12"><Field label="Proof required" hint="How will someone else verify this without asking you?" htmlFor="ac-proof"><input id="ac-proof" type="text" value={f.proof} onChange={(e) => set({ proof: e.target.value })} placeholder="Reload test + recorded walkthrough" /></Field></div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={submit}>Save criterion</Btn>
      </div>
    </form>
  );
}

export default function FeasibilityLab() {
  const project = useRouteProject();
  const { actions, pushToast } = useApp();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const t = params.get('tab');
    return t === 'scope' || t === 'risks' ? t : 'checks';
  });
  const [modal, setModal] = useState(null);
  const [budget, setBudget] = useState(null);
  usePageTitle('Feasibility Lab');
  const p = project;

  const hours = useMemo(() => (p ? scopeHours(p) : null), [p]);

  if (!p) return <MissingCase />;

  const setTabPersist = (t) => { setTab(t); setParams(t === 'checks' ? {} : { tab: t }); };
  const riskBlockers = p.risks.filter((r) => ['High', 'Critical'].includes(riskPriority(r)));
  const blocked = p.feasibility.filter((f) => f.status === 'blocked');
  const verified = p.feasibility.filter((f) => f.status === 'verified');

  const changeFeasStatus = (check, status) => {
    if (status === 'verified' && !check.checkedAt) {
      setModal({ type: 'check', check });
      pushToast('Record the date and evidence before marking this verified.');
      return;
    }
    actions.updateItem('feasibility', check.id, { status }, `Feasibility status updated: ${check.title || check.category} → ${FEASIBILITY_STATUS[status]?.label}.`);
  };

  const saveCheck = (data, existing) => {
    if (existing) {
      actions.updateItem('feasibility', existing.id, data, `Feasibility check updated: ${data.title}.`);
      pushToast('Feasibility check updated.');
    } else {
      actions.addItem('feasibility', feasibilityCheck(data), `Feasibility check added: ${data.title}.`);
      pushToast('Feasibility check recorded.');
    }
    setModal(null);
  };

  const saveRisk = (data, existing) => {
    if (existing) {
      actions.updateItem('risks', existing.id, data, `Risk updated: ${data.title}.`);
      pushToast('Risk updated.');
    } else {
      actions.addItem('risks', riskRecord(data), `Risk registered: ${data.title}.`);
      pushToast('Risk added to the register.');
    }
    setModal(null);
  };

  const saveScope = (data, existing) => {
    if (existing) actions.updateItem('scope', existing.id, data, `Scope item updated: ${data.name}.`);
    else actions.addItem('scope', scopeItem(data), `Scope item added: ${data.name}.`);
    pushToast('Build scope updated.');
    setModal(null);
  };

  const saveAcceptance = (data, existing) => {
    if (existing) actions.updateItem('acceptance', existing.id, data, `Acceptance criterion updated: ${data.title}.`);
    else actions.addItem('acceptance', acceptanceCriterion(data), `Acceptance criterion defined: ${data.title}.`);
    pushToast('Acceptance criterion saved.');
    setModal(null);
  };

  const importFeatures = () => {
    const missing = p.features.filter((f) => !p.scope.some((s) => s.name.toLowerCase() === f.name.toLowerCase()));
    if (!missing.length) { pushToast('Every project feature is already in the build scope.'); return; }
    missing.forEach((f) => actions.addItem('scope', scopeItem({ name: f.name, bucket: f.essential ? 'must' : 'could', hours: f.essential ? 6 : 3, note: 'Imported from the project brief.' })));
    pushToast(`${missing.length} feature(s) imported into the build scope.`);
  };

  const confirmScope = () => {
    if (p.scope.filter((s) => s.bucket === 'must').length === 0) {
      pushToast('Mark at least one must-build feature before confirming scope.');
      return;
    }
    actions.updateProject(p.id, { scopeConfirmedAt: new Date().toISOString() }, 'Build scope confirmed.');
    pushToast('Scope confirmed. Mission 05 can now complete.');
  };

  const buckets = SCOPE_BUCKETS.map((b) => ({ ...b, items: p.scope.filter((s) => s.bucket === b.key), hours: p.scope.filter((s) => s.bucket === b.key).reduce((n, s) => n + (Number(s.hours) || 0), 0) }));

  return (
    <div>
      <PageHead
        eyebrow="05 · Stress test"
        title="Feasibility Lab"
        description="Separate what sounds buildable from what a student team can actually demonstrate. Only record “verified” when the evidence has been checked — an assumption is a legitimate status, not a failure."
        actions={<>
          <Btn variant="ghost" onClick={() => setModal({ type: 'risk' })}><AlertTriangle size={14} /> Add risk</Btn>
          <Btn variant="primary" onClick={() => setModal({ type: 'check' })}><Plus size={14} /> Add feasibility check</Btn>
        </>}
      />

      <div className="grid g4 mb16">
        {[
          ['Checks assessed', `${p.feasibility.filter((f) => f.status !== 'not-investigated').length}/${p.feasibility.length}`, ''],
          ['Verified', String(verified.length), verified.length ? 'green' : ''],
          ['Blocked dependencies', String(blocked.length), blocked.length ? 'red' : ''],
          ['High/critical risks', String(riskBlockers.length), riskBlockers.length ? 'orange' : ''],
        ].map(([label, value, tone]) => (
          <div key={label} className="card card-tight">
            <div className="spread" style={{ alignItems: 'baseline' }}>
              <span className="eyebrow plain">{label}</span>
              <span className={`dot ${tone}`} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 600, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {(blocked.length > 0 || hours.over) && (
        <div className="mb16"><Notice tone="warn">
          {blocked.length > 0 && <div><b>{blocked.length} dependency is blocked.</b> Blocks the passport until resolved or given a fallback.</div>}
          {hours.over && <div className="mt8"><b>Scope exceeds the time budget.</b> Must-build estimate is {hours.must}h against {hours.available}h available.</div>}
        </Notice></div>
      )}

      <SegTabs value={tab} onChange={setTabPersist} label="Feasibility views" options={[
        { value: 'checks', label: 'Dependency checks', count: p.feasibility.length },
        { value: 'risks', label: 'Risk register', count: p.risks.length },
        { value: 'scope', label: 'Scope & proof', count: p.scope.length + p.acceptance.length },
      ]} />

      {tab === 'checks' && (
        <>
          {p.feasibility.length === 0 ? (
            <div className="card"><EmptyState icon={FlaskConical} title="No feasibility checks" action={<Btn variant="primary" onClick={() => setModal({ type: 'check' })}><Plus size={14} /> Add the first check</Btn>}>
              Start with data availability, API access, authentication, licensing, and time. These are the constraints that usually decide whether a hackathon demo is possible.
            </EmptyState></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th style={{ width: 150 }}>Area</th><th>What must be true</th><th style={{ width: 150 }}>Status</th><th style={{ width: 130 }}>Fallback</th><th style={{ width: 72 }}><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {p.feasibility.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className="cell-title">{f.category}</span>
                        <span className="sub">{f.criticality}</span>
                      </td>
                      <td>
                        <span className="small strong">{f.title || '—'}</span>
                        <span className="sub">{f.mustBeTrue}</span>
                        {f.evidence && <span className="sub" style={{ fontStyle: 'italic' }}>Evidence: {f.evidence}</span>}
                        {f.checkedAt && <span className="sub mono">CHECKED {fmtDate(f.checkedAt).toUpperCase()}</span>}
                      </td>
                      <td>
                        <select
                          value={f.status}
                          onChange={(e) => changeFeasStatus(f, e.target.value)}
                          aria-label={`Status for ${f.title || f.category}`}
                          style={{ fontSize: 11, padding: '4px 22px 4px 6px' }}
                        >
                          {Object.entries(FEASIBILITY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td><span className="xs">{f.fallback || 'None recorded'}</span></td>
                      <td>
                        <div className="row nowrap" style={{ gap: 2 }}>
                          <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'check', check: f })} aria-label={`Edit ${f.title || f.category}`}><Edit3 size={12} /></Btn>
                          <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('feasibility', f.id); pushToast('Feasibility check removed.'); }} aria-label="Delete check"><Trash2 size={12} /></Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt16">
            <Notice>
              <b>Status meaning.</b> Verified means evidence was checked on the recorded date. Partially verified means some fields were confirmed.
              Assumed means the team believes it without a test. Blocked means the dependency currently fails. Not investigated is not the same as low risk.
            </Notice>
          </div>
        </>
      )}

      {tab === 'risks' && (
        <>
          <div className="grid g-1-2">
            <Card title="Likelihood / impact" eyebrow="Derived priority" actions={<span className="mono xs muted">{p.risks.length} risks</span>}>
              <table className="matrix" aria-label="Risk matrix">
                <thead>
                  <tr><th style={{ width: 62 }} /><th>Low impact</th><th>Medium</th><th>High</th></tr>
                </thead>
                <tbody>
                  {[...RISK_LIKELIHOOD].reverse().map((l) => (
                    <tr key={l}>
                      <th scope="row">{l} likelihood</th>
                      {RISK_IMPACT.map((imp) => {
                        const cellRisks = p.risks.filter((r) => r.likelihood === l && r.impact === imp);
                        const score = ({ Low: 1, Medium: 2, High: 3 }[l]) * ({ Low: 1, Medium: 2, High: 3 }[imp]);
                        const lvl = score >= 7 ? 4 : score >= 5 ? 3 : score >= 3 ? 2 : 1;
                        return (
                          <td key={imp} className={`lv-${lvl}`}>
                            {cellRisks.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                className={`risk-chip ${r.impact === 'Low' ? 'low' : ''}`}
                                title={`${r.title} — ${riskPriority(r)}`}
                                onClick={() => setModal({ type: 'risk', risk: r })}
                                style={{ border: 0, borderLeft: '2px solid', textAlign: 'left', width: '100%', cursor: 'pointer' }}
                              >
                                {r.title}
                              </button>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="xs muted mt12 mb0">Priority = likelihood × impact. Resolved and accepted risks fall out of the matrix ordering but remain in the register.</p>
            </Card>

            <div>
              <div className="spread mb16" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="eyebrow">Risk register</div>
                  <p className="small muted mb0">Resolve the blocker, mitigate the risk, or record an explicit accepted risk. Silence is not a mitigation.</p>
                </div>
                <Btn variant="primary" size="sm" onClick={() => setModal({ type: 'risk' })}><Plus size={13} /> Add risk</Btn>
              </div>

              {p.risks.length === 0 ? (
                <div className="card"><EmptyState icon={AlertTriangle} title="No risks registered" action={<Btn variant="primary" onClick={() => setModal({ type: 'risk' })}>Register the first risk</Btn>}>
                  A register with nothing in it usually means nothing was examined. Start with the data or dependency the demo cannot survive without.
                </EmptyState></div>
              ) : (
                <div className="stack-sm">
                  {[...p.risks].sort((a, b) => RISK_ORDER[riskPriority(a)] - RISK_ORDER[riskPriority(b)]).map((r) => {
                    const pr = riskPriority(r);
                    return (
                      <div key={r.id} className="card card-tight">
                        <div className="spread" style={{ alignItems: 'flex-start', gap: 10 }}>
                          <div>
                            <div className="row" style={{ gap: 6 }}>
                              <span className="small strong">{r.title}</span>
                              <StatusBadge meta={{ label: pr, cls: pr === 'Critical' ? 'red' : pr === 'High' ? 'orange' : pr === 'Medium' ? 'amber' : 'outline' }} />
                              <span className="badge outline">{r.status}</span>
                            </div>
                            <div className="xs muted mt8">{r.description}</div>
                          </div>
                          <div className="row nowrap" style={{ gap: 2 }}>
                            <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'risk', risk: r })} aria-label={`Edit ${r.title}`}><Edit3 size={12} /></Btn>
                            <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('risks', r.id); pushToast('Risk removed from the register.'); }} aria-label={`Delete ${r.title}`}><Trash2 size={12} /></Btn>
                          </div>
                        </div>
                        <div className="grid g2 mt8" style={{ gap: 10 }}>
                          <div><div className="mono xs muted">MITIGATION</div><div className="xs">{r.mitigation || <span style={{ color: 'var(--orange)' }}>None recorded</span>}</div></div>
                          <div><div className="mono xs muted">FALLBACK</div><div className="xs">{r.fallback || 'None recorded'}</div></div>
                        </div>
                        <div className="row between mt8">
                          <span className="mono xs muted">L:{r.likelihood} · I:{r.impact}{r.owner ? ` · ${r.owner}` : ''}{r.related ? ` · ${r.related}` : ''}</span>
                          <select value={r.status} onChange={(e) => actions.updateItem('risks', r.id, { status: e.target.value }, `Risk status updated: ${r.title} → ${e.target.value}.`)} aria-label={`Status for ${r.title}`} style={{ width: 'auto', fontSize: 10.5, padding: '2px 20px 2px 5px' }}>
                            {RISK_STATUS.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'scope' && (
        <>
          <div className="grid g-2-1" style={{ alignItems: 'start' }}>
            <div className="stack">
              <Card title="Build scope" eyebrow="Must / should / could / not yet" actions={<>
                <Btn variant="quiet" size="sm" onClick={importFeatures}>Import features</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setModal({ type: 'scope' })}><Plus size={13} /> Add item</Btn>
              </>}>
                <div className="grid g4 mb16" style={{ gap: 0 }}>
                  {buckets.map((b, i) => (
                    <div key={b.key} style={{ borderLeft: i ? '1px solid var(--line)' : 'none', paddingLeft: i ? 10 : 0 }}>
                      <div className="mono xs muted">{b.label.toUpperCase()}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>{b.items.length}</div>
                      <div className="xs muted">{b.hours}h estimate</div>
                    </div>
                  ))}
                </div>

                {p.scope.length === 0 ? (
                  <EmptyState icon={Layers} title="No build scope defined" action={<Btn variant="primary" onClick={importFeatures}>Import features from the brief</Btn>}>
                    Prioritise one working end-to-end demo over a long list of incomplete features.
                  </EmptyState>
                ) : (
                  <div className="stack-md">
                    {buckets.map((b) => (
                      <div key={b.key} style={{ marginTop: 14 }}>
                        <div className="spread">
                          <div>
                            <span className="mono xs" style={{ letterSpacing: '.08em' }}>{b.label.toUpperCase()}</span>
                            <span className="xs muted"> · {b.hint}</span>
                          </div>
                          <span className="mono xs muted">{b.hours}h</span>
                        </div>
                        <div className="mt8">
                          {b.items.length === 0 ? <div className="xs muted" style={{ padding: '6px 0' }}>Nothing in this bucket.</div> : b.items.map((s) => (
                            <div key={s.id} className="spread" style={{ padding: '7px 0', borderTop: '1px dashed var(--line-soft)', gap: 8 }}>
                              <div style={{ minWidth: 0 }}>
                                <div className="small strong">{s.name}</div>
                                {s.note && <div className="xs muted">{s.note}</div>}
                              </div>
                              <div className="row nowrap" style={{ gap: 4 }}>
                                <span className="mono xs muted">{s.hours}h</span>
                                <select value={s.bucket} onChange={(e) => actions.updateItem('scope', s.id, { bucket: e.target.value }, `Scope item moved: ${s.name}.`)} aria-label={`Bucket for ${s.name}`} style={{ width: 'auto', fontSize: 10, padding: '2px 18px 2px 4px' }}>
                                  {SCOPE_BUCKETS.map((sb) => <option key={sb.key} value={sb.key}>{sb.label}</option>)}
                                </select>
                                <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'scope', item: s })} aria-label={`Edit ${s.name}`}><Edit3 size={11} /></Btn>
                                <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('scope', s.id); pushToast('Scope item removed.'); }} aria-label={`Remove ${s.name}`}><Trash2 size={11} /></Btn>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title={`Demo acceptance criteria (${p.acceptance.length})`} eyebrow="Proof, not features" actions={<Btn variant="ghost" size="sm" onClick={() => setModal({ type: 'acceptance' })}><Plus size={13} /> Add criterion</Btn>}>
                <p className="small muted">
                  Implementation is not proof. Each criterion needs an observable outcome and a way for someone else to verify it.
                </p>
                {p.acceptance.length === 0 ? (
                  <EmptyState icon={Target} title="No acceptance criteria" action={<Btn variant="primary" onClick={() => setModal({ type: 'acceptance' })}>Define the first criterion</Btn>}>
                    Without criteria, “it works” is an opinion. Start with the end-to-end workflow a judge must see.
                  </EmptyState>
                ) : (
                  <div className="stack-sm">
                    {p.acceptance.map((a) => (
                      <div key={a.id} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                        <div className="spread" style={{ alignItems: 'flex-start' }}>
                          <div>
                            <div className="row" style={{ gap: 5 }}>
                              <span className="badge outline">{a.kind}</span>
                              <span className={`badge ${a.evidenceStatus === 'verified' ? 'green' : a.evidenceStatus === 'in-progress' ? 'amber' : 'outline'}`}>{a.evidenceStatus.replace('-', ' ')}</span>
                            </div>
                            <div className="small strong mt8">{a.title}</div>
                          </div>
                          <div className="row nowrap" style={{ gap: 2 }}>
                            <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'acceptance', item: a })} aria-label={`Edit ${a.title}`}><Edit3 size={12} /></Btn>
                            <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('acceptance', a.id); pushToast('Acceptance criterion removed.'); }} aria-label={`Delete ${a.title}`}><Trash2 size={12} /></Btn>
                          </div>
                        </div>
                        {(a.given || a.when || a.then) && (
                          <div className="mono xs muted mt8" style={{ lineHeight: 1.7 }}>
                            GIVEN {a.given || '—'}<br />WHEN {a.when || '—'}<br />THEN {a.then || '—'}
                          </div>
                        )}
                        {a.proof && <div className="xs mt8"><b>Proof:</b> {a.proof}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <aside className="stack">
              <Card title="Time budget" eyebrow="Planning assumption">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <Field label="Team" htmlFor="tb-team"><input id="tb-team" type="number" min="1" max="20" value={budget?.teamSize ?? p.teamSize} onChange={(e) => setBudget({ ...(budget || {}), teamSize: Number(e.target.value) })} /></Field>
                  <Field label="Hours each" htmlFor="tb-hours"><input id="tb-hours" type="number" min="1" max="400" value={budget?.timeAvailable ?? p.timeAvailable} onChange={(e) => setBudget({ ...(budget || {}), timeAvailable: Number(e.target.value) })} /></Field>
                </div>
                <div className="mt12">
                  <div className="spread small"><span className="muted">Total available</span><strong>{hours.available}h</strong></div>
                  <div className="spread small"><span className="muted">Must-build estimate</span><strong>{hours.must}h</strong></div>
                  <div className="spread small"><span className="muted">Should + could</span><strong>{hours.should + hours.could}h</strong></div>
                </div>
                <div className="xp-rail mt12">
                  <i style={{ width: `${Math.min(100, hours.available ? (hours.must / hours.available) * 100 : 0)}%`, background: hours.over ? '#e8a45d' : 'var(--sage-mid)' }} />
                  <b>{hours.available ? `${Math.round((hours.must / hours.available) * 100)}% OF BUDGET` : 'NO BUDGET SET'}</b>
                </div>
                {budget && (
                  <Btn variant="primary" size="sm" className="block mt12" onClick={() => { actions.updateActive({ teamSize: budget.teamSize ?? p.teamSize, timeAvailable: budget.timeAvailable ?? p.timeAvailable }, 'Team time budget updated.'); pushToast('Time budget saved.'); setBudget(null); }}>
                    Save budget
                  </Btn>
                )}
                <p className="xs muted mt8 mb0">Estimates are rough planning assumptions. They are not commitments or a schedule.</p>
              </Card>

              <Card title="Demo realism" eyebrow="Before you add another feature">
                <ul className="small muted" style={{ paddingLeft: 16, margin: 0 }}>
                  <li>One end-to-end workflow beats four half-built screens.</li>
                  <li>Any live-data dependency needs a visible fallback.</li>
                  <li>If a judge cannot see the differentiator in five minutes, it is not in the demo.</li>
                  <li>Cut the map before cutting the handoff record.</li>
                </ul>
                <div className="line" />
                <div className="spread mono xs muted"><span>MUST-BUILD</span><span>{p.scope.filter((s) => s.bucket === 'must').length} items</span></div>
                <div className="spread mono xs muted mt8"><span>CRITERIA</span><span>{p.acceptance.length} defined</span></div>
                <div className="spread mono xs muted mt8"><span>SCOPE</span><span>{p.scopeConfirmedAt ? `confirmed ${fmtDate(p.scopeConfirmedAt)}` : 'not confirmed'}</span></div>
                <Btn variant={p.scopeConfirmedAt ? 'ghost' : 'primary'} size="sm" className="block mt12" onClick={confirmScope}>
                  <Check size={13} /> {p.scopeConfirmedAt ? 'Re-confirm scope' : 'Confirm build scope'}
                </Btn>
              </Card>

              <Notice>
                <b>Blocked dependencies are not automatically fatal.</b> Record a fallback and make the demo work without the missing service — then the block becomes a design decision, not a surprise.
              </Notice>

              <Card title="Mission 04 readiness" eyebrow="Prove the demo">
                <div className="stack-sm">
                  {[
                    ['At least three must-build items', p.scope.filter((s) => s.bucket === 'must').length >= 3],
                    ['At least three acceptance criteria', p.acceptance.length >= 3],
                    ['An end-to-end workflow criterion', p.acceptance.some((a) => a.kind === 'workflow')],
                    ['A proof method for each criterion', p.acceptance.every((a) => a.proof) && p.acceptance.length > 0],
                  ].map(([label, ok]) => (
                    <div key={label} className="row" style={{ gap: 7, fontSize: 12 }}>
                      <span className={`task-box ${ok ? 'done' : ''}`} aria-hidden="true">{ok ? <Check size={10} /> : null}</span>
                      <span className={ok ? '' : 'muted'}>{label}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </aside>
          </div>
        </>
      )}

      {modal?.type === 'check' && (
        <Modal open onClose={() => setModal(null)} title={modal.check ? 'Edit feasibility check' : 'Add feasibility check'} eyebrow="Dependency assessment" wide>
          <FeasibilityForm initial={modal.check} onCancel={() => setModal(null)} onSave={(d) => saveCheck(d, modal.check)} />
        </Modal>
      )}
      {modal?.type === 'risk' && (
        <Modal open onClose={() => setModal(null)} title={modal.risk ? 'Edit risk' : 'Register a risk'} eyebrow="Risk register" wide>
          <RiskForm initial={modal.risk} onCancel={() => setModal(null)} onSave={(d) => saveRisk(d, modal.risk)} />
        </Modal>
      )}
      {modal?.type === 'scope' && (
        <Modal open onClose={() => setModal(null)} title={modal.item ? 'Edit scope item' : 'Add scope item'} eyebrow="Build scope">
          <ScopeForm initial={modal.item} onCancel={() => setModal(null)} onSave={(d) => saveScope(d, modal.item)} />
        </Modal>
      )}
      {modal?.type === 'acceptance' && (
        <Modal open onClose={() => setModal(null)} title={modal.item ? 'Edit acceptance criterion' : 'Define acceptance criterion'} eyebrow="Demo proof" wide>
          <AcceptanceForm initial={modal.item} onCancel={() => setModal(null)} onSave={(d) => saveAcceptance(d, modal.item)} />
        </Modal>
      )}
    </div>
  );
}
