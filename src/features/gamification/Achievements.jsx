import React, { useMemo } from 'react';
import { Trophy, Lock, Check, Sparkles, TrendingUp, ShieldCheck } from 'lucide-react';
import { useApp } from '../../app/store';
import { usePageTitle } from '../../app/hooks';
import { Badge, Btn, Card, PageHead } from '../../components/ui';
import { ACHIEVEMENT_DEFS, RANKS } from '../../lib/constants';
import { rankFor, totalXp } from '../../lib/scoring';
import { fmtDate, relativeTime } from '../../lib/format';

const XP_RULES = [
  ['Complete a structured project brief', '+60', 'once per case'],
  ['Record a repository or solution lead', '+12', 'max 8 per case'],
  ['Record evidence with a claim', '+20', 'max 8 per case'],
  ['Record verified evidence', '+30', 'max 8 per case'],
  ['Confirm an existing-solution comparison', '+40', 'once per case'],
  ['Link a differentiator to evidence', '+35', 'max 5 per case'],
  ['Verify a feasibility dependency', '+25', 'max 8 per case'],
  ['Document a mitigation for a high-impact risk', '+20', 'max 6 per case'],
  ['Provide evidence for an official requirement', '+25', 'max 8 per case'],
  ['Define a demo acceptance criterion', '+15', 'max 6 per case'],
  ['Apply a learned skill in the project', '+20', 'max 8 per case'],
  ['Track a hackathon opportunity', '+10', 'per opportunity'],
  ['Confirm the build scope', '+30', 'once per case'],
  ['Generate a Buildability Report', '+40', 'once per case'],
  ['Record a Buildability Passport', '+60', 'once per case'],
];

export default function Achievements() {
  const { state, project } = useApp();
  usePageTitle('Achievements');
  const xp = project ? totalXp(state, project.id) : state.xpEvents.reduce((n, e) => n + e.amount, 0);
  const rank = rankFor(xp);
  const earned = state.achievements;
  const earnedKeys = new Set(earned.map((a) => a.key));
  const xpEvents = useMemo(() => [...state.xpEvents].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 25), [state.xpEvents]);
  const projectName = (id) => state.projects.find((p) => p.id === id)?.name || 'Unknown case';

  return (
    <div>
      <PageHead
        eyebrow="10 · Progression"
        title="Achievements & field rank"
        description="Progress reflects evidence-backed investigation work, not clicks. XP is awarded once per meaningful record; repeated actions cannot farm it, and demo fixtures never earn verification achievements."
        actions={<Btn variant="ghost" to={project ? `/projects/${project.id}/passport` : '/projects'}><ShieldCheck size={14} /> Passport</Btn>}
      />

      <div className="grid g-1-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card graphite">
            <div className="eyebrow" style={{ color: '#aab39f' }}>Current field rank</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <h2 style={{ color: '#f4f1e8', fontSize: 30 }}>{rank.current.name}</h2>
              <span className="mono xs" style={{ color: 'var(--amber)' }}>{xp} XP</span>
            </div>
            <p className="small" style={{ color: '#c9cfc0', marginTop: 4 }}>{rank.current.note}</p>
            <div className="xp-rail mt12" style={{ background: '#1c1f1a', borderColor: '#454a41' }}>
              <i style={{ width: `${rank.pct}%`, background: '#5d6a50', borderRightColor: 'var(--amber)' }} />
              <b style={{ color: '#e8e5db' }}>{rank.next ? `${rank.toNext} XP TO ${rank.next.name.toUpperCase()}` : 'HIGHEST RANK REACHED'}</b>
            </div>
            <div className="mono xs mt12" style={{ color: '#9aa28f' }}>
              {project ? `CASE ${project.caseId} · ${project.name.toUpperCase()}` : 'WORKSPACE TOTAL — NO ACTIVE CASE'}
            </div>
          </div>

          <Card title="Rank ladder" eyebrow="What each rank represents">
            <div className="stack-sm">
              {RANKS.map((r, i) => {
                const reached = xp >= r.min;
                const current = rank.current.name === r.name;
                return (
                  <div key={r.name} className="row" style={{ gap: 10, alignItems: 'flex-start', opacity: reached ? 1 : 0.62 }}>
                    <span className={`mission-index ${reached ? 'done' : ''}`} style={{ fontSize: 10 }}>
                      {reached ? <Check size={12} /> : String(i + 1).padStart(2, '0')}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="small strong">{r.name}</span>
                        {current && <Badge tone="orange">CURRENT</Badge>}
                        <span className="mono xs muted" style={{ marginLeft: 'auto' }}>{r.min} XP</span>
                      </div>
                      <div className="xs muted">{r.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="How XP is earned" eyebrow="Fixed values, one award per record">
            <div className="table-wrap" style={{ border: 0 }}>
              <table className="table">
                <thead><tr><th>Meaningful action</th><th className="num">XP</th><th>Limit</th></tr></thead>
                <tbody>
                  {XP_RULES.map(([action, points, limit]) => (
                    <tr key={action}><td>{action}</td><td className="num" style={{ color: 'var(--ok)' }}>{points}</td><td className="xs muted">{limit}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt12">
              <NoticeFallback />
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title={`Achievements ${earned.length}/${ACHIEVEMENT_DEFS.length}`} eyebrow="Unlocked by actual conditions">
            <div className="grid g2" style={{ gap: 10 }}>
              {ACHIEVEMENT_DEFS.map((d) => {
                const got = earned.find((a) => a.key === d.key);
                return (
                  <div key={d.key} className="card card-tight" style={{ background: got ? 'var(--sage)' : 'var(--surface-2)', borderColor: got ? 'var(--sage-mid)' : 'var(--line)', opacity: got ? 1 : 0.82 }}>
                    <div className="spread" style={{ alignItems: 'flex-start' }}>
                      <span className={`mission-index ${got ? 'done' : ''}`} style={{ width: 24, height: 24, flexBasis: 24 }} aria-hidden="true">
                        {got ? <Trophy size={12} /> : <Lock size={11} />}
                      </span>
                      <span className="mono xs muted">{got ? fmtDate(got.at) : 'LOCKED'}</span>
                    </div>
                    <div className="small strong mt8">{d.title}</div>
                    <div className="xs muted">{d.hint}</div>
                    {got && <div className="xs mt8" style={{ color: '#46503f' }}>Earned on {projectName(got.projectId)}</div>}
                  </div>
                );
              })}
            </div>
            <div className="line" />
            <p className="xs muted mb0">
              <b>Source Verified</b> requires a checked, non-demo source. <b>Buildability Certified</b> requires a recorded passport; it does not
              imply the passport outcome is positive.
            </p>
          </Card>

          <Card title="Recent XP awards" eyebrow="Why each point was earned">
            {xpEvents.length === 0 ? (
              <p className="small muted mb0">No XP yet. Complete the brief, record a source with a claim, or verify a dependency.</p>
            ) : (
              <div className="table-wrap" style={{ border: 0 }}>
                <table className="table">
                  <thead><tr><th>Reason</th><th>Case</th><th className="num">XP</th><th>When</th></tr></thead>
                  <tbody>
                    {xpEvents.map((e) => (
                      <tr key={e.id}>
                        <td><span className="small">{e.reason}</span></td>
                        <td className="xs muted">{projectName(e.projectId)}</td>
                        <td className="num" style={{ color: 'var(--ok)' }}>+{e.amount}</td>
                        <td className="mono xs muted">{relativeTime(e.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Anti-farming rules" eyebrow="Why the numbers can be trusted">
            <ul className="small muted" style={{ paddingLeft: 16, margin: 0 }}>
              <li>Every award has a stable key (record ID plus action). Repeating the action does not re-award.</li>
              <li>Demo and simulated records are excluded from verification XP and all evidence achievements.</li>
              <li>Per-category caps limit bulk-entered records from dominating progress.</li>
              <li>Generating a report awards nothing about technical soundness — the passport outcome stays independent.</li>
              <li>No streaks, penalties, leaderboards, or artificial deadlines.</li>
            </ul>
            <div className="line" />
            <div className="row between mono xs muted">
              <span>XP EVENTS</span><span>{state.xpEvents.length}</span>
            </div>
            <div className="row between mono xs muted mt8">
              <span>ACHIEVEMENTS</span><span>{earned.length}/{ACHIEVEMENT_DEFS.length}</span>
            </div>
            <div className="row between mono xs muted mt8">
              <span>CASES</span><span>{state.projects.length}</span>
            </div>
          </Card>

          <div className="card">
            <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <Sparkles size={15} style={{ color: 'var(--field)', marginTop: 2 }} />
              <div>
                <div className="small strong">What rank does not mean</div>
                <div className="xs muted" style={{ marginTop: 3 }}>
                  Rank measures investigation effort and evidence discipline — not code quality, novelty, or the likelihood of winning.
                  A Field Commander can still have a blocked passport.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoticeFallback() {
  return (
    <div className="notice">
      <TrendingUp size={15} aria-hidden="true" />
      <div className="xs">
        <b>XP is derived, not clicked.</b> Adding a record creates a one-time award keyed to that record. Editing a record does not
        re-award it, and demo fixtures are excluded from verification points.
      </div>
    </div>
  );
}
