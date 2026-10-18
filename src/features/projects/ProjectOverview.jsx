import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, ArrowRight, Radar, GitCompare, FlaskConical, ClipboardCheck, GraduationCap, FileText } from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import { Btn, Card, MissingCase, Notice, PageHead, StatusBadge, Track } from '../../components/ui';
import {
  buildMissions, missionProgress, activeMission, coverageOf, evidenceQuality, complianceSummary, nextAction, highPriorityBlockers,
} from '../../lib/scoring';
import { fmtDate, relativeTime } from '../../lib/format';

export default function ProjectOverview() {
  const project = useRouteProject();
  const { state } = useApp();
  const p = project;

  const missions = useMemo(() => (p ? buildMissions(p) : []), [p]);
  const progress = useMemo(() => missionProgress(missions), [missions]);
  const next = p ? nextAction(p, missions) : null;
  usePageTitle(p ? p.name : 'Case not found');

  if (!p) return <MissingCase />;

  const coverage = coverageOf(p);
  const quality = evidenceQuality(p);
  const compliance = complianceSummary(p);
  const blockers = highPriorityBlockers(p);
  const active = activeMission(missions);
  const activity = state.activity.filter((a) => a.projectId === p.id).slice(0, 5);

  return (
    <div>
      <PageHead
        eyebrow={`Case ${p.caseId} · opened ${fmtDate(p.createdAt)}`}
        title={p.name}
        description={p.problem ? p.problem.slice(0, 180) + (p.problem.length > 180 ? '…' : '') : 'No problem statement yet. Complete the brief to start the investigation.'}
        actions={<>
          <Btn variant="ghost" to={`/projects/${p.id}/edit`}><Edit3 size={14} /> Edit brief</Btn>
          <Btn variant="ghost" to={`/projects/${p.id}/prior-art`}><Radar size={14} /> Prior Art Lab</Btn>
          <Btn variant="primary" to={`/projects/${p.id}/passport`}>Passport <ArrowRight size={14} /></Btn>
        </>}
      />

      <div className="card mb16" style={{ padding: '14px 18px' }}>
        <div className="grid g4" style={{ gap: 16 }}>
          <div>
            <div className="eyebrow">Investigation stage</div>
            <div className="strong" style={{ marginTop: 3 }}>{active?.code} · {active?.title}</div>
            <div className="mt8"><Track done={progress.done} total={progress.total} thin /></div>
          </div>
          <div>
            <div className="eyebrow">Existing solutions</div>
            <div style={{ marginTop: 5 }}><StatusBadge meta={{ label: coverage.label, cls: coverage.cls }} /></div>
            <div className="xs muted mt8">{p.repositories.length} repositories · {p.solutions.length} other leads</div>
          </div>
          <div>
            <div className="eyebrow">Evidence quality</div>
            <div style={{ marginTop: 5 }}><StatusBadge meta={{ label: quality.label, cls: quality.cls }} /></div>
            <div className="xs muted mt8">{quality.note}</div>
          </div>
          <div>
            <div className="eyebrow">Official requirements</div>
            <div style={{ marginTop: 5 }}><StatusBadge meta={{ label: compliance.briefVerified ? compliance.status : 'NOT VERIFIED', cls: compliance.briefVerified ? 'amber' : 'orange' }} /></div>
            <div className="xs muted mt8">{compliance.total} mapped · {compliance.confirmed} evidenced</div>
          </div>
        </div>
      </div>

      <div className="grid g-2-1">
        <div className="stack">
          <Card title="The brief" eyebrow="Working definition">
            <div className="stack">
              <div>
                <div className="eyebrow plain">Problem</div>
                <p>{p.problem || <span className="muted">Not written yet.</span>}</p>
              </div>
              <div>
                <div className="eyebrow plain">Proposed solution</div>
                <p>{p.solution || <span className="muted">Not written yet.</span>}</p>
              </div>
              <div>
                <div className="eyebrow plain">Target users</div>
                <div className="chip-row mt8">
                  {p.targetUsers.length ? p.targetUsers.map((u) => <span className="tag" key={u}>{u}</span>) : <span className="muted small">Not defined.</span>}
                </div>
              </div>
              <div>
                <div className="eyebrow plain">Demo outcome</div>
                <p className="mb0">{p.desiredOutcome || <span className="muted">Not defined.</span>}</p>
              </div>
              <div className="card card-tight" style={{ background: 'var(--sage)', borderColor: 'var(--sage-mid)' }}>
                <div className="eyebrow plain">Differentiation hypothesis</div>
                <p className="small mb0 mt8">{p.believedDifferentiation || 'No hypothesis recorded. Mission 02 turns this into testable claims.'}</p>
                <div className="mono xs muted mt8">HYPOTHESIS — NOT PROVEN NOVELTY</div>
              </div>
              {p.limitations && (
                <div>
                  <div className="eyebrow plain">Known limitations</div>
                  <p className="small muted mb0">{p.limitations}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title={`Core features (${p.features.length})`} eyebrow="Proposed capabilities" actions={<Btn variant="quiet" size="sm" to={`/projects/${p.id}/edit`}>Edit</Btn>}>
            {p.features.length ? (
              <div className="table-wrap" style={{ border: 0 }}>
                <table className="table">
                  <thead><tr><th>Feature</th><th>Description</th><th style={{ width: 90 }}>Scope</th></tr></thead>
                  <tbody>
                    {p.features.map((f) => (
                      <tr key={f.id}>
                        <td className="cell-title">{f.name}</td>
                        <td className="muted">{f.description || '—'}</td>
                        <td><span className={`badge ${f.essential ? 'dark' : 'outline'}`}>{f.essential ? 'Essential' : 'Optional'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted small mb0">No features defined. Add the capabilities needed for the end-to-end demo.</p>}
          </Card>

          <div className="grid g3">
            {[
              { to: 'prior-art', icon: Radar, code: '03', title: 'Prior Art Lab', sub: `${p.repositories.length + p.solutions.length} leads recorded` },
              { to: 'differentiation', icon: GitCompare, code: '04', title: 'Differentiation', sub: `${p.claims.length} claims · ${p.claims.filter((c) => c.status === 'supported').length} supported` },
              { to: 'feasibility', icon: FlaskConical, code: '05', title: 'Feasibility Lab', sub: `${blockers.count} blocker(s) · ${p.risks.length} risks` },
              { to: 'requirements', icon: ClipboardCheck, code: '06', title: 'Requirements', sub: compliance.briefVerified ? `${compliance.total} mapped` : 'Brief not verified' },
              { to: 'learning', icon: GraduationCap, code: '07', title: 'Learning Hub', sub: `${p.skillGaps.length} skill gaps` },
              { to: 'reports', icon: FileText, code: '09', title: 'Reports', sub: `${p.reports.length} generated` },
            ].map((m) => (
              <Link key={m.to} to={`/projects/${p.id}/${m.to}`} className="card card-tight card-hover" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="spread"><m.icon size={16} style={{ color: 'var(--field)' }} /><span className="mono xs muted">{m.code}</span></div>
                <div className="strong mt8" style={{ fontSize: 13 }}>{m.title}</div>
                <div className="xs muted">{m.sub}</div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="stack">
          <Card title="Case health" eyebrow="Derived from saved evidence">
            <div className="stack-sm">
              <div className="spread small"><span className="muted">Mission progress</span><strong>{progress.pct}%</strong></div>
              <Track done={progress.done} total={progress.total} thin />
              <div className="spread small" style={{ marginTop: 6 }}><span className="muted">Verified sources</span><strong>{p.evidence.filter((e) => e.verification === 'verified' && !e.demo).length}</strong></div>
              <div className="spread small"><span className="muted">High-priority blockers</span><strong style={{ color: blockers.count ? 'var(--orange)' : 'var(--ok)' }}>{blockers.count}</strong></div>
              <div className="spread small"><span className="muted">Open skill gaps</span><strong>{p.skillGaps.filter((g) => g.resolution !== 'resolved').length}</strong></div>
              <div className="spread small"><span className="muted">Reports generated</span><strong>{p.reports.length}</strong></div>
            </div>
            <div className="line" />
            <div className="eyebrow">Recommended next</div>
            <p className="small" style={{ marginTop: 6 }}>{next.reason}</p>
            <Btn variant="primary" size="sm" to={next.to} className="block">{next.label} <ArrowRight size={13} /></Btn>
          </Card>

          {!compliance.briefVerified && (
            <Notice tone="warn">
              <strong>Official requirements not verified.</strong> No official brief source or check date is recorded for this case.
              Do not claim compliance yet.
            </Notice>
          )}

          <Card title="Constraints" eyebrow="Declared by the team">
            <dl className="stack-sm" style={{ margin: 0 }}>
              {[
                ['Team', `${p.teamSize} people · ${p.timeAvailable}h each`],
                ['Stack', p.stack.join(', ') || 'Not specified'],
                ['Budget', p.budget || 'Not specified'],
                ['Data sources', p.dataSources || 'Not specified'],
                ['External services', p.externalServices || 'Not specified'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow plain">{k}</dt>
                  <dd className="small mb0" style={{ margin: 0 }}>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Latest activity" eyebrow="Local audit trail">
            {activity.length ? (
              <ul className="activity">
                {activity.map((a) => (
                  <li key={a.id}>
                    <span className="timeline-dot done" aria-hidden="true" />
                    <div className="a-body">{a.message}</div>
                    <span className="a-time">{relativeTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted mb0">No activity recorded yet.</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
