import React, { useState } from 'react';
import { Plus, ClipboardCheck, ShieldAlert, Edit3, Trash2, Check, AlertTriangle, } from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  MissingCase, Btn, Card, EmptyState, Field, Modal, Notice, PageHead, StatusBadge } from '../../components/ui';
import { officialRequirement } from '../../lib/models';
import { REQUIREMENT_STATUS } from '../../lib/constants';
import { complianceSummary } from '../../lib/scoring';
import { fmtDate } from '../../lib/format';

function RequirementForm({ initial, project, onSave, onCancel }) {
  const [f, setF] = useState({
    text: initial?.text || '',
    source: initial?.source || (project.hackathonName || ''),
    sourceUrl: initial?.sourceUrl || project.briefMeta?.sourceUrl || '',
    mandatory: initial?.mandatory ?? true,
    mustImplement: initial?.mustImplement || '',
    demonstration: initial?.demonstration || '',
    acceptance: initial?.acceptance || '',
    status: initial?.status || 'unconfirmed',
    evidence: initial?.evidence || '',
    questions: initial?.questions || '',
    checkedAt: initial?.checkedAt || '',
  });
  const [err, setErr] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.text.trim()) { setErr('Paste or paraphrase the requirement wording. Mark paraphrases clearly.'); return; }
    onSave(f);
  };
  return (
    <form onSubmit={submit}>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <Notice>
        Use the exact wording from the official brief wherever possible. If the brief is not available, mark the requirement
        <b> unconfirmed</b> and record the question rather than inventing a rule.
      </Notice>
      <div className="mt12">
        <Field label="Requirement wording" required htmlFor="rq-text">
          <textarea id="rq-text" rows={3} value={f.text} onChange={(e) => set({ text: e.target.value })} placeholder="Working software demonstration during judging (verify against official brief)…" />
        </Field>
      </div>
      <div className="form-grid mt12">
        <Field label="Official source" htmlFor="rq-source">
          <input id="rq-source" type="text" value={f.source} onChange={(e) => set({ source: e.target.value })} placeholder="e.g. Official rules page, section 4" />
        </Field>
        <Field label="Official source URL" htmlFor="rq-url">
          <input id="rq-url" type="url" value={f.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} />
        </Field>
        <Field label="Mandatory?" htmlFor="rq-mand">
          <select id="rq-mand" value={f.mandatory ? 'yes' : 'no'} onChange={(e) => set({ mandatory: e.target.value === 'yes' })}>
            <option value="yes">Mandatory</option>
            <option value="no">Optional / scored</option>
          </select>
        </Field>
        <Field label="Status" htmlFor="rq-status">
          <select id="rq-status" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            {Object.entries(REQUIREMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Date source checked" htmlFor="rq-date">
          <input id="rq-date" type="date" value={f.checkedAt ? f.checkedAt.slice(0, 10) : ''} onChange={(e) => set({ checkedAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
        </Field>
        <Field label="Unresolved questions" htmlFor="rq-q">
          <input id="rq-q" type="text" value={f.questions} onChange={(e) => set({ questions: e.target.value })} placeholder="What must be confirmed with the organisers?" />
        </Field>
      </div>
      <div className="mt12">
        <Field label="What the team must implement" htmlFor="rq-impl">
          <textarea id="rq-impl" rows={2} value={f.mustImplement} onChange={(e) => set({ mustImplement: e.target.value })} />
        </Field>
      </div>
      <div className="form-grid mt12">
        <Field label="How compliance will be demonstrated" htmlFor="rq-demo">
          <textarea id="rq-demo" rows={2} value={f.demonstration} onChange={(e) => set({ demonstration: e.target.value })} />
        </Field>
        <Field label="Acceptance criterion" htmlFor="rq-accept">
          <textarea id="rq-accept" rows={2} value={f.acceptance} onChange={(e) => set({ acceptance: e.target.value })} placeholder="What an assessor must be able to observe." />
        </Field>
      </div>
      <div className="mt12">
        <Field label="Evidence" hint="Implementation alone is not proof. Record what demonstrates compliance." htmlFor="rq-evidence">
          <textarea id="rq-evidence" rows={2} value={f.evidence} onChange={(e) => set({ evidence: e.target.value })} placeholder="e.g. Live demo step 3 + recorded walkthrough" />
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={submit}>Save requirement</Btn>
      </div>
    </form>
  );
}

function BriefModal({ project, onClose, onSave }) {
  const [text, setText] = useState(project.officialBrief || '');
  const [url, setUrl] = useState(project.briefMeta?.sourceUrl || '');
  const [date, setDate] = useState(project.briefMeta?.checkedAt ? project.briefMeta.checkedAt.slice(0, 10) : '');
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Official brief source"
      eyebrow="Do not claim compliance against an unchecked brief"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => onSave({ text, url, date })}>Save brief source</Btn>
      </>}
    >
      <Field label="Official brief / problem statement" hint="Paste verbatim where possible. Do not paraphrase official rules." htmlFor="brief-text">
        <textarea id="brief-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the official brief, judging criteria, or rules…" />
      </Field>
      <div className="form-grid mt12">
        <Field label="Official source URL" hint="The organiser page the brief came from." htmlFor="brief-url">
          <input id="brief-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Date checked" htmlFor="brief-date">
          <input id="brief-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="mt12">
        <Notice tone={url && date ? 'ok' : 'warn'}>
          {url && date
            ? 'Saving records this source as checked. Requirement mapping will be treated as based on a verified brief.'
            : 'Without both a source URL and check date, compliance remains unverified across the dashboard, report, and passport.'}
        </Notice>
      </div>
      {text && (
        <details className="mt12">
          <summary className="mono xs" style={{ cursor: 'pointer', color: 'var(--ink-2)' }}>REVIEW PASTED BRIEF ({text.length} CHARACTERS)</summary>
          <div className="code-note mt8" style={{ maxHeight: 180, overflowY: 'auto' }}>{text}</div>
        </details>
      )}
    </Modal>
  );
}

export default function Requirements() {
  const project = useRouteProject();
  const { actions, pushToast } = useApp();
  const [modal, setModal] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  usePageTitle('Requirements');
  const p = project;

  if (!p) return <MissingCase />;

  const summary = complianceSummary(p);
  const mandatory = p.requirements.filter((r) => r.mandatory);
  const unconfirmedRequirements = p.requirements.filter((r) => r.status === 'unconfirmed');

  const saveBrief = ({ text, url, date }) => {
    actions.updateProject(p.id, {
      officialBrief: text,
      briefMeta: { ...p.briefMeta, sourceUrl: url, checkedAt: date ? new Date(date).toISOString() : '', checkedBy: 'Team' },
    }, 'Official brief source updated.');
    pushToast(url && date ? 'Brief source recorded. Requirements can now be mapped against it.' : 'Brief saved. Compliance remains unverified without a source and check date.');
    setBriefOpen(false);
  };

  const saveRequirement = (data, existing) => {
    if (existing) {
      actions.updateItem('requirements', existing.id, data, `Requirement updated: ${data.text.slice(0, 60)}.`);
      pushToast('Requirement updated.');
    } else {
      actions.addItem('requirements', officialRequirement(data), `Requirement mapped: ${data.text.slice(0, 60)}.`);
      pushToast('Requirement added to the compliance map.');
    }
    setModal(null);
  };

  return (
    <div>
      <PageHead
        eyebrow="06 · Official requirements"
        title="Requirements & compliance"
        description="Map the project to the actual competition brief. Implementation is not proof: a requirement is only evidenced when you can show how compliance is demonstrated."
        actions={<>
          <Btn variant="ghost" onClick={() => setBriefOpen(true)}><ClipboardCheck size={14} /> Brief source</Btn>
          <Btn variant="primary" onClick={() => setModal({ type: 'new' })}><Plus size={14} /> Add requirement</Btn>
        </>}
      />

      {!summary.briefVerified && (
        <div className="notice danger mb16" role="alert" style={{ borderLeftWidth: 4 }}>
          <ShieldAlert size={16} />
          <div>
            <b className="mono" style={{ letterSpacing: '.05em' }}>OFFICIAL REQUIREMENTS NOT VERIFIED — ADD THE OFFICIAL BRIEF BEFORE CLAIMING COMPLIANCE.</b>
            <div className="small mt8">
              No official source URL and check date are recorded for this case. Every requirement below is unconfirmed and must not be
              presented as an official rule. Adding text to the brief does not verify it.
            </div>
            <Btn variant="ghost" size="sm" className="mt8" onClick={() => setBriefOpen(true)}>Record the official brief source</Btn>
          </div>
        </div>
      )}

      <div className="grid g4 mb16">
        {[
          ['Mandatory mapped', String(mandatory.length)],
          ['Evidence provided', String(summary.confirmed)],
          ['Implemented, unproven', String(summary.implemented)],
          ['Unconfirmed', String(summary.unconfirmed)],
        ].map(([l, v]) => (
          <div key={l} className="card card-tight">
            <div className="eyebrow plain">{l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="grid g-2-1" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Card title="Compliance map" eyebrow={`${p.requirements.length} requirement(s)`}>
            {p.requirements.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No requirements mapped" action={<Btn variant="primary" onClick={() => setModal({ type: 'new' })}>Add the first requirement</Btn>}>
                Paste the judging criteria, mandatory technology requirements, eligibility rules, and submission deliverables. If you do not
                have the official brief, record that fact instead of guessing.
              </EmptyState>
            ) : (
              <div className="stack-sm">
                {p.requirements.map((r, i) => (
                  <div key={r.id} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                    <div className="spread" style={{ alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 5 }}>
                          <span className="mono xs muted">REQ {String(i + 1).padStart(2, '0')}</span>
                          <span className={`badge ${r.mandatory ? 'dark' : 'outline'}`}>{r.mandatory ? 'MANDATORY' : 'OPTIONAL'}</span>
                          <StatusBadge meta={REQUIREMENT_STATUS[r.status]} />
                        </div>
                        <div className="small strong mt8">{r.text}</div>
                        <div className="xs muted mt8">
                          Source: {r.source || 'Not recorded'}{r.sourceUrl ? ' · URL recorded' : ' · no URL'}
                          {r.checkedAt ? ` · checked ${fmtDate(r.checkedAt)}` : ' · not checked'}
                        </div>
                      </div>
                      <div className="row nowrap" style={{ gap: 2 }}>
                        <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'edit', req: r })} aria-label={`Edit requirement ${i + 1}`}><Edit3 size={12} /></Btn>
                        <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('requirements', r.id); pushToast('Requirement removed from the compliance map.'); }} aria-label={`Delete requirement ${i + 1}`}><Trash2 size={12} /></Btn>
                      </div>
                    </div>

                    <div className="grid g2 mt8" style={{ gap: 10 }}>
                      <div>
                        <div className="mono xs muted">MUST IMPLEMENT</div>
                        <div className="xs">{r.mustImplement || 'Not defined.'}</div>
                      </div>
                      <div>
                        <div className="mono xs muted">HOW COMPLIANCE IS SHOWN</div>
                        <div className="xs">{r.demonstration || 'Not defined.'}</div>
                      </div>
                      <div>
                        <div className="mono xs muted">EVIDENCE</div>
                        <div className="xs" style={{ color: r.evidence ? 'inherit' : 'var(--orange)' }}>{r.evidence || 'None recorded — implementation is not proof.'}</div>
                      </div>
                      <div>
                        <div className="mono xs muted">UNRESOLVED QUESTIONS</div>
                        <div className="xs">{r.questions || 'None recorded.'}</div>
                      </div>
                    </div>

                    <div className="row between mt8" style={{ borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
                      <span className="mono xs muted">UPDATE STATUS</span>
                      <select
                        value={r.status}
                        onChange={(e) => {
                          const next = e.target.value;
                          actions.updateItem('requirements', r.id, { status: next }, `Requirement status: ${next.replace('-', ' ')}.`);
                          if (next === 'evidence' && !r.evidence.trim()) pushToast('Status set to evidence provided, but no evidence text is recorded. Add it in Edit.');
                          if (next === 'evidence' && !summary.briefVerified) pushToast('Warning: the official brief is still unverified. Evidence cannot confirm compliance with an unverified rule.');
                        }}
                        aria-label={`Status for requirement ${i + 1}`}
                        style={{ width: 'auto', fontSize: 11, padding: '3px 22px 3px 6px' }}
                      >
                        {Object.entries(REQUIREMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Implementation vs proof" eyebrow="The distinction that matters at judging">
            <div className="table-wrap" style={{ border: 0 }}>
              <table className="table">
                <thead><tr><th>State</th><th>What it means</th><th className="num">Count</th></tr></thead>
                <tbody>
                  <tr><td><StatusBadge meta={REQUIREMENT_STATUS.implemented} /></td><td>The team believes the capability exists. No verifiable demonstration recorded.</td><td className="num">{summary.implemented}</td></tr>
                  <tr><td><StatusBadge meta={REQUIREMENT_STATUS.evidence} /></td><td>The demonstration or artefact is recorded and repeatable.</td><td className="num">{summary.confirmed}</td></tr>
                  <tr><td><StatusBadge meta={REQUIREMENT_STATUS.blocked} /></td><td>A known obstacle prevents compliance.</td><td className="num">{summary.blocked}</td></tr>
                  <tr><td><StatusBadge meta={REQUIREMENT_STATUS.unconfirmed} /></td><td>The requirement itself is not verified against an official source.</td><td className="num">{summary.unconfirmed}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <aside className="stack">
          <Card title="Brief source" eyebrow={summary.briefVerified ? 'Recorded' : 'Not verified'}>
            <div className="stack-sm">
              <div className="spread small"><span className="muted">Source URL</span><span className="truncate" style={{ maxWidth: 150 }}>{p.briefMeta?.sourceUrl || 'None'}</span></div>
              <div className="spread small"><span className="muted">Date checked</span><span>{p.briefMeta?.checkedAt ? fmtDate(p.briefMeta.checkedAt) : 'Not checked'}</span></div>
              <div className="spread small"><span className="muted">Brief text</span><span>{p.officialBrief ? `${p.officialBrief.length} chars` : 'Not recorded'}</span></div>
            </div>
            {p.briefMeta?.sourceUrl && p.briefMeta?.checkedAt ? (
              <div className="mt12"><Notice tone="ok">Brief source recorded. Requirements still need their own evidence.</Notice></div>
            ) : (
              <div className="mt12"><Notice tone="warn">Compliance cannot be claimed. Record the official source and check date first.</Notice></div>
            )}
            <Btn variant="ghost" size="sm" className="block mt12" onClick={() => setBriefOpen(true)}>Edit brief source</Btn>
          </Card>

          {unconfirmedRequirements.length > 0 && (
            <Card title="Needs confirmation" eyebrow="Do not present as official">
              <div className="stack-sm">
                {unconfirmedRequirements.map((r) => (
                  <div key={r.id} className="xs">
                    <span style={{ color: 'var(--orange)' }}>◆</span> {r.text}
                    {r.questions && <div className="muted">{r.questions}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Submission checklist" eyebrow="Derived from mapped requirements">
            {p.requirements.filter((r) => r.mandatory).length === 0 ? (
              <p className="small muted mb0">No mandatory deliverable is mapped yet. Add submission requirements from the official brief.</p>
            ) : (
              <div className="stack-sm">
                {mandatory.map((r) => (
                  <div key={r.id} className="row" style={{ gap: 7, fontSize: 12 }}>
                    <span className={`task-box ${r.status === 'evidence' ? 'done' : ''}`} aria-hidden="true">{r.status === 'evidence' ? <Check size={10} /> : null}</span>
                    <span className={r.status === 'evidence' ? '' : 'muted'}>{r.text.length > 70 ? `${r.text.slice(0, 70)}…` : r.text}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="line" />
            <p className="xs muted mb0">A checked box requires recorded evidence, not a completed plan.</p>
          </Card>

          <Notice tone="warn">
            <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> <b>Never invent judging weights or deadlines.</b> If the official brief
            does not state it, record it as an unresolved question.
          </Notice>
        </aside>
      </div>

      {modal?.type && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'edit' ? 'Edit requirement' : 'Map a requirement'} eyebrow="Compliance map" wide>
          <RequirementForm
            initial={modal.req}
            project={p}
            onCancel={() => setModal(null)}
            onSave={(d) => saveRequirement(d, modal.req)}
          />
        </Modal>
      )}

      {briefOpen && <BriefModal project={p} onClose={() => setBriefOpen(false)} onSave={saveBrief} />}
    </div>
  );
}
