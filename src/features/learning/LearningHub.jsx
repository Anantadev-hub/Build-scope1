import React, { useMemo, useState } from 'react';
import { Plus, GraduationCap, BookOpen, ExternalLink, Search, Check, Trash2, Edit3, ArrowRight, AlertTriangle, Link2, Target, } from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  MissingCase, Btn, EmptyState, Field, Modal, Notice, PageHead, SegTabs } from '../../components/ui';
import { skillGap } from '../../lib/models';
import { LEARNING_RESOURCES } from '../../data/demo';
import { LEARNING_STAGES } from '../../lib/constants';
import { fmtDate } from '../../lib/format';

const CATEGORIES = ['Frontend', 'APIs', 'Data', 'Backend', 'Testing', 'Deployment', 'Research', 'Other'];

// A resource is only suggested when the gap's own wording appears in the
// resource skill, title, or outcome. Category alone is never enough - otherwise
// unrelated material gets recommended.
function matchedResources(gap) {
  const words = gap.skill.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return LEARNING_RESOURCES
    .map((r) => {
      const hay = `${r.skill} ${r.title} ${r.outcome}`.toLowerCase();
      const skillHits = words.filter((w) => hay.includes(w)).length;
      const categoryBonus = r.category.toLowerCase() === gap.category.toLowerCase() ? 1 : 0;
      return { ...r, score: skillHits * 2 + categoryBonus };
    })
    .filter((r) => r.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function GapForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    skill: initial?.skill || '',
    category: initial?.category || 'Frontend',
    why: initial?.why || '',
    confidence: initial?.confidence ?? 2,
    prerequisite: initial?.prerequisite || '',
    projectTask: initial?.projectTask || '',
    competenceEvidence: initial?.competenceEvidence || '',
  });
  const [err, setErr] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!f.skill.trim()) { setErr('Name the specific skill, not a general topic.'); return; } onSave(f); }}>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <div className="form-grid">
        <Field label="Skill or concept" required htmlFor="gap-skill">
          <input id="gap-skill" type="text" value={f.skill} onChange={(e) => set({ skill: e.target.value })} placeholder="e.g. Client-side persistence" />
        </Field>
        <Field label="Category" htmlFor="gap-cat">
          <select id="gap-cat" value={f.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Current confidence (1–5)" htmlFor="gap-conf">
          <select id="gap-conf" value={f.confidence} onChange={(e) => set({ confidence: Number(e.target.value) })}>
            <option value={1}>1 — Never used it</option>
            <option value={2}>2 — Seen it, cannot build it</option>
            <option value={3}>3 — Can follow a guide</option>
            <option value={4}>4 — Can build with reference</option>
            <option value={5}>5 — Confident</option>
          </select>
        </Field>
        <Field label="Prerequisite" htmlFor="gap-pre">
          <input id="gap-pre" type="text" value={f.prerequisite} onChange={(e) => set({ prerequisite: e.target.value })} placeholder="What should be understood first?" />
        </Field>
      </div>
      <div className="mt12"><Field label="Why this matters for the project" htmlFor="gap-why"><textarea id="gap-why" rows={2} value={f.why} onChange={(e) => set({ why: e.target.value })} /></Field></div>
      <div className="mt12"><Field label="Project-specific application task" hint="The concrete thing to implement in this project — not a generic exercise." htmlFor="gap-task"><textarea id="gap-task" rows={2} value={f.projectTask} onChange={(e) => set({ projectTask: e.target.value })} /></Field></div>
      <div className="mt12"><Field label="Evidence that proves competence" htmlFor="gap-evidence"><input id="gap-evidence" type="text" value={f.competenceEvidence} onChange={(e) => set({ competenceEvidence: e.target.value })} placeholder="e.g. Reload test showing status history survives" /></Field></div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={(e) => { e.preventDefault(); if (!f.skill.trim()) { setErr('Name the specific skill.'); return; } onSave(f); }}>Save gap</Btn>
      </div>
    </form>
  );
}

function ResourceCard({ resource, saved, onSave, onOpen }) {
  return (
    <article className="card card-tight" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div className="mono xs muted">{resource.publisher} · {resource.format}</div>
          <h4 style={{ fontSize: 14, marginTop: 3 }}>{resource.title}</h4>
        </div>
        <span className="badge outline">{resource.difficulty}</span>
      </div>
      <div className="xs"><span className="mono muted">SKILL </span>{resource.skill}</div>
      <div className="xs muted">{resource.outcome}</div>
      <div className="xs muted"><span className="mono">PREREQUISITE </span>{resource.prerequisites}</div>
      <div className="row between" style={{ marginTop: 'auto', paddingTop: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          {resource.url ? <a href={resource.url} target="_blank" rel="noopener noreferrer" className="xs link-out">Open source <ExternalLink size={10} /></a> : <span className="xs muted">No verified URL</span>}
          <span className="badge demo">LINK NOT CHECKED</span>
        </div>
        <Btn variant={saved ? 'ghost' : 'primary'} size="xs" onClick={() => (saved ? onOpen() : onSave(resource))}>
          {saved ? 'In your log' : 'Add to path'}
        </Btn>
      </div>
      <div className="mono xs muted">Cost: {resource.cost}. Availability and pricing not verified in this session.</div>
    </article>
  );
}

function LearningRecord({ record, gap, resource, onUpdate, onRemove, onResolve }) {
  const [notes, setNotes] = useState(record.notes || '');
  const stageDone = Object.values(record.stages || {}).filter(Boolean).length;
  const allDone = stageDone === 3;

  return (
    <div className="card">
      <div className="spread" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div className="eyebrow">{resource?.publisher || 'Resource'} · {record.status}</div>
          <h3 style={{ fontSize: 15, marginTop: 3 }}>{resource?.title || 'Unknown resource'}</h3>
          <div className="xs muted">Gap: {gap?.skill || 'Unlinked'} · saved {fmtDate(record.updatedAt)}</div>
        </div>
        <div className="row nowrap">
          <select value={record.status} onChange={(e) => onUpdate({ ...record, status: e.target.value })} aria-label="Learning status" style={{ width: 'auto', fontSize: 11, padding: '4px 22px 4px 6px' }}>
            <option>Planned</option><option>In progress</option><option>Completed</option>
          </select>
          <Btn variant="quiet" size="xs" onClick={onRemove} aria-label="Remove learning record"><Trash2 size={12} /></Btn>
        </div>
      </div>

      <div className="grid g3 mt12" style={{ gap: 8 }}>
        {LEARNING_STAGES.map((s) => {
          const on = Boolean(record.stages?.[s.key]);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onUpdate({ ...record, stages: { ...(record.stages || {}), [s.key]: !on } })}
              style={{
                textAlign: 'left', border: `1px solid ${on ? 'var(--field)' : 'var(--line)'}`,
                background: on ? 'var(--sage)' : 'var(--surface)', padding: '8px 9px', borderRadius: 2, cursor: 'pointer',
              }}
              aria-pressed={on}
            >
              <span className="row" style={{ gap: 6 }}>
                <span className={`task-box ${on ? 'done' : ''}`} aria-hidden="true">{on ? <Check size={10} /> : null}</span>
                <span className="mono xs" style={{ letterSpacing: '.08em' }}>{s.label.toUpperCase()}</span>
              </span>
              <span className="xs muted" style={{ display: 'block', marginTop: 3 }}>{s.hint}</span>
            </button>
          );
        })}
      </div>

      {allDone && gap?.resolution !== 'resolved' && (
        <div className="mt12">
          <Notice tone="warn">
            <b>Learning complete does not resolve the project gap.</b> Record implementation evidence before marking “{gap?.skill}” resolved.
          </Notice>
        </div>
      )}

      <div className="form-grid mt12" style={{ gap: 10 }}>
        <Field label="Confidence before" htmlFor={`cb-${record.id}`}>
          <select id={`cb-${record.id}`} value={record.confidenceBefore ?? ''} onChange={(e) => onUpdate({ ...record, confidenceBefore: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Not recorded</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
          </select>
        </Field>
        <Field label="Confidence now" htmlFor={`ca-${record.id}`}>
          <select id={`ca-${record.id}`} value={record.confidenceAfter ?? ''} onChange={(e) => onUpdate({ ...record, confidenceAfter: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Not recorded</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
          </select>
        </Field>
      </div>

      <Field label="Notes" htmlFor={`note-${record.id}`}>
        <textarea id={`note-${record.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What clicked? What is still unclear?" />
      </Field>
      <div className="row between mt8">
        <span className="xs muted">{record.confidenceBefore && record.confidenceAfter ? `Confidence ${record.confidenceBefore} → ${record.confidenceAfter}` : 'Confidence not recorded'}</span>
        <div className="row" style={{ gap: 6 }}>
          {gap?.resolution !== 'resolved' && <Btn variant="ghost" size="xs" onClick={() => onResolve(gap)}><Target size={11} /> Record gap evidence</Btn>}
          <Btn variant="primary" size="xs" onClick={() => onUpdate({ ...record, notes })}>Save notes</Btn>
        </div>
      </div>
    </div>
  );
}

export default function LearningHub() {
  const project = useRouteProject();
  const { state, actions, pushToast } = useApp();
  const [tab, setTab] = useState('paths');
  const [modal, setModal] = useState(null);
  const [libQ, setLibQ] = useState('');
  const [libCat, setLibCat] = useState('');
  usePageTitle('Learning Hub');
  const p = project;

  const records = useMemo(() => (p ? state.learningProgress.filter((l) => l.projectId === p.id) : []), [state.learningProgress, p]);
  const savedIds = new Set(records.map((r) => r.resourceId));

  if (!p) return <MissingCase />;

  const resourcesById = (id) => LEARNING_RESOURCES.find((r) => r.id === id);
  const gapsById = (id) => p.skillGaps.find((g) => g.id === id);
  const openGaps = p.skillGaps.filter((g) => g.resolution !== 'resolved');
  const doneRecords = records.filter((r) => r.status === 'Completed').length;

  const saveGap = (data, existing) => {
    if (existing) actions.updateItem('skillGaps', existing.id, data, `Skill gap updated: ${data.skill}.`);
    else actions.addItem('skillGaps', skillGap(data), `Skill gap identified: ${data.skill}.`);
    pushToast(existing ? 'Skill gap updated.' : 'Skill gap added to the learning plan.');
    setModal(null);
  };

  const addResourceToGap = (resource, gap) => {
    if (records.some((r) => r.resourceId === resource.id && r.gapId === gap.id)) {
      pushToast('This resource is already in the path for that gap.');
      return;
    }
    actions.upsertLearning({
      id: `${gap.id}_${resource.id}`,
      projectId: p.id,
      gapId: gap.id,
      resourceId: resource.id,
      status: 'Planned',
      notes: '',
      confidenceBefore: gap.confidence ?? null,
      confidenceAfter: null,
      stages: { understand: false, practice: false, apply: false },
      createdAt: new Date().toISOString(),
    });
    pushToast('Resource added to the learning path.');
    setModal(null);
  };

  const resolveGap = (gap) => {
    setModal({ type: 'resolve', gap });
  };

  const filteredLibrary = LEARNING_RESOURCES.filter((r) => {
    const term = libQ.trim().toLowerCase();
    const matches = !term || `${r.title} ${r.skill} ${r.publisher} ${r.outcome}`.toLowerCase().includes(term);
    return matches && (!libCat || r.category === libCat);
  });

  return (
    <div>
      <PageHead
        eyebrow="07 · Build the missing skills"
        title="Learning Hub"
        description="Turn unresolved project gaps into a short path: understand the concept, practise it, then implement it in the actual demo. Finishing a tutorial is not the same as closing a gap."
        actions={<Btn variant="primary" onClick={() => setModal({ type: 'gap' })}><Plus size={14} /> Add skill gap</Btn>}
      />

      <div className="grid g4 mb16">
        {[
          ['Open gaps', String(openGaps.length)],
          ['Resolved gaps', String(p.skillGaps.length - openGaps.length)],
          ['Resources in log', String(records.length)],
          ['Resources completed', String(doneRecords)],
        ].map(([l, v]) => (
          <div key={l} className="card card-tight">
            <div className="eyebrow plain">{l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>

      <SegTabs value={tab} onChange={setTab} label="Learning views" options={[
        { value: 'paths', label: 'Gap paths', count: p.skillGaps.length },
        { value: 'library', label: 'Resource library', count: LEARNING_RESOURCES.length },
        { value: 'log', label: 'Learning log', count: records.length },
      ]} />

      {tab === 'paths' && (
        <>
          {p.skillGaps.length === 0 ? (
            <div className="card">
              <EmptyState icon={GraduationCap} title="No skill gaps recorded" action={<Btn variant="primary" onClick={() => setModal({ type: 'gap' })}>Identify the first gap</Btn>}>
                Look at your scope and acceptance criteria, then ask what the team cannot yet implement. Typical gaps: persistence, auth, API integration, data handling, deployment.
              </EmptyState>
            </div>
          ) : (
            <div className="stack">
              {p.skillGaps.map((g) => {
                const suggestions = matchedResources(g);
                const linkedRecords = records.filter((r) => r.gapId === g.id);
                const resolved = g.resolution === 'resolved';
                return (
                  <article key={g.id} className="card">
                    <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="badge outline">{g.category}</span>
                          <span className={`badge ${resolved ? 'green' : 'amber'}`}>{resolved ? 'Resolved with evidence' : 'Open gap'}</span>
                          <span className="mono xs muted">CONFIDENCE {g.confidence ?? '—'}/5</span>
                        </div>
                        <h3 style={{ fontSize: 18, marginTop: 5 }}>{g.skill}</h3>
                        <p className="small muted" style={{ maxWidth: '70ch' }}>{g.why || 'No project justification recorded.'}</p>
                      </div>
                      <div className="row nowrap">
                        <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'gap', gap: g })} aria-label={`Edit ${g.skill}`}><Edit3 size={12} /></Btn>
                        <Btn variant="quiet" size="xs" onClick={() => { actions.removeItem('skillGaps', g.id); pushToast('Skill gap removed.'); }} aria-label={`Delete ${g.skill}`}><Trash2 size={12} /></Btn>
                        {!resolved && <Btn variant="ghost" size="xs" onClick={() => resolveGap(g)}><Target size={11} /> Resolve</Btn>}
                        {resolved && <Btn variant="ghost" size="xs" onClick={() => { actions.updateItem('skillGaps', g.id, { resolution: 'open' }, `Skill gap reopened: ${g.skill}.`); pushToast('Gap reopened. Prior evidence note retained.'); }}>Reopen</Btn>}
                      </div>
                    </div>

                    {resolved && (
                      <div className="mt8"><Notice tone="ok"><b>Resolution evidence:</b> {g.evidenceNote || 'No evidence note recorded.'}</Notice></div>
                    )}

                    <div className="grid g2 mt12" style={{ gap: 14 }}>
                      <div>
                        <div className="mono xs muted">PREREQUISITE</div>
                        <div className="xs">{g.prerequisite || 'None recorded.'}</div>
                      </div>
                      <div>
                        <div className="mono xs muted">PROJECT APPLICATION TASK</div>
                        <div className="xs">{g.projectTask || 'Not defined.'}</div>
                      </div>
                      <div>
                        <div className="mono xs muted">EVIDENCE OF COMPETENCE</div>
                        <div className="xs">{g.competenceEvidence || 'Not defined.'}</div>
                      </div>
                      <div>
                        <div className="mono xs muted">PROGRESS RECORDS</div>
                        <div className="xs">{linkedRecords.length ? linkedRecords.map((r) => resourcesById(r.resourceId)?.title || 'Resource').join(' · ') : 'None saved yet.'}</div>
                      </div>
                    </div>

                    <div className="section-rule" style={{ margin: '16px 0 10px' }}><span>Three-stage path</span></div>
                    <div className="grid g3" style={{ gap: 10 }}>
                      {LEARNING_STAGES.map((stage, i) => {
                        const distinct = i === 0 ? suggestions[0] : suggestions.find((s) => s.id !== suggestions[0]?.id);
                        const suggested = i === 2 ? null : distinct;
                        const linked = linkedRecords.find((r) => r.resourceId === suggested?.id);
                        return (
                          <div key={stage.key} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                            <div className="mono xs" style={{ color: 'var(--field)', letterSpacing: '.1em' }}>{String(i + 1).padStart(2, '0')} · {stage.label.toUpperCase()}</div>
                            <div className="xs muted" style={{ marginTop: 3 }}>{stage.hint}</div>
                            {stage.key === 'apply' ? (
                              <div className="mt8">
                                <div className="xs">{g.projectTask || 'Define the implementation task for this gap.'}</div>
                                <div className="mono xs muted mt8">PROOF: {g.competenceEvidence || 'Not defined'}</div>
                              </div>
                            ) : suggested ? (
                              <div className="mt8">
                                <div className="xs strong">{suggested.title}</div>
                                <div className="xs muted">{suggested.publisher} · {suggested.difficulty}</div>
                                {suggested.url && <a href={suggested.url} target="_blank" rel="noopener noreferrer" className="xs link-out mt8" style={{ display: 'inline-flex' }}>Open <ExternalLink size={10} /></a>}
                                <div className="row between mt8" style={{ gap: 6 }}>
                                  <span className="badge demo">LINK NOT CHECKED</span>
                                  <Btn variant={linked ? 'ghost' : 'primary'} size="xs" onClick={() => addResourceToGap(suggested, g)}>{linked ? 'Saved' : 'Add to path'}</Btn>
                                </div>
                              </div>
                            ) : (
                              <div className="mt8">
                                <div className="xs muted">
                                  {i === 1
                                    ? `Write the smallest exercise that uses ${g.skill}, run it separately, then apply the same pattern in this project.`
                                    : 'No curated resource matches this gap. Search for a current, reputable source rather than relying on an invented link.'}
                                </div>
                                <a className="xs link-out mt8" href={`https://www.google.com/search?q=${encodeURIComponent(`${g.skill} ${stage.key} tutorial documentation`)}`} target="_blank" rel="noopener noreferrer">Suggested search <ExternalLink size={10} /></a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'library' && (
        <>
          <div className="toolbar">
            <div className="search">
              <Search size={14} aria-hidden="true" />
              <input type="search" value={libQ} onChange={(e) => setLibQ(e.target.value)} placeholder="Search skills, publishers, outcomes…" aria-label="Search learning resources" />
            </div>
            <select value={libCat} onChange={(e) => setLibCat(e.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <span className="mono xs muted">{filteredLibrary.length} resources</span>
          </div>
          <div className="demo-banner" role="note">
            <AlertTriangle size={15} aria-hidden="true" />
            <div><b>RESOURCE AVAILABILITY NOT VERIFIED</b> — links are to known publishers, but availability, free-tier terms, and course content were not checked in this session.</div>
          </div>
          <div className="grid g3">
            {filteredLibrary.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                saved={savedIds.has(r.id)}
                onSave={(res) => setModal({ type: 'link', resource: res })}
                onOpen={() => setTab('log')}
              />
            ))}
          </div>
          {filteredLibrary.length === 0 && (
            <div className="card"><EmptyState icon={BookOpen} title="No resources match" action={<Btn variant="ghost" onClick={() => { setLibQ(''); setLibCat(''); }}>Clear filters</Btn>}>
              Search the web for a current source, then add the gap and apply the skill directly in the project.
            </EmptyState></div>
          )}
        </>
      )}

      {tab === 'log' && (
        <>
          {records.length === 0 ? (
            <div className="card">
              <EmptyState icon={BookOpen} title="No learning saved yet" action={<Btn variant="primary" onClick={() => setTab('paths')}>Open gap paths</Btn>}>
                Save a resource from a gap path or the library. Progress, notes, and confidence are stored locally against this case.
              </EmptyState>
            </div>
          ) : (
            <div className="grid g2">
              {records.map((r) => (
                <LearningRecord
                  key={r.id}
                  record={r}
                  gap={gapsById(r.gapId)}
                  resource={resourcesById(r.resourceId)}
                  onUpdate={(next) => actions.upsertLearning(next)}
                  onRemove={() => { actions.removeLearning(r.id); pushToast('Learning record removed. The project gap remains open.'); }}
                  onResolve={resolveGap}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt16">
        <Notice>
          <b>Completing a tutorial does not verify the project.</b> A skill gap only becomes resolved when the implementation
          evidence recorded for it can be checked — for example, a repeatable test or a working workflow step.
        </Notice>
      </div>

      {modal?.type === 'gap' && (
        <Modal open onClose={() => setModal(null)} title={modal.gap ? 'Edit skill gap' : 'Identify a skill gap'} eyebrow="Gap to skill" wide>
          <GapForm initial={modal.gap} onCancel={() => setModal(null)} onSave={(d) => saveGap(d, modal.gap)} />
        </Modal>
      )}

      {modal?.type === 'link' && (
        <Modal open onClose={() => setModal(null)} title="Link resource to a project gap" eyebrow={modal.resource.title}>
          {p.skillGaps.filter((g) => g.resolution !== 'resolved').length === 0 ? (
            <div>
              <Notice tone="warn">No open skill gap exists. Add a gap first so learning stays tied to the project.</Notice>
              <div className="row mt12" style={{ justifyContent: 'flex-end' }}>
                <Btn variant="ghost" onClick={() => setModal(null)}>Close</Btn>
                <Btn variant="primary" onClick={() => { setModal({ type: 'gap' }); }}>Add skill gap</Btn>
              </div>
            </div>
          ) : (
            <div className="stack-sm">
              <p className="small muted">Choose the gap this resource addresses. Completing it will not resolve the gap automatically.</p>
              {p.skillGaps.filter((g) => g.resolution !== 'resolved').map((g) => (
                <button key={g.id} type="button" className="welcome-choice" style={{ padding: 10 }} onClick={() => addResourceToGap(modal.resource, g)}>
                  <span className="wc-num"><Link2 size={13} /></span>
                  <span>
                    <strong className="small">{g.skill}</strong>
                    <span className="xs muted" style={{ display: 'block' }}>{g.category} · confidence {g.confidence}/5</span>
                  </span>
                  <ArrowRight size={14} style={{ marginLeft: 'auto', alignSelf: 'center' }} />
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {modal?.type === 'resolve' && (
        <ResolveGapModal
          gap={modal.gap}
          onClose={() => setModal(null)}
          onSave={(note) => {
            actions.updateItem('skillGaps', modal.gap.id, { resolution: 'resolved', evidenceNote: note }, `Skill gap resolved with evidence: ${modal.gap.skill}.`);
            pushToast('Gap resolved with recorded evidence.');
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function ResolveGapModal({ gap, onClose, onSave }) {
  const [note, setNote] = useState(gap.evidenceNote || '');
  const [err, setErr] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Resolve: ${gap.skill}`}
      eyebrow="Implementation evidence required"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => { if (note.trim().length < 12) { setErr('Record a specific, checkable piece of implementation evidence.'); return; } onSave(note.trim()); }}>Mark gap resolved</Btn>
      </>}
    >
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <p className="small muted">
        Watching a tutorial is not evidence. Record what you implemented and how someone else can check it.
        The gap remains open until this note is specific enough to be verified.
      </p>
      <Field label="Implementation evidence" hint={gap.competenceEvidence ? `Expected proof: ${gap.competenceEvidence}` : undefined} htmlFor="resolve-note">
        <textarea id="resolve-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Requests and handoff records persist in local storage; reload test verified status history and timestamps." />
      </Field>
    </Modal>
  );
}
