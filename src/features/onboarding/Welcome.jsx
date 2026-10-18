import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, MapPin, Database, Eye, ShieldAlert, LogOut } from 'lucide-react';
import { useApp } from '../../app/store';
import { useAuth } from '../../app/auth';
import { DEMO_PROJECT } from '../../data/demo';
import { Btn, Notice } from '../../components/ui';

const PROTOCOL = [
  ['01', 'Reconnaissance', 'Problem, users, and the existing landscape.'],
  ['02', 'Find Your Edge', 'Evidence-backed differentiation, not novelty claims.'],
  ['03', 'Stress Test', 'Dependencies, data, licensing, time, risks.'],
  ['04', 'Prove the Demo', 'Acceptance criteria and an end-to-end workflow.'],
  ['05', 'Build Release', 'Scope, report, and Buildability Passport.'],
];

export default function Welcome() {
  const { state, actions, pushToast, loadError } = useApp();
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const exploreDemo = () => {
    if (!state.projects.some((p) => p.id === DEMO_PROJECT.id) && state.projects.length > 0) {
      pushToast('Demo case added alongside your existing projects.');
    }
    actions.loadDemo();
    actions.setActive(DEMO_PROJECT.id);
    actions.prefs({ welcomed: true });
    navigate(`/projects/${DEMO_PROJECT.id}`);
  };

  const createNew = () => {
    // A workspace holding only the auto-seeded demo case is emptied first, so a
    // blank start really is blank rather than "blank plus a demo project".
    const onlyAutoDemo = state.preferences.demoSeeded === 'auto'
      && state.projects.length <= 1
      && state.projects.every((p) => p.id === DEMO_PROJECT.id);
    actions.discardAutoDemo({ safe: onlyAutoDemo });
    actions.prefs({ welcomed: true });
    navigate('/projects/new');
  };

  return (
    <div className="welcome">
      <section className="welcome-left">
        <div className="eyebrow">BuildScope AI · Investigation workspace</div>
        <h1 style={{ fontSize: 'clamp(32px, 4.6vw, 54px)', marginTop: 10, maxWidth: '15ch' }}>
          Investigate before you build.
        </h1>
        <p className="lead" style={{ marginTop: 14 }}>
          A 24-hour hackathon leaves no room for a beautiful idea that already exists, depends on data
          you cannot get, or cannot be demonstrated. BuildScope turns a rough pitch into a scoped,
          evidence-checked build decision — and shows you what to cut.
        </p>

        {loadError && <div className="mb16"><Notice tone="warn">{loadError}</Notice></div>}

        <div className="stack-sm" style={{ marginTop: 22, maxWidth: 620 }}>
          <button type="button" className="welcome-choice" onClick={exploreDemo}>
            <span className="wc-num">01</span>
            <span style={{ flex: 1 }}>
              <h3>Explore the Kabadiwala Connect case <DemoTag>DEMO</DemoTag></h3>
              <p>
                A complete worked investigation: role-based waste collection with traceability.
                Five missions, comparison matrix, risk register, and a report — built on clearly
                labelled demo fixtures so you can see how the modules connect.
              </p>
              <span className="mono xs" style={{ color: 'var(--ink-2)', display: 'inline-block', marginTop: 8 }}>
                CASE BS-26-001 · 4-person team · 32h window
              </span>
            </span>
            <ArrowRight size={17} style={{ marginTop: 4, color: 'var(--orange)' }} aria-hidden="true" />
          </button>

          <button type="button" className="welcome-choice" onClick={createNew}>
            <span className="wc-num">02</span>
            <span style={{ flex: 1 }}>
              <h3>Start a new investigation</h3>
              <p>
                Open a blank case file. The guided brief explains each field, and nothing is claimed
                as researched until you record it. You can save a partial brief and return later.
              </p>
              <span className="mono xs" style={{ color: 'var(--ink-2)', display: 'inline-block', marginTop: 8 }}>
                STARTS EMPTY · YOUR OWN LOCAL WORKSPACE
              </span>
            </span>
            <Plus size={17} style={{ marginTop: 4, color: 'var(--field)' }} aria-hidden="true" />
          </button>
        </div>

        <p className="mono xs muted" style={{ marginTop: 22, maxWidth: 620 }}>
          BuildScope stores projects and progress in this browser under your demo account. No live search,
          repository metadata retrieval, official verification, or AI analysis is connected in this build.
        </p>

        {session && (
          <div className="welcome-account">
            <span className="mono xs">SIGNED IN AS {session.email}</span>
            <Btn variant="quiet" size="xs" onClick={() => { signOut(); navigate('/login', { replace: true }); }}>
              <LogOut size={12} aria-hidden="true" /> Sign out
            </Btn>
          </div>
        )}
      </section>

      <aside className="welcome-right" aria-label="How the investigation works">
        <div className="eyebrow plain" style={{ color: '#9aa28f' }}>Field protocol</div>
        <h2 style={{ color: '#f4f1e8', fontSize: 22, margin: '8px 0 18px' }}>Five missions. One dossier.</h2>

        <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 26px' }}>
          {PROTOCOL.map(([num, title, desc], i) => (
            <li key={num} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i === PROTOCOL.length - 1 ? 'none' : '1px solid #3a3d37' }}>
              <span className="mono" style={{ color: 'var(--amber)', fontSize: 10, paddingTop: 2 }}>{num}</span>
              <span>
                <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13.5, color: '#f1eee4' }}>{title}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: '#a8b09c', marginTop: 1 }}>{desc}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="eyebrow plain" style={{ color: '#9aa28f' }}>What the labels mean</div>
        <div className="status-key" style={{ marginTop: 10 }}>
          <div className="row"><span className="mono">VERIFIED</span><span>Checked against the source record by your team.</span></div>
          <div className="row"><span className="mono">PARTIAL</span><span>Some fields checked; others unresolved.</span></div>
          <div className="row"><span className="mono">DEMO</span><span>Simulated fixture. Never counts as evidence.</span></div>
          <div className="row"><span className="mono">ASSUMED</span><span>Reasonable but not tested. Shown as a gap.</span></div>
          <div className="row"><span className="mono">UNKNOWN</span><span>No information. Not the same as “does not exist”.</span></div>
        </div>

        <div className="row" style={{ marginTop: 24, gap: 14, color: '#8f9784', fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.08em' }}>
          <span><MapPin size={11} style={{ verticalAlign: -1 }} /> LOCAL ONLY</span>
          <span><Database size={11} style={{ verticalAlign: -1 }} /> BROWSER STORAGE</span>
          <span><Eye size={11} style={{ verticalAlign: -1 }} /> NO TELEMETRY</span>
        </div>
        <div className="row" style={{ marginTop: 8, color: '#8f9784', fontFamily: 'var(--font-mono)', fontSize: 9.5 }}>
          <ShieldAlert size={11} /> DEMO DATA IS LABELLED WHEREVER IT APPEARS
        </div>
      </aside>
    </div>
  );
}

function DemoTag({ children }) {
  return <span className="badge demo" style={{ marginLeft: 6, verticalAlign: 2 }}>{children}</span>;
}
