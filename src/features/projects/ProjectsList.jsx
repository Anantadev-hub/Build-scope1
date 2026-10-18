import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Trash2, ArrowUpRight, RotateCcw, Database, ShieldAlert } from 'lucide-react';
import { useApp } from '../../app/store';
import { Btn, Confirm, DemoBanner, EmptyState, PageHead } from '../../components/ui';
import { buildMissions, activeMission, missionProgress, coverageOf, evidenceQuality } from '../../lib/scoring';
import { relativeTime } from '../../lib/format';
import { DEMO_PROJECT } from '../../data/demo';

export default function ProjectsList() {
  const { state, actions, pushToast } = useApp();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null); // 'demo' | 'clear'

  const rows = state.projects.map((p) => {
    const missions = buildMissions(p);
    const active = activeMission(missions);
    return { p, active, progress: missionProgress(missions), coverage: coverageOf(p), quality: evidenceQuality(p) };
  });

  return (
    <div>
      <PageHead
        eyebrow="Case register"
        title="My Projects"
        description="Every investigation is a case file. Switch cases without losing evidence, risks, learning progress, or report history."
        actions={<Btn variant="primary" to="/projects/new"><Plus size={15} /> New investigation</Btn>}
      />

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No case files yet"
            action={<div className="row" style={{ justifyContent: 'center' }}>
              <Btn variant="primary" to="/projects/new"><Plus size={15} /> Create a project</Btn>
              <Btn variant="ghost" onClick={() => { actions.loadDemo(); pushToast('Demo case loaded.'); }}>Explore the demo case</Btn>
            </div>}
          >
            An investigation starts with a problem, a user, and an honest assessment of what already exists.
            You can save a partial brief and return to it later.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="demo-banner" role="note">
            <ShieldAlert size={15} aria-hidden="true" />
            <div><b>LOCAL WORKSPACE</b> — projects, evidence, and progress are stored in this browser only. Clearing browser data removes them.</div>
          </div>

          <div className="table-wrap mb16">
            <table className="table">
              <caption className="sr-only">Registered project cases</caption>
              <thead>
                <tr>
                  <th style={{ width: 96 }}>Case</th>
                  <th>Investigation</th>
                  <th style={{ width: 150 }}>Active mission</th>
                  <th style={{ width: 140 }}>Landscape</th>
                  <th style={{ width: 120 }}>Evidence</th>
                  <th style={{ width: 96 }}>Updated</th>
                  <th style={{ width: 96 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, active, progress, coverage, quality }) => (
                  <tr key={p.id}>
                    <td><span className="mono xs" style={{ color: 'var(--ink-2)' }}>{p.caseId}</span>{p.seeded && <span className="badge demo" style={{ marginTop: 4, display: 'table' }}>DEMO</span>}</td>
                    <td>
                      <Link to={`/projects/${p.id}`} className="cell-title" style={{ textDecoration: 'none' }}>{p.name}</Link>
                      <span className="sub clamp-2">{p.problem || 'No problem statement yet.'}</span>
                    </td>
                    <td>
                      <span className="small strong">{active?.title}</span>
                      <span className="sub">{progress.done}/{progress.total} tasks · {progress.pct}%</span>
                    </td>
                    <td><span className="small">{coverage.label}</span><span className="sub">{p.repositories.length} repos · {p.solutions.length} solutions</span></td>
                    <td><span className="small">{quality.label}</span><span className="sub">{p.evidence.length} record(s)</span></td>
                    <td><span className="mono xs muted">{relativeTime(p.updatedAt)}</span></td>
                    <td>
                      <div className="row nowrap" style={{ gap: 3 }}>
                        <Btn variant="quiet" size="xs" onClick={() => { actions.setActive(p.id); navigate(`/projects/${p.id}`); }} aria-label={`Open ${p.name}`} title="Open case file">
                          <ArrowUpRight size={14} />
                        </Btn>
                        <Btn variant="quiet" size="xs" onClick={() => setConfirmDelete(p)} aria-label={`Delete ${p.name}`} title="Delete case">
                          <Trash2 size={13} />
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="section-rule"><span>Workspace controls</span></div>
      <div className="grid g2">
        <div className="card card-tight">
          <div className="spread">
            <div>
              <h3 style={{ fontSize: 14 }}>Demo case</h3>
              <p className="small muted mb0">Restore or add the Kabadiwala Connect worked example. Existing projects are not replaced.</p>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => setConfirmReset('demo')}><RotateCcw size={13} /> Add demo</Btn>
          </div>
        </div>
        <div className="card card-tight">
          <div className="spread">
            <div>
              <h3 style={{ fontSize: 14 }}>Clear local workspace</h3>
              <p className="small muted mb0">Removes all local projects, evidence, XP, and tracking from this browser.</p>
            </div>
            <Btn variant="danger" size="sm" onClick={() => setConfirmReset('clear')}><Database size={13} /> Clear</Btn>
          </div>
        </div>
      </div>

      <Confirm
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          actions.deleteProject(confirmDelete.id);
          pushToast(`Case ${confirmDelete.caseId} deleted from this browser.`);
        }}
        title="Delete this case file?"
        confirmLabel="Delete case"
        danger
      >
        <p>
          <strong>{confirmDelete?.caseId} · {confirmDelete?.name}</strong> and its saved evidence,
          comparisons, risks, learning progress, hackathon tracking, reports, and passports will be
          removed from this browser. This cannot be undone.
        </p>
      </Confirm>

      <Confirm
        open={Boolean(confirmReset)}
        onClose={() => setConfirmReset(null)}
        onConfirm={() => {
          if (confirmReset === 'demo') {
            actions.loadDemo();
            pushToast('Demo case added.');
            navigate(`/projects/${DEMO_PROJECT.id}`);
          } else {
            actions.resetWorkspace('clear');
          }
        }}
        title={confirmReset === 'demo' ? 'Add the demo case?' : 'Clear the local workspace?'}
        confirmLabel={confirmReset === 'demo' ? 'Add demo case' : 'Clear everything'}
        danger={confirmReset === 'clear'}
      >
        {confirmReset === 'demo' ? (
          <DemoBanner>Kabadiwala Connect is simulated data. It is added alongside your projects and never replaces them.</DemoBanner>
        ) : (
          <p>All projects and their dependent records will be removed from this browser. There is no cloud backup and no undo.</p>
        )}
      </Confirm>
    </div>
  );
}
