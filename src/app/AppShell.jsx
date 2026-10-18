import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  Crosshair, FolderOpen, Radar, GitCompare, FlaskConical, ClipboardCheck, Network,
  GraduationCap, CalendarClock, FileText, Trophy, Menu, Search, ChevronRight, ShieldCheck, LogOut, UserRound,
} from 'lucide-react';
import { useApp } from './store';
import { useAuth } from './auth';
import { buildMissions, missionProgress, rankFor, totalXp } from '../lib/scoring';
import CommandPalette from './CommandPalette';
import { Toasts } from '../components/ui';

const NAV = [
  { group: 'Case work', items: [
    { to: '/', label: 'Mission Control', idx: '01', icon: Crosshair, end: true },
    { to: '/projects', label: 'My Projects', idx: '02', icon: FolderOpen, end: true },
  ] },
  { group: 'Investigation', items: [
    { to: '/prior-art', label: 'Prior Art Lab', idx: '03', icon: Radar, scoped: true },
    { to: '/differentiation', label: 'Differentiation', idx: '04', icon: GitCompare, scoped: true },
    { to: '/feasibility', label: 'Feasibility Lab', idx: '05', icon: FlaskConical, scoped: true },
    { to: '/requirements', label: 'Requirements', idx: '06', icon: ClipboardCheck, scoped: true },
    { to: '/learning', label: 'Learning Hub', idx: '07', icon: GraduationCap, scoped: true },
  ] },
  { group: 'Proof & assurance', items: [
    { to: '/proof', label: 'Proof Graph', idx: '08', icon: Network, scoped: true },
    { to: '/assurance', label: 'Assurance & testing', idx: '09', icon: FlaskConical, scoped: true },
  ] },
  { group: 'Field', items: [
    { to: '/hackathons', label: 'Hackathon Radar', idx: '10', icon: CalendarClock },
    { to: '/reports', label: 'Reports', idx: '11', icon: FileText, scoped: true },
    { to: '/achievements', label: 'Achievements', idx: '12', icon: Trophy },
  ] },
];

const CRUMB_LABELS = {
  projects: 'My Projects',
  new: 'New case',
  edit: 'Edit brief',
  'prior-art': 'Prior Art Lab',
  differentiation: 'Differentiation',
  feasibility: 'Feasibility Lab',
  requirements: 'Requirements',
  learning: 'Learning Hub',
  proof: 'Opportunity-to-Proof',
  assurance: 'Assurance & testing',
  reports: 'Reports',
  passport: 'Buildability Passport',
  hackathons: 'Hackathon Radar',
  achievements: 'Achievements',
};

export default function AppShell() {
  const { state, project, actions, toasts, dismissToast, savedAt, pushToast } = useApp();
  const { session, signOut, claimPending } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [cmd, setCmd] = useState(false);

  // A one-time message raised during sign-in (for example an adopted legacy
  // workspace) is delivered here, because the login screen unmounts on redirect.
  useEffect(() => {
    const pending = claimPending();
    if (pending) pushToast(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmd((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setMenu(false); }, [location.pathname]);

  const missions = useMemo(() => (project ? buildMissions(project) : []), [project]);
  const progress = useMemo(() => missionProgress(missions), [missions]);
  const active = missions.find((m) => !m.complete) || missions[missions.length - 1];
  const xp = project ? totalXp(state, project.id) : 0;
  const rank = rankFor(xp);

  if (!state.preferences.welcomed) return <Navigate to="/welcome" replace />;

  const href = (to) => (project ? `/projects/${project.id}${to}` : '/projects');
  const parts = location.pathname.split('/').filter(Boolean);
  let crumb = 'Mission Control';
  if (parts[0] === 'projects') {
    crumb = parts.length === 1 ? 'My Projects' : (CRUMB_LABELS[parts[2]] || 'Case overview');
  } else if (parts[0]) {
    crumb = CRUMB_LABELS[parts[0]] || 'Workspace';
  }

  return (
    <div className="shell">
      <a href="#main-content" className="sr-only">Skip to content</a>
      {menu && <div className="modal-backdrop" style={{ zIndex: 35, padding: 0 }} onMouseDown={() => setMenu(false)} aria-hidden="true" />}

      <aside className={`sidebar ${menu ? 'open' : ''}`} aria-label="Primary">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">BS</div>
          <div>
            <div className="brand-name">BuildScope<span style={{ color: 'var(--orange)' }}>_</span>AI</div>
            <div className="brand-sub">Field investigation unit</div>
          </div>
        </div>

        {project ? (
          <button type="button" className="side-project" onClick={() => navigate('/projects')} aria-label="Switch or manage projects">
            <div className="case">CASE {project.caseId}</div>
            <div className="pname">
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
              <ChevronRight size={13} aria-hidden="true" />
            </div>
            <div className="meta">MISSION {active?.code || '—'} · {progress.pct}% · {rank.current.name.toUpperCase()}</div>
          </button>
        ) : (
          <button type="button" className="side-project" onClick={() => navigate('/projects/new')}>
            <div className="case">NO ACTIVE CASE</div>
            <div className="pname">Open an investigation <ChevronRight size={13} /></div>
            <div className="meta">Create a case to begin</div>
          </button>
        )}

        <nav className="nav">
          {NAV.map((group) => (
            <React.Fragment key={group.group}>
              <div className="nav-label">{group.group}</div>
              {group.items.map((item) => {
                const to = item.scoped ? href(item.to) : item.to;
                return (
                  <NavLink
                    key={item.label}
                    to={to}
                    end={item.end}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={() => setMenu(false)}
                  >
                    <span className="idx">{item.idx}</span>
                    <item.icon size={15} aria-hidden="true" />
                    <span className="nl">{item.label}</span>
                    {item.label === 'Reports' && project?.reports?.length > 0 && <span className="flag">{project.reports.length}</span>}
                  </NavLink>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        <div className="side-foot">
          <div><strong>LOCAL WORKSPACE</strong></div>
          <div>{state.projects.length} case{state.projects.length === 1 ? '' : 's'} · data stays in this browser</div>
          {project && (
            <button type="button" className="btn quiet xs" style={{ color: '#cfd5c6', marginTop: 6, paddingLeft: 0 }} onClick={() => navigate(`/projects/${project.id}/passport`)}>
              <ShieldCheck size={12} aria-hidden="true" /> BUILDABILITY PASSPORT
            </button>
          )}
          {session && (
            <div className="side-account">
              <div className="sa-row">
                <span className="sa-avatar" aria-hidden="true">{(session.name || session.email || '?').slice(0, 1).toUpperCase()}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="sa-name truncate">{session.name || 'Demo account'}</span>
                  <span className="sa-mail truncate">{session.email}</span>
                </span>
              </div>
              <button
                type="button"
                className="btn quiet xs"
                style={{ color: '#cfd5c6', paddingLeft: 0 }}
                onClick={async () => { await signOut(); navigate('/login', { replace: true }); }}
              >
                <LogOut size={12} aria-hidden="true" /> SIGN OUT OF THIS DEMO ACCOUNT
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="btn quiet mobile-menu" onClick={() => setMenu(true)} aria-label="Open navigation">
            <Menu size={18} />
          </button>
          <div className="crumbs">
            <span>BUILDSCOPE</span>
            <span className="sep">/</span>
            {project && <><span>{project.caseId}</span><span className="sep">/</span></>}
            <b>{crumb}</b>
          </div>
          <div className="topbar-spacer" />

          {state.projects.length > 0 && (
            <label className="row nowrap topbar-case" style={{ gap: 6 }}>
              <span className="sr-only">Switch active case</span>
              <select
                value={state.activeProjectId || ''}
                onChange={(e) => { actions.setActive(e.target.value); navigate(`/projects/${e.target.value}`); }}
                style={{ width: 'auto', maxWidth: 200, fontSize: 11.5, padding: '4px 24px 4px 7px', borderColor: 'var(--line)' }}
              >
                {state.projects.map((p) => <option key={p.id} value={p.id}>{p.caseId} · {p.name}</option>)}
              </select>
            </label>
          )}

          <span className="topbar-save mono xs muted nowrap" title={savedAt ? `Last local save ${new Date(savedAt).toLocaleTimeString()}` : 'Local save unavailable'}>
            <span className="dot green" style={{ marginRight: 5 }} />{savedAt ? 'Saved locally' : 'Local save failed'}
          </span>

          {session && (
            <button
              type="button"
              className="account-chip"
              onClick={async () => { await signOut(); navigate('/login', { replace: true }); }}
              title={`Signed in as ${session.email} — click to sign out`}
              aria-label={`Signed in as ${session.email}. Sign out of this demo account.`}
            >
              <UserRound size={12} aria-hidden="true" />
              <span className="lbl truncate">{session.name || session.email}</span>
            </button>
          )}

          <button type="button" className="cmdbtn" onClick={() => setCmd(true)}>
            <Search size={13} aria-hidden="true" /><span className="lbl">Jump to…</span><kbd>⌘K</kbd>
          </button>
        </header>

        <main id="main-content" className="content">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
