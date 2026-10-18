import React, { useMemo, useState } from 'react';
import { ShieldCheck, Check, X, AlertTriangle, ArrowRight, Plus, FileText, History, Layers, ListChecks, } from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  MissingCase, Badge, Btn, Card, Notice, PageHead, StatusBadge, Track } from '../../components/ui';
import {
  computePassport, coverageOf, evidenceQuality, complianceSummary, scopeHours, highPriorityBlockers,
} from '../../lib/scoring';
import { EVIDENCE_STATUS } from '../../lib/constants';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { uid } from '../../lib/id';

const TONES = {
  ready: { cls: 'green', note: 'Essential requirements and major dependencies are sufficiently addressed for the proposed scope.' },
  conditions: { cls: 'sage', note: 'Viable if the named outstanding items are resolved before building.' },
  reduce: { cls: 'amber', note: 'The plan is too ambitious or carries avoidable dependencies. Cut scope first.' },
  blocked: { cls: 'red', note: 'A critical unknown prevents a responsible build recommendation.' },
  insufficient: { cls: 'outline', note: 'There is not enough checked information to reach a meaningful conclusion.' },
};

export default function Passport() {
  const project = useRouteProject();
  const { actions, pushToast } = useApp();
  const [showHistory, setShowHistory] = useState(false);
  usePageTitle('Buildability Passport');
  const p = project;

  const passport = useMemo(() => (p ? computePassport(p) : null), [p]);
  if (!p) return <MissingCase />;

  const latest = p.passports[p.passports.length - 1];
  const stale = latest && new Date(latest.projectUpdatedAt || 0) < new Date(p.updatedAt);
  const tone = TONES[passport.outcomeKey] || TONES.insufficient;
  const coverage = coverageOf(p);
  const quality = evidenceQuality(p);
  const compliance = complianceSummary(p);
  const blockers = highPriorityBlockers(p);
  const hours = scopeHours(p);
  const failed = passport.checks.filter((c) => !c.pass);

  const record = () => {
    const snapshot = { ...passport, id: uid('psp'), projectUpdatedAt: p.updatedAt, recordedAt: new Date().toISOString() };
    actions.updateProject(p.id, { passports: [...p.passports, snapshot] }, `Buildability Passport recorded: ${passport.outcome}.`);
    pushToast(`Passport recorded: ${passport.outcome}.`);
  };

  return (
    <div>
      <PageHead
        eyebrow={`Case ${p.caseId} · Final dossier`}
        title="Buildability Passport"
        description="A summary of what the investigation can and cannot support. It is not an award for completing missions — a passport stays conditional or blocked when the evidence does."
        actions={<>
          <Btn variant="ghost" to={`/projects/${p.id}/reports`}><FileText size={14} /> Report</Btn>
          <Btn variant="primary" onClick={record}><ShieldCheck size={14} /> Record passport</Btn>
        </>}
      />

      {!latest && (
        <div className="mb16"><Notice tone="warn">
          <b>Not yet recorded.</b> This is a live reading computed from current saved state. Record it to keep a dated version in the project history
          and in the generated report.
        </Notice></div>
      )}
      {latest && stale && (
        <div className="mb16"><Notice tone="warn">
          <b>Project changed since the last recorded passport</b> ({fmtDate(latest.recordedAt)}). The reading below is current; record a new version
          before citing the old one.
        </Notice></div>
      )}

      <div className="grid g-2-1" style={{ alignItems: 'start' }}>
        <div className="stack">
          <section className="passport" aria-label="Buildability Passport">
            <div className="passport-head">
              <div>
                <div className="mono xs" style={{ letterSpacing: '.14em' }}>BUILDSCOPE AI · BUILDABILITY PASSPORT</div>
                <h2 style={{ fontSize: 24, marginTop: 4 }}>{p.name}</h2>
                <div className="mono xs muted">CASE {p.caseId} · {latest ? `RECORDED ${fmtDate(latest.recordedAt).toUpperCase()}` : 'LIVE READING — NOT RECORDED'}</div>
              </div>
              <div className={`passport-stamp ${passport.outcomeKey === 'ready' ? 'ok' : ''}`}>
                RECOMMENDATION
                <strong>{passport.outcome}</strong>
                {passport.passed}/{passport.total} CHECKS
              </div>
            </div>

            <div className="passport-body">
              <p className="small" style={{ maxWidth: '78ch' }}>{tone.note}</p>

              <div className="grid g2 mt16" style={{ gap: 10 }}>
                <div className="passport-fact"><div className="pf-k">Problem</div><div className="pf-v">{p.problem ? `${p.problem.slice(0, 170)}${p.problem.length > 170 ? '…' : ''}` : 'Not defined'}</div></div>
                <div className="passport-fact"><div className="pf-k">Intended users</div><div className="pf-v">{p.targetUsers.join(', ') || 'Not defined'}</div></div>
                <div className="passport-fact"><div className="pf-k">Existing solution coverage</div><div className="pf-v">{coverage.label}{coverage.count ? ` (${coverage.count} records)` : ''}</div></div>
                <div className="passport-fact"><div className="pf-k">Evidence quality</div><div className="pf-v">{quality.label} — {quality.note}</div></div>
                <div className="passport-fact"><div className="pf-k">Differentiation</div><div className="pf-v">{passport.supportedClaims} supported claim(s) of {p.claims.length}</div></div>
                <div className="passport-fact"><div className="pf-k">Official compliance</div><div className="pf-v">{compliance.briefVerified ? `${compliance.status} (${compliance.confirmed}/${compliance.total} evidenced)` : 'NOT VERIFIED — no official brief source'}</div></div>
                <div className="passport-fact"><div className="pf-k">Critical dependencies</div><div className="pf-v">{blockers.depBlockers.length} blocked · {p.feasibility.filter((f) => f.status === 'verified').length} verified</div></div>
                <div className="passport-fact"><div className="pf-k">Scope vs time</div><div className="pf-v">{hours.must}h must-build of {hours.available}h available</div></div>
                <div className="passport-fact"><div className="pf-k">MVP scope</div><div className="pf-v">{p.scope.filter((s) => s.bucket === 'must').length} must-build item(s)</div></div>
                <div className="passport-fact"><div className="pf-k">Demo proof</div><div className="pf-v">{p.acceptance.length} acceptance criteria · {p.acceptance.filter((a) => a.evidenceStatus === 'verified').length} verified</div></div>
              </div>

              <div className="section-rule" style={{ marginTop: 18 }}><span>Why this outcome</span></div>
              <ul className="small" style={{ paddingLeft: 16 }}>
                {passport.reasons.map((r, i) => <li key={i} style={{ marginBottom: 5 }}>{r}</li>)}
              </ul>

              <div className="section-rule"><span>Passport checks</span></div>
              <div className="table-wrap">
                <table className="table" style={{ minWidth: 480 }}>
                  <thead><tr><th>Check</th><th style={{ width: 70 }}>Result</th><th>Detail</th></tr></thead>
                  <tbody>
                    {passport.checks.map((c) => (
                      <tr key={c.id}>
                        <td><span className="row" style={{ gap: 6 }}>{c.pass ? <Check size={13} style={{ color: 'var(--ok)' }} /> : <X size={13} style={{ color: 'var(--orange)' }} />}<span className="small">{c.label}</span></span></td>
                        <td><Badge tone={c.pass ? 'green' : 'orange'}>{c.pass ? 'PASS' : 'FAIL'}</Badge></td>
                        <td className="xs muted">{c.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="section-rule"><span>Next actions</span></div>
              <ol className="small" style={{ paddingLeft: 16 }}>
                {passport.nextActions.map((n, i) => <li key={i} style={{ marginBottom: 5 }}><b>{n.text}</b> — <span className="muted">{n.detail}</span></li>)}
              </ol>

              <div className="section-rule"><span>Source register</span></div>
              {p.evidence.length ? (
                <div className="table-wrap">
                  <table className="table" style={{ minWidth: 480 }}>
                    <thead><tr><th>Source</th><th>Status</th><th>Checked</th></tr></thead>
                    <tbody>
                      {p.evidence.map((e) => (
                        <tr key={e.id}>
                          <td><span className="small">{e.sourceName || e.title}</span><span className="sub">{e.claim}</span></td>
                          <td><StatusBadge meta={EVIDENCE_STATUS[e.verification]} /></td>
                          <td className="mono xs muted">{e.checkedAt ? fmtDate(e.checkedAt) : 'not checked'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="xs muted">No sources recorded.</p>}

              <div className="section-rule"><span>Limitations and uncertainty</span></div>
              <ul className="xs muted" style={{ paddingLeft: 16 }}>
                {p.limitations && <li>{p.limitations}</li>}
                {!compliance.briefVerified && <li>The official competition brief has not been verified against a source.</li>}
                {failed.map((f) => <li key={f.id}>{f.label}: {f.detail}</li>)}
                {p.evidence.filter((e) => e.demo).length > 0 && <li>{p.evidence.filter((e) => e.demo).length} demo fixture(s) are excluded from evidence strength.</li>}
                <li>Public repositories cannot reveal all private, commercial, unpublished, or undiscovered work.</li>
              </ul>

              <div className="row between mt16" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <span className="mono xs muted">GENERATED FROM SAVED PROJECT STATE · NOT A GUARANTEE</span>
                <span className="mono xs muted">{fmtDate(passport.generatedAt).toUpperCase()}</span>
              </div>
            </div>
          </section>

          <Card title={`Recorded passports (${p.passports.length})`} eyebrow="Dated history" actions={<Btn variant="quiet" size="sm" onClick={() => setShowHistory((v) => !v)}><History size={13} /> {showHistory ? 'Hide' : 'Show'}</Btn>}>
            {p.passports.length === 0 ? (
              <p className="small muted mb0">No passport has been recorded yet. Recording stores the current checks and recommendation against this case.</p>
            ) : showHistory ? (
              <div className="stack-sm">
                {[...p.passports].reverse().map((ps) => (
                  <div key={ps.id} className="spread" style={{ alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div className="row" style={{ gap: 5 }}>
                        <span className="mono xs">{fmtDateTime(ps.recordedAt)}</span>
                        <Badge tone={(TONES[ps.outcomeKey] || TONES.insufficient).cls}>{ps.outcome}</Badge>
                      </div>
                      <div className="xs muted">{ps.passed}/{ps.total} checks · {ps.verifiedEvidence} verified sources</div>
                    </div>
                    <span className="mono xs muted">{fmtDate(ps.projectUpdatedAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="spread">
                <div>
                  <div className="small strong">Latest: {latest?.outcome}</div>
                  <div className="xs muted">{latest ? `${fmtDateTime(latest.recordedAt)} · ${latest.passed}/${latest.total} checks` : '—'}</div>
                </div>
                <Badge tone={(TONES[latest?.outcomeKey] || TONES.insufficient).cls}>RECORDED</Badge>
              </div>
            )}
          </Card>
        </div>

        <aside className="stack">
          <Card title="Reading the outcome" eyebrow="Not a completion badge">
            <div className="stack-sm">
              {[
                ['READY TO BUILD', 'green', 'Essential requirements, evidence, and dependencies addressed for this scope.'],
                ['READY WITH CONDITIONS', 'sage', 'Viable only if named outstanding items are resolved.'],
                ['SCOPE REDUCTION REQUIRED', 'amber', 'The plan is too ambitious or depends on avoidable integrations.'],
                ['BLOCKED — INVESTIGATE FIRST', 'red', 'A critical unknown prevents a responsible recommendation.'],
                ['INSUFFICIENT EVIDENCE', 'outline', 'Not enough checked information to conclude anything.'],
              ].map(([label, cls, hint]) => (
                <div key={label}>
                  <Badge tone={cls}>{label}</Badge>
                  <div className="xs muted mt8" style={{ marginTop: 3 }}>{hint}</div>
                </div>
              ))}
            </div>
            <div className="line" />
            <p className="xs muted mb0">
              Completing missions does not earn a positive passport. The outcome is recomputed from evidence, feasibility, requirements,
              and scope every time.
            </p>
          </Card>

          <Card title="Blocking checks" eyebrow={`${failed.length} failing`}>
            {failed.length === 0 ? (
              <p className="small" style={{ color: 'var(--ok)' }}>Every passport check passes. Re-check after any material change.</p>
            ) : (
              <div className="stack-sm">
                {failed.slice(0, 6).map((f) => (
                  <div key={f.id} className="row" style={{ gap: 7, alignItems: 'flex-start' }}>
                    <AlertTriangle size={12} style={{ color: 'var(--orange)', marginTop: 2, flex: '0 0 auto' }} />
                    <div>
                      <div className="small">{f.label}</div>
                      <div className="xs muted">{f.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Dossier coverage" eyebrow="What feeds the passport">
            <div className="stack-sm">
              {[
                ['Verified sources', p.evidence.filter((e) => e.verification === 'verified' && !e.demo).length, '/ 3 needed'],
                ['Feasibility', p.feasibility.filter((f) => f.status === 'verified').length, '/ 1 verified needed'],
                ['Claims', p.claims.filter((c) => c.status === 'supported').length, 'supported'],
                ['Requirements', compliance.confirmed, `/ ${compliance.total} evidenced`],
                ['Acceptance', p.acceptance.length, 'criteria'],
              ].map(([label, n, suffix]) => (
                <div key={label} className="spread small">
                  <span className="muted">{label}</span>
                  <span><b>{n}</b> <span className="xs muted">{suffix}</span></span>
                </div>
              ))}
            </div>
            <div className="mt12"><Track done={passport.passed} total={passport.total} thin /></div>
            <Btn variant="ghost" size="sm" className="block mt12" to={`/projects/${p.id}/reports`}>Open report workspace <ArrowRight size={12} /></Btn>
          </Card>

          <div className="card graphite">
            <div className="eyebrow" style={{ color: '#aab39f' }}>Reminder</div>
            <p className="small" style={{ color: '#eeece2', marginBottom: 6 }}>
              The passport records uncertainty honestly. A conditional outcome is useful information — not a failure of the team.
            </p>
            <div className="mono xs" style={{ color: '#9aa28f' }}>EVIDENCE BEFORE CONFIDENCE</div>
          </div>

          <Card title="Add missing evidence" eyebrow="Fast paths to a stronger passport">
            <div className="stack-sm">
              <Btn variant="ghost" size="sm" to={`/projects/${p.id}/prior-art`}><Layers size={13} /> Record a checked source</Btn>
              <Btn variant="ghost" size="sm" to={`/projects/${p.id}/feasibility`}><ListChecks size={13} /> Verify a dependency</Btn>
              <Btn variant="ghost" size="sm" to={`/projects/${p.id}/requirements`}><Plus size={13} /> Verify the official brief</Btn>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
