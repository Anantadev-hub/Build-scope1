import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Radar, GitCompare, FlaskConical, ClipboardCheck, GraduationCap,
  AlertTriangle, FileText, Trophy, Check, Plus, FolderOpen,
} from 'lucide-react';
import { useApp } from '../../app/store';
import { usePageTitle } from '../../app/hooks';
import { ACHIEVEMENT_DEFS } from '../../lib/constants';
import {
  buildMissions, missionProgress, activeMission, rankFor, totalXp, coverageOf,
  evidenceQuality, complianceSummary, highPriorityBlockers, nextAction, computePassport, scopeHours,
} from '../../lib/scoring';
import { riskPriority } from '../../lib/models';
import { fmtDate, relativeTime } from '../../lib/format';
import { Badge, Btn, Card, EmptyState, Notice, StatusBadge, Track } from '../../components/ui';
import { DEMO_HACKATHONS } from '../../data/demo';

const MISSION_ROUTES = {
  recon: 'prior-art',
  edge: 'differentiation',
  stress: 'feasibility',
  demo: 'feasibility?tab=scope',
  release: 'passport',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function MissionControl() {
  const { state, project } = useApp();
  usePageTitle('Mission Control');
  const p = project;
  const missions = useMemo(() => (p ? buildMissions(p) : []), [p]);
  const progress = useMemo(() => missionProgress(missions), [missions]);

  if (!p) {
    return (
      <div>
        <div className="page-head">
          <div>
            <div className="eyebrow">Mission Control</div>
            <h1>No active investigation</h1>
            <p>A case file holds the brief, evidence, risks, learning plan, and passport for one idea. Open one to begin.</p>
          </div>
        </div>
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="Mission Control is waiting for a case"
            action={<div className="row" style={{ justifyContent: 'center' }}>
              <Btn variant="primary" to="/projects/new"><Plus size={15} /> Open a case file</Btn>
              <Btn variant="ghost" to="/projects">My Projects</Btn>
            </div>}
          >
            You can explore the worked Kabadiwala Connect example from My Projects, or start a blank investigation with the guided brief.
          </EmptyState>
        </div>
      </div>
    );
  }

  const active = activeMission(missions);
  const xp = totalXp(state, p.id);
  const rank = rankFor(xp);
  const next = nextAction(p, missions);
  const coverage = coverageOf(p);
  const quality = evidenceQuality(p);
  const compliance = complianceSummary(p);
  const blockers = highPriorityBlockers(p);
  const hours = scopeHours(p);
  const passport = computePassport(p);
  const activity = state.activity.filter((a) => a.projectId === p.id).slice(0, 6);
  const xpRecent = state.xpEvents.filter((e) => e.projectId === p.id).slice(-4).reverse();
  const earned = state.achievements;
  const earnedKeys = new Set(earned.map((a) => a.key));
  const tracked = state.hackathonTracking.filter((t) => t.projectId === p.id);
  const latestReport = p.reports[p.reports.length - 1];
  const latestPassport = p.passports[p.passports.length - 1];
  const supportedClaims = p.claims.filter((c) => c.status === 'supported').length;
  const learningActive = state.learningProgress.filter((l) => l.projectId === p.id && l.status !== 'Completed').length;

  const ledger = [
    { label: 'Existing solutions', value: `${p.repositories.length + p.solutions.length}`, sub: coverage.label, to: 'prior-art' },
    { label: 'Differentiators', value: `${supportedClaims}/${p.claims.length}`, sub: 'evidence-supported claims', to: 'differentiation' },
    { label: 'Verified sources', value: `${p.evidence.filter((e) => e.verification === 'verified' && !e.demo).length}`, sub: `${p.evidence.length} recorded · ${quality.label.toLowerCase()}`, to: 'prior-art' },
    { label: 'Blockers', value: `${blockers.count}`, sub: 'high or critical', to: 'feasibility' },
    { label: 'Requirements', value: `${compliance.confirmed}/${compliance.total}`, sub: compliance.briefVerified ? 'evidenced' : 'brief unverified', to: 'requirements' },
    { label: 'Learning open', value: `${p.skillGaps.filter((g) => g.resolution !== 'resolved').length}`, sub: `${learningActive} in progress`, to: 'learning' },
  ];

  return (
    <div>
      <div className="spread mb16" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow">Mission Control · {fmtDate(new Date().toISOString())}</div>
          <h1 style={{ marginTop: 4 }}>{greeting()}, investigator.</h1>
          <p className="small muted" style={{ margin: '5px 0 0' }}>
            Working case <strong>{p.caseId} · {p.name}</strong>. {next.reason}
          </p>
        </div>
        <div className="row">
          <Btn variant="ghost" to={`/projects/${p.id}`}>Open case file</Btn>
          <Btn variant="primary" to={next.to}>{next.label} <ArrowRight size={14} /></Btn>
        </div>
      </div>

      {p.evidence.filter((e) => e.verification === 'verified' && !e.demo).length === 0 && (
        <div className="mb16">
          <Notice tone="warn">
            <strong>No independently checked source is recorded.</strong> Demo fixtures and team assertions do not count as verification.
            The passport will not progress past “insufficient evidence” until at least one source is checked and recorded.
          </Notice>
        </div>
      )}

      <div className="grid g-2-1">
        <div className="stack">
          {/* Rank strip */}
          <div className="card graphite" style={{ padding: '16px 18px' }}>
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 18 }}>
              <div>
                <div className="eyebrow" style={{ color: '#aab39f' }}>Field rank</div>
                <div className="row" style={{ alignItems: 'baseline', gap: 9, marginTop: 3 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: '#f4f1e8' }}>{rank.current.name}</span>
                  <span className="mono xs" style={{ color: 'var(--amber)' }}>{xp} XP</span>
                </div>
                <div className="xp-rail mt8" style={{ background: '#1c1f1a', borderColor: '#454a41' }}>
                  <i style={{ width: `${rank.pct}%`, background: '#5d6a50', borderRightColor: 'var(--amber)' }} />
                  <b style={{ color: '#e8e5db' }}>{rank.next ? `${rank.toNext} XP TO ${rank.next.name.toUpperCase()}` : 'HIGHEST RANK'}</b>
                </div>
                <div className="xs" style={{ color: '#a8b09c', marginTop: 7, maxWidth: '52ch' }}>
                  {rank.current.note}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid #444a40', paddingLeft: 16 }}>
                <div className="eyebrow" style={{ color: '#aab39f' }}>Latest XP awards</div>
                {xpRecent.length ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '5px 0 0' }}>
                    {xpRecent.slice(0, 3).map((e) => (
                      <li key={e.id} className="row between" style={{ gap: 8, padding: '3px 0', fontSize: 11.5, color: '#d7dbcd' }}>
                        <span className="truncate" style={{ maxWidth: '85%' }} title={e.reason}>{e.reason}</span>
                        <span className="mono" style={{ color: 'var(--amber)', fontSize: 10 }}>+{e.amount}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="xs" style={{ color: '#a8b09c', margin: '6px 0 0' }}>XP is awarded for evidence-backed investigation actions.</p>}
              </div>
            </div>
          </div>

          {/* Mission sequence */}
          <Card
            title="Mission sequence"
            eyebrow={active.complete ? 'All missions complete' : `Active: ${active.code} ${active.title}`}
            actions={<span className="mono xs muted">{progress.done}/{progress.total} tasks · {progress.pct}%</span>}
          >
            <div className="stack-sm">
              {missions.map((m) => (
                <div key={m.key} style={{ borderTop: m.complete ? '1px solid var(--line-soft)' : 'none', paddingTop: m.complete ? 10 : 0 }}>
                  <div className="mission-row" style={{ borderBottom: 'none', paddingBottom: 4 }}>
                    <span className={`mission-index ${m.complete ? 'done' : ''} ${!m.complete && active.key === m.key ? 'active' : ''}`}>
                      {m.complete ? <Check size={13} /> : m.code}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="m-title">{m.title} {active.key === m.key && !m.complete && <span className="badge orange" style={{ marginLeft: 6 }}>ACTIVE</span>}</div>
                      <div className="m-sub">{m.subtitle}</div>
                    </div>
                    <div style={{ width: 110, flex: '0 0 110px' }}>
                      <Track done={m.done} total={m.total} thin />
                    </div>
                    <Btn variant="quiet" size="xs" to={`/projects/${p.id}/${MISSION_ROUTES[m.key]}`} aria-label={`Open ${m.title} workspace`}><ArrowRight size={14} /></Btn>
                  </div>
                  {active.key === m.key && !m.complete && (
                    <div className="card-tight" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', marginTop: 6 }}>
                      <div className="spread" style={{ marginBottom: 4 }}>
                        <span className="mono xs muted">TASK CHECKLIST — DERIVED FROM SAVED WORK</span>
                        <Btn variant="ghost" size="xs" to={`/projects/${p.id}/${MISSION_ROUTES[m.key]}`}>Open workspace <ArrowRight size={11} /></Btn>
                      </div>
                      {m.tasks.map((t) => (
                        <div key={t.id} className={`task-check ${t.done ? 'done' : ''}`}>
                          <span className={`task-box ${t.done ? 'done' : ''}`} aria-hidden="true">{t.done ? <Check size={10} /> : null}</span>
                          <span className="t-label">{t.label}</span>
                          {!t.done && <span className="t-auto">AUTO</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Ledger */}
          <div className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">Investigation ledger</div>
                <h2 style={{ fontSize: 17, marginTop: 2 }}>Where the dossier stands</h2>
              </div>
              <span className="mono xs muted">DERIVED FROM SAVED RECORDS</span>
            </div>
            <div className="grid g3" style={{ gap: 0 }}>
              {ledger.map((l, i) => (
                <Link key={l.label} to={`/projects/${p.id}/${l.to}`} style={{ textDecoration: 'none', color: 'inherit', padding: '10px 12px', borderLeft: i % 3 === 0 ? 'none' : '1px solid var(--line)', borderTop: i > 2 ? '1px solid var(--line)' : 'none' }}>
                  <div className="k-label mono xs muted" style={{ letterSpacing: '.1em', textTransform: 'uppercase' }}>{l.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 600, marginTop: 2 }}>{l.value}</div>
                  <div className="xs muted">{l.sub}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Blockers */}
          <Card title="Watchlist" eyebrow="High-priority risks and blocked dependencies" actions={<Btn variant="quiet" size="sm" to={`/projects/${p.id}/feasibility`}>Open register</Btn>}>
            {blockers.count === 0 && blockers.mitigatedHigh.length === 0 ? (
              <p className="small muted mb0">No high-priority risk or blocked dependency is currently registered. Keep the fallback plan updated.</p>
            ) : (
              <div className="stack-sm">
                {blockers.riskBlockers.slice(0, 3).map((r) => (
                  <div key={r.id} className="row" style={{ alignItems: 'flex-start', gap: 9 }}>
                    <AlertTriangle size={14} style={{ color: 'var(--orange)', marginTop: 2, flex: '0 0 auto' }} />
                    <div style={{ flex: 1 }}>
                      <div className="small strong">{r.title}</div>
                      <div className="xs muted">{r.mitigation ? `Mitigation: ${r.mitigation}` : 'No mitigation recorded.'}</div>
                    </div>
                    <Badge tone={riskPriority(r) === 'Critical' ? 'red' : 'orange'}>{riskPriority(r)}</Badge>
                  </div>
                ))}
                {blockers.mitigatedHigh.slice(0, 2).map((r) => (
                  <div key={r.id} className="row" style={{ alignItems: 'flex-start', gap: 9 }}>
                    <AlertTriangle size={14} style={{ color: 'var(--amber)', marginTop: 2, flex: '0 0 auto' }} />
                    <div style={{ flex: 1 }}>
                      <div className="small strong">{r.title}</div>
                      <div className="xs muted">Mitigation: {r.mitigation}</div>
                    </div>
                    <Badge tone="sage">Mitigated · {riskPriority(r)}</Badge>
                  </div>
                ))}
                {blockers.depBlockers.slice(0, 2).map((f) => (
                  <div key={f.id} className="row" style={{ alignItems: 'flex-start', gap: 9 }}>
                    <AlertTriangle size={14} style={{ color: 'var(--red)', marginTop: 2, flex: '0 0 auto' }} />
                    <div style={{ flex: 1 }}>
                      <div className="small strong">{f.title || f.category}</div>
                      <div className="xs muted">{f.consequence || 'Dependency status is blocked.'}</div>
                    </div>
                    <Badge tone="red">Blocked</Badge>
                  </div>
                ))}
              </div>
            )}
            {hours.over && (
              <div className="mt12"><Notice tone="warn">Must-build scope is estimated at {hours.must}h against {hours.available}h available. Reduce scope before adding integrations.</Notice></div>
            )}
          </Card>

          <Card title="Saved opportunities" eyebrow="Deadlines appear only when verifiable" actions={<Btn variant="quiet" size="sm" to="/hackathons">Hackathon Radar</Btn>}>
            {tracked.length ? (
              <div className="stack-sm">
                {tracked.map((t) => {
                  const hk = DEMO_HACKATHONS.find((h) => h.id === t.hackathonId);
                  const reliable = hk && (hk.verification === 'verified') && hk.registrationDeadline;
                  return (
                    <div key={t.id} className="spread" style={{ alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div className="small strong">{hk?.name || 'Unknown event'}</div>
                        <div className="xs muted">
                          {hk?.demo ? 'DEMO LISTING — dates simulated, not verified.' : reliable ? `Registration deadline ${fmtDate(hk.registrationDeadline)}` : 'Deadline unconfirmed.'}
                        </div>
                      </div>
                      <Badge tone={t.status === 'Applied' ? 'sage' : t.status === 'Preparing' ? 'amber' : 'outline'}>{t.status}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : <p className="small muted mb0">No hackathon tracked for this case yet.</p>}
          </Card>
        </div>

        {/* right rail */}
        <aside className="stack">
          <div className="card" style={{ borderTop: '3px solid var(--orange)' }}>
            <div className="eyebrow">Next recommended action</div>
            <h2 style={{ fontSize: 18, marginTop: 5 }}>{next.label}</h2>
            <p className="small muted">{next.reason}</p>
            <Btn variant="primary" to={next.to} className="block">{next.label} <ArrowRight size={14} /></Btn>
            <div className="mono xs muted mt12" style={{ letterSpacing: '.06em' }}>
              BLOCKING: {passport.checks.filter((c) => !c.pass).length} passport check(s)
            </div>
          </div>

          <Card title="Passport reading" eyebrow="Computed now, not stored">
            <StatusBadge meta={{ label: passport.outcome, cls: passport.outcomeKey === 'ready' ? 'green' : passport.outcomeKey === 'conditions' ? 'sage' : passport.outcomeKey === 'reduce' ? 'amber' : passport.outcomeKey === 'blocked' ? 'red' : 'outline' }} />
            <div className="small muted mt8">{passport.passed}/{passport.total} checks pass.</div>
            <div className="mt8"><Track done={passport.passed} total={passport.total} thin /></div>
            <div className="line" />
            <div className="spread small"><span className="muted">Report</span><strong>{latestReport ? `v${latestReport.version} · ${fmtDate(latestReport.generatedAt)}` : 'Not generated'}</strong></div>
            <div className="spread small mt8"><span className="muted">Last passport</span><strong>{latestPassport ? latestPassport.outcome : 'Not recorded'}</strong></div>
            <Btn variant="ghost" size="sm" to={`/projects/${p.id}/passport`} className="block mt12">Open passport <ArrowRight size={12} /></Btn>
          </Card>

          <Card title={`Achievements ${earned.length}/${ACHIEVEMENT_DEFS.length}`} eyebrow="Evidence-backed only" actions={<Btn variant="quiet" size="sm" to="/achievements"><Trophy size={13} /></Btn>}>
            <div className="chip-row">
              {ACHIEVEMENT_DEFS.map((d) => (
                <span key={d.key} className={`badge ${earnedKeys.has(d.key) ? 'sage' : 'outline'}`} title={d.hint} style={{ opacity: earnedKeys.has(d.key) ? 1 : 0.65 }}>
                  {earnedKeys.has(d.key) ? '✓ ' : ''}{d.title}
                </span>
              ))}
            </div>
            <p className="xs muted mt12 mb0">Unlocked by saved investigation work. Demo fixtures cannot earn source-verification achievements.</p>
          </Card>

          <Card title="Recent activity" eyebrow="Local audit trail">
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
            ) : <p className="small muted mb0">No activity recorded.</p>}
          </Card>

          <Card title="Quick access" eyebrow="Case modules">
            <div className="stack-sm">
              {[
                ['prior-art', Radar, `Prior Art Lab · ${p.repositories.length + p.solutions.length}`],
                ['differentiation', GitCompare, `Differentiation · ${p.claims.length} claims`],
                ['feasibility', FlaskConical, `Feasibility · ${p.feasibility.length} checks`],
                ['requirements', ClipboardCheck, `Requirements · ${compliance.total}`],
                ['learning', GraduationCap, `Learning · ${p.skillGaps.length} gaps`],
                ['reports', FileText, `Reports · ${p.reports.length}`],
              ].map(([to, Icon, label]) => (
                <Link key={to} to={`/projects/${p.id}/${to}`} className="spread" style={{ textDecoration: 'none', color: 'inherit', fontSize: 12 }}>
                  <span className="row" style={{ gap: 7 }}><Icon size={13} style={{ color: 'var(--field)' }} />{label}</span>
                  <ArrowRight size={12} style={{ color: 'var(--ink-2)' }} />
                </Link>
              ))}
            </div>
            <div className="line" />
            <div className="mono xs muted">
              <div className="row between"><span>TEAM</span><span>{p.teamSize} people</span></div>
              <div className="row between mt8"><span>WINDOW</span><span>{p.timeAvailable}h each · {hours.available}h total</span></div>
              <div className="row between mt8"><span>COVERAGE</span><span>{coverage.label}</span></div>
              <div className="row between mt8"><span>EVIDENCE</span><span>{quality.label}</span></div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
