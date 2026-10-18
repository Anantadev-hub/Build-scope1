import React, { useMemo, useState } from 'react';
import { Plus, GitCompare, Edit3, Trash2, Link2, ArrowRight, Check, Quote, } from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  MissingCase, Btn, Card, EmptyState, Field, Modal, Notice, PageHead, StatusBadge } from '../../components/ui';
import { differentiationClaim } from '../../lib/models';
import { CLAIM_STATUS, CLAIM_TYPES, EVIDENCE_STATUS } from '../../lib/constants';
import { fmtDate } from '../../lib/format';

function recommendationFor(c, evidence) {
  const linked = (c.evidenceIds || []).map((id) => evidence.find((e) => e.id === id)).filter(Boolean);
  const real = linked.filter((e) => !e.demo && e.seeded !== true && e.verification !== 'unverified');
  if (c.status === 'contradicted') return { move: 'Revise or remove this claim', detail: 'Evidence currently contradicts it. Rewrite the claim around what remains true, or drop it.' };
  if (c.status === 'weak') return { move: 'Narrow the target user or workflow', detail: 'This reads like a commodity capability. A narrower audience or a more specific handoff may be defensible.' };
  if (c.status === 'research') return { move: 'Investigate an existing alternative further', detail: 'The claim cannot be assessed with the current material. Check one more alternative before spending build time.' };
  if (c.status === 'plausible') return { move: 'Find stronger evidence', detail: manualDetail(c) };
  if (c.status === 'supported' && real.length === 0) return { move: 'Link checked evidence', detail: 'The claim is marked supported but no independently checked source is linked. That is an assertion, not evidence.' };
  if (c.status === 'supported') return { move: 'Keep — rehearse the demo proof', detail: c.demoProof || 'Define exactly what a judge will see that proves this claim.' };
  return { move: 'Record a status for this claim', detail: 'An unclassified claim cannot guide the build.' };
}

function manualDetail(c) {
  return c.validationAction || 'Run a small validation step: ask a target user, check a live alternative, or test the workflow yourself.';
}

function ClaimForm({ initial, evidence, onSave, onCancel }) {
  const [f, setF] = useState({
    claim: initial?.claim || '',
    type: initial?.type || 'Other',
    status: initial?.status || 'research',
    confidence: initial?.confidence || 'Low',
    alternativesExamined: initial?.alternativesExamined || '',
    openQuestions: initial?.openQuestions || '',
    validationAction: initial?.validationAction || '',
    demoProof: initial?.demoProof || '',
    notes: initial?.notes || '',
    evidenceIds: initial?.evidenceIds || [],
  });
  const [err, setErr] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.claim.trim()) { setErr('State the differentiator as a specific claim, not a feature name.'); return; }
    if (f.status === 'supported' && f.evidenceIds.length === 0) { setErr('A claim marked evidence-supported needs at least one linked evidence record. Choose evidence below, or mark it plausible but unverified.'); return; }
    onSave(f);
  };

  return (
    <form onSubmit={submit}>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <Field label="Differentiation claim" required htmlFor="claim-text">
        <textarea id="claim-text" rows={2} value={f.claim} onChange={(e) => set({ claim: e.target.value })} placeholder="We do X for Y, which existing Z does not document." />
      </Field>
      <div className="form-grid mt12">
        <Field label="Dimension" htmlFor="claim-type">
          <select id="claim-type" value={f.type} onChange={(e) => set({ type: e.target.value })}>{CLAIM_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Status" htmlFor="claim-status">
          <select id="claim-status" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            {Object.entries(CLAIM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Confidence" hint="Based on what you checked, not how much you like the idea." htmlFor="claim-confidence">
          <select id="claim-confidence" value={f.confidence} onChange={(e) => set({ confidence: e.target.value })}>
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
        </Field>
        <Field label="Alternatives examined" htmlFor="claim-alts">
          <input id="claim-alts" type="text" value={f.alternativesExamined} onChange={(e) => set({ alternativesExamined: e.target.value })} placeholder="Which records did you actually compare?" />
        </Field>
      </div>
      <div className="mt12">
        <div className="label" style={{ marginBottom: 5 }}>Linked evidence</div>
        {evidence.length === 0 ? (
          <p className="xs muted mb0">No evidence records yet. Save sources in the Prior Art Lab before marking a claim supported.</p>
        ) : (
          <div className="stack-sm" style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--line)', padding: 9, background: 'var(--surface-2)' }}>
            {evidence.map((e) => (
              <label key={e.id} className="check">
                <input
                  type="checkbox"
                  checked={f.evidenceIds.includes(e.id)}
                  onChange={(e2) => set({ evidenceIds: e2.target.checked ? [...f.evidenceIds, e.id] : f.evidenceIds.filter((x) => x !== e.id) })}
                />
                <span className="xs">
                  {e.sourceName || e.title} — <span className="muted">{EVIDENCE_STATUS[e.verification]?.label}</span>
                  {e.demo && <span className="badge demo" style={{ marginLeft: 5 }}>DEMO — NOT EVIDENCE</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="mt12">
        <Field label="Open questions" htmlFor="claim-q">
          <textarea id="claim-q" rows={2} value={f.openQuestions} onChange={(e) => set({ openQuestions: e.target.value })} placeholder="What would change your mind? What is still unverified?" />
        </Field>
      </div>
      <div className="form-grid mt12">
        <Field label="Validation action" htmlFor="claim-action">
          <textarea id="claim-action" rows={2} value={f.validationAction} onChange={(e) => set({ validationAction: e.target.value })} placeholder="One concrete next step." />
        </Field>
        <Field label="Demo proof required" htmlFor="claim-proof">
          <textarea id="claim-proof" rows={2} value={f.demoProof} onChange={(e) => set({ demoProof: e.target.value })} placeholder="What a judge must see to believe it." />
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={submit}>Save claim</Btn>
      </div>
    </form>
  );
}

export default function Differentiation() {
  const project = useRouteProject();
  const { actions, pushToast } = useApp();
  usePageTitle('Differentiation');
  const [modal, setModal] = useState(null);
  const p = project;

  const counts = useMemo(() => {
    const c = { supported: 0, plausible: 0, weak: 0, contradicted: 0, research: 0 };
    (p?.claims || []).forEach((x) => { c[x.status] = (c[x.status] || 0) + 1; });
    return c;
  }, [p]);

  if (!p) return <MissingCase />;

  const selectedIds = p.comparison?.selectedIds || [];
  const alternatives = [...p.repositories, ...p.solutions].filter((a) => selectedIds.includes(a.id));
  const evidenceFor = (c) => (c.evidenceIds || []).map((id) => p.evidence.find((e) => e.id === id)).filter(Boolean);
  const readiness = [
    ['Problem is defined specifically', p.problem.trim().length > 60],
    ['Target users are specific', p.targetUsers.length > 0 && !p.targetUsers.includes('Everyone')],
    ['Alternatives have been selected', selectedIds.length > 0],
    ['Comparison has been confirmed', Boolean(p.comparison?.confirmedAt)],
    ['A differentiator is evidence-supported', p.claims.some((c) => c.status === 'supported')],
    ['At least one unchecked claim is documented', p.claims.some((c) => ['plausible', 'research', 'weak'].includes(c.status))],
  ];

  const saveClaim = (data, existing) => {
    if (existing) {
      actions.updateItem('claims', existing.id, data, `Differentiation claim updated: ${data.claim.slice(0, 60)}.`);
      pushToast('Claim updated.');
    } else {
      actions.addItem('claims', differentiationClaim(data), `Differentiation claim recorded: ${data.claim.slice(0, 60)}.`);
      pushToast('Claim recorded. Link evidence before calling it supported.');
    }
    setModal(null);
  };

  return (
    <div>
      <PageHead
        eyebrow="04 · Find your edge"
        title="Differentiation"
        description="The goal is not to prove the idea is novel. It is to identify what is genuinely distinct, why it matters to a specific user, and whether it can be demonstrated in the time available."
        actions={<Btn variant="primary" onClick={() => setModal({ type: 'claim' })}><Plus size={14} /> Add differentiator</Btn>}
      />

      <div className="grid g4 mb16">
        {[
          ['Evidence-supported', counts.supported, 'green'],
          ['Plausible, unverified', counts.plausible, 'amber'],
          ['Weak or generic', counts.weak, 'orange'],
          ['Needs research', counts.research, 'outline'],
        ].map(([label, n, tone]) => (
          <div key={label} className="card card-tight">
            <div className="eyebrow plain">{label}</div>
            <div className="spread" style={{ alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 600 }}>{n}</span>
              <span className={`dot ${tone === 'green' ? 'green' : tone === 'amber' ? 'amber' : tone === 'orange' ? 'orange' : ''}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid g-2-1" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Notice tone="warn">
            <b>No novelty score is calculated.</b> A percentage would imply a complete search of all public, private, and
            unpublished work. Instead, each claim carries a status, the alternatives examined, and the evidence behind it.
          </Notice>

          {p.claims.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={GitCompare}
                title="No differentiation claims yet"
                action={<Btn variant="primary" onClick={() => setModal({ type: 'claim' })}><Plus size={14} /> Record the first claim</Btn>}
              >
                Start from the hypothesis in your brief, then mark how well the reviewed alternatives support it. “Not found”
                in a review is a research limit, not proof of novelty.
              </EmptyState>
            </div>
          ) : (
            <div className="stack">
              {p.claims.map((c, i) => {
                const linked = evidenceFor(c);
                const real = linked.filter((e) => !e.demo && e.verification !== 'unverified');
                const rec = recommendationFor(c, p.evidence);
                return (
                  <article key={c.id} className="card">
                    <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="eyebrow">Claim {String(i + 1).padStart(2, '0')} · {c.type}{c.confidence ? ` · ${c.confidence} confidence` : ''}</div>
                        <h3 style={{ fontSize: 17, marginTop: 4, maxWidth: '58ch' }}>{c.claim}</h3>
                      </div>
                      <div className="row nowrap">
                        <StatusBadge meta={CLAIM_STATUS[c.status]} />
                        <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'edit', claim: c })} aria-label="Edit claim"><Edit3 size={13} /></Btn>
                        <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('claims', c.id); pushToast('Claim removed.'); }} aria-label="Delete claim"><Trash2 size={13} /></Btn>
                      </div>
                    </div>

                    <div className="grid g2 mt12" style={{ gap: 14 }}>
                      <div>
                        <div className="mono xs muted">ALTERNATIVES EXAMINED</div>
                        <div className="small">{c.alternativesExamined || 'None recorded. The claim has no comparison baseline yet.'}</div>
                      </div>
                      <div>
                        <div className="mono xs muted">LINKED EVIDENCE</div>
                        {linked.length ? (
                          <div className="stack-sm">
                            {linked.map((e) => (
                              <div key={e.id} className="row" style={{ gap: 5, fontSize: 11.5 }}>
                                <Link2 size={11} style={{ color: 'var(--field)' }} />
                                <span>{e.sourceName || e.title}</span>
                                <StatusBadge meta={EVIDENCE_STATUS[e.verification]} />
                              </div>
                            ))}
                            {real.length === 0 && <span className="xs" style={{ color: 'var(--orange)' }}>No checked, non-demo evidence is linked.</span>}
                          </div>
                        ) : <span className="small muted">None. This is an assumption until evidence is linked.</span>}
                      </div>
                    </div>

                    <div className="grid g2 mt12" style={{ gap: 14 }}>
                      {c.openQuestions && (
                        <div className="evidence-strip">
                          <div className="mono xs muted">OPEN QUESTIONS</div>
                          <div className="xs">{c.openQuestions}</div>
                        </div>
                      )}
                      {c.demoProof && (
                        <div className="evidence-strip" style={{ borderLeftColor: 'var(--orange)' }}>
                          <div className="mono xs muted">DEMO PROOF REQUIRED</div>
                          <div className="xs">{c.demoProof}</div>
                        </div>
                      )}
                    </div>

                    <div className="card-tight mt12" style={{ background: 'var(--sage)', border: '1px solid var(--sage-mid)' }}>
                      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                        <ArrowRight size={13} style={{ marginTop: 2, color: '#46503f', flex: '0 0 auto' }} />
                        <div>
                          <span className="mono xs" style={{ letterSpacing: '.06em' }}>RECOMMENDED MOVE</span>
                          <div className="small strong">{rec.move}</div>
                          <div className="xs muted">{rec.detail}</div>
                        </div>
                      </div>
                    </div>
                    {c.validationAction && <div className="xs muted mt8"><b>Validation action:</b> {c.validationAction}</div>}
                  </article>
                );
              })}
            </div>
          )}

          <Card title="Claim readiness" eyebrow="What a defensible position requires">
            <div className="stack-sm">
              {readiness.map(([label, ok]) => (
                <div key={label} className="row" style={{ gap: 8, fontSize: 12.5 }}>
                  <span className={`task-box ${ok ? 'done' : ''}`} aria-hidden="true">{ok ? <Check size={10} /> : null}</span>
                  <span className={ok ? '' : 'muted'}>{label}</span>
                </div>
              ))}
            </div>
            <div className="line" />
            <p className="xs muted mb0">
              The first two checks are self-assessment. The rest derive from saved comparison and evidence records.
            </p>
          </Card>
        </div>

        <aside className="stack">
          <Card title="Comparison baseline" eyebrow="From Prior Art Lab">
            {alternatives.length ? (
              <div className="stack-sm">
                {alternatives.map((a) => (
                  <div key={a.id} className="spread" style={{ gap: 8 }}>
                    <span className="small">{a.name}{a.demo ? <span className="badge demo" style={{ marginLeft: 5 }}>DEMO</span> : null}</span>
                    <span className="mono xs muted">{a.overlap || 'unrated'}</span>
                  </div>
                ))}
                <div className="mono xs muted mt8">{p.comparison?.confirmedAt ? `CONFIRMED ${fmtDate(p.comparison.confirmedAt).toUpperCase()}` : 'NOT CONFIRMED'}</div>
              </div>
            ) : (
              <p className="small muted mb0">No alternatives selected yet. A differentiation claim without a comparison baseline is a guess.</p>
            )}
            <Btn variant="ghost" size="sm" className="block mt12" to={`/projects/${p.id}/prior-art`}>Open Prior Art Lab <ArrowRight size={12} /></Btn>
          </Card>

          <Card title="Evidence available" eyebrow="Link claims to these records">
            {p.evidence.length ? (
              <div className="stack-sm scroll-list">
                {p.evidence.map((e) => (
                  <div key={e.id} className="evidence-strip">
                    <div className="small">{e.sourceName || e.title}</div>
                    <div className="row" style={{ gap: 5 }}>
                      <StatusBadge meta={EVIDENCE_STATUS[e.verification]} />
                      {e.demo && <span className="badge demo">DEMO</span>}
                    </div>
                    <div className="xs muted clamp-2">{e.claim}</div>
                  </div>
                ))}
              </div>
            ) : <p className="small muted mb0">No evidence recorded. Claims cannot be supported without it.</p>}
          </Card>

          <Card title="What would weaken this?" eyebrow="Pre-mortem">
            <ul className="small muted" style={{ paddingLeft: 16, margin: 0 }}>
              <li>A live product already implements the handoff record.</li>
              <li>Recyclers do not value the record, only the material.</li>
              <li>The differentiator cannot be shown in under five minutes.</li>
              <li>The team runs out of time before the workflow closes.</li>
            </ul>
            <p className="xs muted mt12 mb0">Record these as open questions on the relevant claim, then test one before building.</p>
          </Card>

          <div className="card graphite">
            <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <Quote size={15} style={{ color: 'var(--amber)', flex: '0 0 auto', marginTop: 2 }} />
              <div>
                <div className="small" style={{ color: '#f0ede3' }}>
                  “No similar repository found in this search is not proof of originality.”
                </div>
                <div className="mono xs mt8" style={{ color: '#9aa28f' }}>FIELD NOTE · RECONNAISSANCE</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.type === 'edit' ? 'Edit differentiation claim' : 'Record a differentiator'} eyebrow="Claims & evidence" wide>
          <ClaimForm
            initial={modal.claim}
            evidence={p.evidence}
            onCancel={() => setModal(null)}
            onSave={(data) => saveClaim(data, modal.claim)}
          />
        </Modal>
      )}
    </div>
  );
}
