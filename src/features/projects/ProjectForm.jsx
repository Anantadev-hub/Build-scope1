import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, Info } from 'lucide-react';
import { useApp } from '../../app/store';
import { Btn, Field, Hint, Notice, PageHead } from '../../components/ui';
import { feature } from '../../lib/models';
import { makeCaseId } from '../../lib/id';

const EMPTY = {
  name: '',
  problem: '',
  solution: '',
  targetUsers: [],
  features: [],
  desiredOutcome: '',
  hackathonName: '',
  officialBrief: '',
  teamSize: 2,
  skills: [],
  stack: [],
  timeAvailable: 24,
  budget: '',
  externalServices: '',
  dataSources: '',
  limitations: '',
  believedDifferentiation: '',
};

function CommaField({ label, value, onChange, placeholder, hint, id }) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type="text"
        value={Array.isArray(value) ? value.join(', ') : (value || '')}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
      />
    </Field>
  );
}

function FormSection({ num, title, children, note }) {
  return (
    <section style={{ borderTop: '1px solid var(--line)', paddingTop: 18, marginTop: 24 }}>
      <div className="spread" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Section {num}</div>
          <h2 style={{ fontSize: 19, marginTop: 3 }}>{title}</h2>
        </div>
        {note && <span className="mono xs muted" style={{ maxWidth: 230, textAlign: 'right' }}>{note}</span>}
      </div>
      <div className="stack" style={{ gap: 14 }}>{children}</div>
    </section>
  );
}

export default function ProjectForm({ mode = 'create' }) {
  const { id } = useParams();
  const { state, actions, pushToast } = useApp();
  const navigate = useNavigate();
  const existing = state.projects.find((p) => p.id === id) || null;
  const [draft, setDraft] = useState(() => (existing ? { ...existing } : { ...EMPTY }));
  const [guided, setGuided] = useState(true);
  const [error, setError] = useState('');

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const nextCase = makeCaseId(Math.max(1, state.preferences.caseSeq || 1));

  const complete = useMemo(() => {
    const checks = [
      ['Name', Boolean(draft.name.trim())],
      ['Problem', Boolean(draft.problem.trim())],
      ['Proposed solution', Boolean(draft.solution.trim())],
      ['Target users', draft.targetUsers.length > 0],
      ['Core features', draft.features.filter((f) => f.name.trim()).length >= 3],
    ];
    return { checks, score: checks.filter(([, ok]) => ok).length, total: checks.length };
  }, [draft]);

  const addFeature = () => set({ features: [...draft.features, feature({ name: '' })] });
  const updateFeature = (fid, patch) => set({ features: draft.features.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });
  const removeFeature = (fid) => set({ features: draft.features.filter((f) => f.id !== fid) });

  const save = (e) => {
    e?.preventDefault();
    if (!draft.name.trim()) {
      setError('A project name is required before the case can be opened.');
      document.getElementById('project-name')?.focus();
      return;
    }
    const cleaned = {
      ...draft,
      features: draft.features.filter((f) => f.name.trim()),
    };
    if (mode === 'edit' && existing) {
      actions.updateProject(existing.id, cleaned, 'Project brief updated.');
      pushToast('Brief saved locally.');
      navigate(`/projects/${existing.id}`);
    } else {
      const p = actions.createProject(cleaned);
      pushToast(`Case ${p.caseId} opened. Investigation workspace ready.`);
      navigate(`/projects/${p.id}`);
    }
  };

  return (
    <div>
      <PageHead
        eyebrow={mode === 'edit' ? `Editing case ${existing?.caseId || ''}` : 'New case file'}
        title={mode === 'edit' ? 'Edit project brief' : 'Open a new investigation'}
        description="A useful brief is specific about the problem, the user, and the demo outcome. Everything can be revised later — including after evidence contradicts the original idea."
        actions={<Btn variant="ghost" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Back</Btn>}
      />

      {!existing && mode === 'edit' && (
        <Notice tone="warn">This case no longer exists in local storage. You can create a new investigation instead.</Notice>
      )}

      <form onSubmit={save} noValidate>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px', alignItems: 'start' }}>
          <div>
            {error && <div className="mb16"><Notice tone="danger">{error}</Notice></div>}

            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div className="card-tight" style={{ border: '1px solid var(--line)', background: 'var(--sage)' }}>
                <span className="mono xs" style={{ letterSpacing: '.1em' }}>CASE ID</span>
                <div className="mono strong" style={{ fontSize: 14 }}>{existing?.caseId || nextCase}</div>
              </div>
              <label className="check" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} />
                <span><strong>Guided mode</strong> — show field explanations</span>
              </label>
            </div>

            <FormSection num="01" title="Identity & constraints" note="What you are attempting, and the real limits around it.">
              <div className="form-grid">
                <Field label="Project name" required hint={guided ? 'Concrete beats clever. “Kabadiwala Connect” tells a judge more than “EcoSync 3000”.' : undefined} htmlFor="project-name">
                  <input id="project-name" type="text" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Campus Ride Share" autoComplete="off" />
                </Field>
                <Field label="Hackathon name (if known)" hint={guided ? 'Optional. Adding it links the case to requirement mapping.' : undefined} htmlFor="hackathon-name">
                  <input id="hackathon-name" type="text" value={draft.hackathonName} onChange={(e) => set({ hackathonName: e.target.value })} placeholder="e.g. Campus Sustainability Sprint" />
                </Field>
                <Field label="Team size" hint={guided ? 'Used with time available to estimate total person-hours.' : undefined} htmlFor="team-size">
                  <input id="team-size" type="number" min="1" max="20" value={draft.teamSize} onChange={(e) => set({ teamSize: Number(e.target.value) })} />
                </Field>
                <Field label="Hours available per person" hint={guided ? 'Planning assumption, not a promise. Mission 04 uses it to check scope.' : undefined} htmlFor="hours">
                  <input id="hours" type="number" min="1" max="400" value={draft.timeAvailable} onChange={(e) => set({ timeAvailable: Number(e.target.value) })} />
                </Field>
              </div>
              <CommaField id="stack" label="Preferred technology stack" value={draft.stack} onChange={(v) => set({ stack: v })} placeholder="React, JavaScript, Vite" hint={guided ? 'Separate with commas. Only list what the team can actually support during the event.' : undefined} />
            </FormSection>

            <FormSection num="02" title="The problem worth solving" note="Evidence starts with a precise problem, not a feature list.">
              <Field label="Problem statement" required hint={guided ? 'Who struggles, with what, and what happens as a result? One paragraph is enough.' : undefined} htmlFor="problem">
                <textarea id="problem" rows={4} value={draft.problem} onChange={(e) => set({ problem: e.target.value })} placeholder="Households and small businesses can struggle to find reliable local waste collectors and verified recyclers…" />
              </Field>
              <CommaField id="users" label="Target users" value={draft.targetUsers} onChange={(v) => set({ targetUsers: v })} placeholder="Households, local collectors, recycling businesses" hint={guided ? 'Be specific. “Everyone” usually means no one is designed for.' : undefined} />
              <Field label="Proposed solution" required hint={guided ? 'Describe the workflow, not the technology. What changes for the user between before and after?' : undefined} htmlFor="solution">
                <textarea id="solution" rows={4} value={draft.solution} onChange={(e) => set({ solution: e.target.value })} placeholder="A role-based platform connecting households, collectors, and recyclers…" />
              </Field>
              <Field label="Desired outcome" hint={guided ? "What should be true at the end of the hackathon, from a judge's point of view?" : undefined} htmlFor="outcome">
                <textarea id="outcome" rows={2} value={draft.desiredOutcome} onChange={(e) => set({ desiredOutcome: e.target.value })} placeholder="A working end-to-end pickup workflow with persistent status changes and a traceable handoff record." />
              </Field>
            </FormSection>

            <FormSection num="03" title="Core features" note="Only features that support the demo workflow belong here.">
              {draft.features.length === 0 && (
                <p className="small muted">No features yet. Add the three to five capabilities needed for the end-to-end demo. Mission 04 turns these into acceptance criteria.</p>
              )}
              <div className="stack-sm">
                {draft.features.map((f, i) => (
                  <div key={f.id} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                    <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
                      <span className="mono xs muted" style={{ paddingTop: 7 }}>{String(i + 1).padStart(2, '0')}</span>
                      <div className="col" style={{ flex: 1 }}>
                        <input type="text" value={f.name} onChange={(e) => updateFeature(f.id, { name: e.target.value })} placeholder="Feature name" aria-label={`Feature ${i + 1} name`} />
                        <input type="text" value={f.description} onChange={(e) => updateFeature(f.id, { description: e.target.value })} placeholder="What it lets the user do" aria-label={`Feature ${i + 1} description`} style={{ fontSize: 12 }} />
                        <label className="check">
                          <input type="checkbox" checked={f.essential} onChange={(e) => updateFeature(f.id, { essential: e.target.checked })} />
                          <span className="xs">Essential for the demo</span>
                        </label>
                      </div>
                      <Btn variant="quiet" size="xs" onClick={() => removeFeature(f.id)} aria-label={`Remove feature ${i + 1}`}><Trash2 size={13} /></Btn>
                    </div>
                  </div>
                ))}
              </div>
              <Btn variant="ghost" size="sm" onClick={addFeature}><Plus size={13} /> Add feature</Btn>
            </FormSection>

            <FormSection num="04" title="Constraints & assumptions" note="Write down what you do not have. It is cheaper now than at hour 30.">
              <div className="form-grid">
                <CommaField id="skills" label="Available skills" value={draft.skills} onChange={(v) => set({ skills: v })} placeholder="React, beginner backend, data visualisation" />
                <Field label="Budget constraints" hint={guided ? 'Free tiers and their limits belong here too.' : undefined} htmlFor="budget">
                  <input id="budget" type="text" value={draft.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="Prefer free and open-source tools" />
                </Field>
              </div>
              <Field label="External services or APIs you expect to use" hint={guided ? 'These become feasibility checks. Expect some to be unavailable.' : undefined} htmlFor="services">
                <textarea id="services" rows={2} value={draft.externalServices} onChange={(e) => set({ externalServices: e.target.value })} placeholder="OpenStreetMap tiles, no paid geocoding, no live inventory feed" />
              </Field>
              <Field label="Data sources required" hint={guided ? 'If the demo depends on data you do not have, say so now.' : undefined} htmlFor="datasources">
                <textarea id="datasources" rows={2} value={draft.dataSources} onChange={(e) => set({ dataSources: e.target.value })} placeholder="Manual entry plus a seeded demo dataset" />
              </Field>
              <Field label="Known limitations" htmlFor="limitations">
                <textarea id="limitations" rows={3} value={draft.limitations} onChange={(e) => set({ limitations: e.target.value })} placeholder="No guaranteed live data. Limited backend experience. Impact cannot be measured from a prototype." />
              </Field>
            </FormSection>

            <FormSection num="05" title="Differentiation hypothesis" note="A hypothesis to test, not a claim to defend.">
              <Field label="What do you believe makes this different?" hint={guided ? 'Phrase it as a hypothesis. Mission 02 checks whether evidence supports it, weakens it, or contradicts it.' : undefined} htmlFor="diff">
                <textarea id="diff" rows={3} value={draft.believedDifferentiation} onChange={(e) => set({ believedDifferentiation: e.target.value })} placeholder="Traceability from pickup to recycler handoff, with a credible fallback when live data is unavailable." />
              </Field>
            </FormSection>

            <FormSection num="06" title="Official brief" note="Never paraphrase official rules from memory.">
              <Field label="Official problem statement or brief (paste verbatim)" hint={guided ? 'Leave blank if you do not have the official brief. Compliance will stay unverified until it is added and checked.' : undefined} htmlFor="brief">
                <textarea id="brief" rows={5} value={draft.officialBrief} onChange={(e) => set({ officialBrief: e.target.value })} placeholder="Paste the official brief, judging criteria, or eligibility rules here." />
              </Field>
              <Hint>
                Adding text here does not verify the brief. Record the official source URL and check date in the
                Requirements workspace before claiming compliance.
              </Hint>
            </FormSection>

            <div className="row between" style={{ borderTop: '1px solid var(--line)', marginTop: 26, paddingTop: 16 }}>
              <Link to={existing ? `/projects/${existing.id}` : '/projects'} className="btn ghost">Cancel</Link>
              <Btn variant="primary" onClick={save}><Save size={15} /> {mode === 'edit' ? 'Save brief' : 'Open case file'}</Btn>
            </div>
          </div>

          <aside style={{ position: 'sticky', top: 72 }}>
            <div className="card">
              <div className="eyebrow">Brief completeness</div>
              <div className="row between" style={{ marginTop: 8, alignItems: 'baseline' }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{complete.score}/{complete.total}</strong>
                <span className="mono xs muted">ESSENTIAL FIELDS</span>
              </div>
              <div className="track mt12" style={{ height: 6 }}>
                {complete.checks.map(([label, ok]) => <span key={label} className={ok ? 'on' : ''} />)}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 14 }} className="stack-sm">
                {complete.checks.map(([label, ok]) => (
                  <li key={label} className="row" style={{ gap: 7, fontSize: 12 }}>
                    <span className={`task-box ${ok ? 'done' : ''}`} aria-hidden="true">{ok ? '✓' : ''}</span>
                    <span className={ok ? '' : 'muted'}>{label}</span>
                  </li>
                ))}
              </ul>
              <div className="line" />
              <p className="xs muted mb0">
                Saving a partial brief is allowed. Mission 01 will not complete until the essential fields exist.
              </p>
            </div>

            <div className="card mt12" style={{ background: 'var(--sage)' }}>
              <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                <Info size={15} style={{ marginTop: 2, flex: '0 0 auto' }} />
                <div className="xs">
                  <strong>What happens next</strong>
                  <p className="mb0 mt8">Mission Control opens at Mission 01. Investigate existing solutions before committing to the build plan.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
