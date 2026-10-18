import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { useApp } from './store';
import { DEMO_PROJECT } from '../data/demo';

export default function CommandPalette({ open, onClose }) {
  const { state, actions } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);
  const active = state.projects.find((p) => p.id === state.activeProjectId);

  useEffect(() => {
    if (open) { setQ(''); setSel(0); }
  }, [open]);

  const items = useMemo(() => {
    const out = [];
    state.projects.forEach((p) => out.push({
      group: 'Cases', label: p.name, hint: p.caseId, icon: 'case', run: () => navigate(`/projects/${p.id}`),
    }));
    out.push(
      { group: 'Workspace', label: 'Mission Control', hint: 'Overview', icon: 'nav', run: () => navigate('/') },
      { group: 'Workspace', label: 'My Projects', hint: 'All cases', icon: 'nav', run: () => navigate('/projects') },
      { group: 'Workspace', label: 'Hackathon Radar', hint: 'Opportunities', icon: 'nav', run: () => navigate('/hackathons') },
      { group: 'Workspace', label: 'Achievements & ranks', hint: 'Progress', icon: 'nav', run: () => navigate('/achievements') },
    );
    if (active) {
      const base = `/projects/${active.id}`;
      out.push(
        { group: 'Active case', label: 'Project overview', hint: active.caseId, icon: 'nav', run: () => navigate(base) },
        { group: 'Active case', label: 'Prior Art Lab', hint: 'Existing solutions', icon: 'nav', run: () => navigate(`${base}/prior-art`) },
        { group: 'Active case', label: 'Differentiation', hint: 'Find the edge', icon: 'nav', run: () => navigate(`${base}/differentiation`) },
        { group: 'Active case', label: 'Feasibility Lab', hint: 'Dependencies & risks', icon: 'nav', run: () => navigate(`${base}/feasibility`) },
        { group: 'Active case', label: 'Requirements', hint: 'Official brief mapping', icon: 'nav', run: () => navigate(`${base}/requirements`) },
        { group: 'Active case', label: 'Learning Hub', hint: 'Gap-to-skill paths', icon: 'nav', run: () => navigate(`${base}/learning`) },
        { group: 'Active case', label: 'Proof Graph', hint: 'Need → evidence → test', icon: 'nav', run: () => navigate(`${base}/proof`) },
        { group: 'Active case', label: 'Assurance & testing', hint: 'Recorded test log', icon: 'nav', run: () => navigate(`${base}/assurance`) },
        { group: 'Active case', label: 'Reports', hint: 'Generate PDF', icon: 'nav', run: () => navigate(`${base}/reports`) },
        { group: 'Active case', label: 'Buildability Passport', hint: 'Final recommendation', icon: 'nav', run: () => navigate(`${base}/passport`) },
      );
    }
    out.push(
      { group: 'Actions', label: 'Start a new investigation', hint: 'New case', icon: 'act', run: () => navigate('/projects/new') },
      {
        group: 'Actions',
        label: 'Restore the Kabadiwala Connect demo case',
        hint: 'Demo',
        icon: 'act',
        run: () => {
          if (!state.projects.some((p) => p.id === DEMO_PROJECT.id)) actions.loadDemo();
          else actions.setActive(DEMO_PROJECT.id);
          navigate(`/projects/${DEMO_PROJECT.id}`);
        },
      },
    );
    return out;
  }, [state.projects, active, navigate, actions]);

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return items.filter((i) => !norm || `${i.label} ${i.hint} ${i.group}`.toLowerCase().includes(norm));
  }, [items, q]);

  useEffect(() => { setSel(0); }, [q]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[sel];
        if (item) { item.run(); onClose(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, sel, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  let lastGroup = '';
  return (
    <div className="cmd-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd" role="dialog" aria-modal="true" aria-label="Command palette">
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 15, top: 16, color: 'var(--ink-2)' }} aria-hidden="true" />
          <input
            autoFocus
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cases, modules, actions…"
            aria-label="Search commands"
            style={{ paddingLeft: 40, borderBottom: '1px solid var(--line)' }}
          />
        </div>
        <div className="cmd-list" ref={listRef}>
          {filtered.length === 0 && <div className="cmd-empty">No matching command. Try “prior art”, a case ID, or “passport”.</div>}
          {filtered.map((item, i) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <React.Fragment key={`${item.group}-${item.label}`}>
                {showGroup && <div className="cmd-group">{item.group}</div>}
                <button
                  type="button"
                  className="cmd-item"
                  aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => { item.run(); onClose(); }}
                >
                  <span className="mono" style={{ color: 'var(--field)', width: 16 }}>{item.icon === 'case' ? '§' : item.icon === 'act' ? '+' : '→'}</span>
                  <span>{item.label}</span>
                  <span className="k">{item.hint}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="row between" style={{ borderTop: '1px solid var(--line)', padding: '7px 12px', background: 'var(--surface-2)' }}>
          <span className="mono xs muted">↑↓ navigate · ⏎ open · esc close</span>
          <span className="mono xs muted"><CornerDownLeft size={11} style={{ verticalAlign: -1 }} /> local workspace</span>
        </div>
      </div>
    </div>
  );
}
