import React, { useMemo, useState } from 'react';
import {
  Plus, CalendarClock, Search, MapPin, Users, ExternalLink, AlertTriangle, Trash2, Edit3, ArrowRight, ShieldCheck, Flag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../app/store';
import { usePageTitle } from '../../app/hooks';
import {
  Badge, Btn, Card, EmptyState, Field, Modal, Notice, PageHead, StatusBadge,
} from '../../components/ui';
import { DEMO_HACKATHONS } from '../../data/demo';
import { HACKATHON_STATUS, HACKATHON_VERIFICATION } from '../../lib/constants';
import { daysUntil, fmtDate, safeHref } from '../../lib/format';
import { uid, nowIso } from '../../lib/id';

const FIELDS = ['Dates', 'Registration deadline', 'Format', 'Location', 'Theme', 'Team size', 'Eligibility', 'Cost'];
const CONFIRMABLE_COST = ['Unconfirmed', 'Free', 'Paid'];

function timeStatus(e) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = e.startsAt ? new Date(e.startsAt) : null;
  const end = e.endsAt ? new Date(e.endsAt) : start;
  if (!start || Number.isNaN(start.getTime())) return 'unknown';
  if (end && end < today) return 'past';
  if (start <= today && end >= today) return 'ongoing';
  return 'upcoming';
}

function regStatus(e) {
  if (!e.registrationDeadline) return 'unconfirmed';
  const d = new Date(e.registrationDeadline);
  if (Number.isNaN(d.getTime())) return 'unconfirmed';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today ? 'closed' : 'open';
}

function teamFits(teamSize, n) {
  if (!n) return true;
  const nums = String(teamSize || '').match(/\d+/g);
  if (!nums) return true;
  const min = Number(nums[0]);
  const max = nums.length > 1 ? Number(nums[1]) : min;
  return n >= min && n <= max;
}

function verificationMeta(key) {
  return HACKATHON_VERIFICATION[key] || HACKATHON_VERIFICATION.unverified;
}

function DateBlock({ date }) {
  if (!date) return <div className="date-block"><div className="d">—</div><div className="m">TBD</div></div>;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return <div className="date-block"><div className="d">—</div><div className="m">TBD</div></div>;
  return (
    <div className="date-block">
      <div className="d">{String(d.getDate()).padStart(2, '0')}</div>
      <div className="m">{d.toLocaleString('en', { month: 'short' })} {String(d.getFullYear()).slice(2)}</div>
    </div>
  );
}

function AddHackathonForm({ onSave, onCancel, hasProjects }) {
  const [f, setF] = useState({
    name: '', organiser: '', url: '', registrationUrl: '', startsAt: '', endsAt: '',
    registrationDeadline: '', format: 'Online', location: 'Remote', theme: '',
    participation: 'Team', teamSize: '2–4', eligibility: '', cost: 'Unconfirmed',
    whyMatch: '', checkedAt: '', verification: 'unverified', fieldsConfirmed: [],
  });
  const [err, setErr] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) { setErr('An event name is required.'); return; }
    if (f.verification === 'verified' && (!f.checkedAt || !f.url)) {
      setErr('Marking an event verified requires an official source URL and the date checked.');
      return;
    }
    onSave(f);
  };
  return (
    <form onSubmit={submit}>
      {err && <div className="mb16"><Notice tone="danger">{err}</Notice></div>}
      <Notice>
        Manual listing. BuildScope did not search or verify this event. Only mark fields you personally confirmed against an
        official organiser source.
      </Notice>
      <div className="form-grid mt12">
        <Field label="Event name" required htmlFor="hk-name"><input id="hk-name" type="text" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Organiser" htmlFor="hk-org"><input id="hk-org" type="text" value={f.organiser} onChange={(e) => set({ organiser: e.target.value })} /></Field>
        <Field label="Official event URL" htmlFor="hk-url"><input id="hk-url" type="url" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Registration URL" htmlFor="hk-reg"><input id="hk-reg" type="url" value={f.registrationUrl} onChange={(e) => set({ registrationUrl: e.target.value })} /></Field>
        <Field label="Start date" htmlFor="hk-start"><input id="hk-start" type="date" value={f.startsAt} onChange={(e) => set({ startsAt: e.target.value })} /></Field>
        <Field label="End date" htmlFor="hk-end"><input id="hk-end" type="date" value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} /></Field>
        <Field label="Registration deadline" hint="Leave blank if not confirmed." htmlFor="hk-deadline"><input id="hk-deadline" type="date" value={f.registrationDeadline} onChange={(e) => set({ registrationDeadline: e.target.value })} /></Field>
        <Field label="Format" htmlFor="hk-format">
          <select id="hk-format" value={f.format} onChange={(e) => set({ format: e.target.value })}><option>Online</option><option>In person</option><option>Hybrid</option></select>
        </Field>
        <Field label="Location" htmlFor="hk-loc"><input id="hk-loc" type="text" value={f.location} onChange={(e) => set({ location: e.target.value })} /></Field>
        <Field label="Theme" htmlFor="hk-theme"><input id="hk-theme" type="text" value={f.theme} onChange={(e) => set({ theme: e.target.value })} placeholder="e.g. Sustainability" /></Field>
        <Field label="Participation" htmlFor="hk-part"><select id="hk-part" value={f.participation} onChange={(e) => set({ participation: e.target.value })}><option>Team</option><option>Individual</option><option>Either</option></select></Field>
        <Field label="Team size" htmlFor="hk-team"><input id="hk-team" type="text" value={f.teamSize} onChange={(e) => set({ teamSize: e.target.value })} placeholder="2–4" /></Field>
        <Field label="Eligibility" htmlFor="hk-elig"><input id="hk-elig" type="text" value={f.eligibility} onChange={(e) => set({ eligibility: e.target.value })} /></Field>
        <Field label="Cost" htmlFor="hk-cost"><select id="hk-cost" value={f.cost} onChange={(e) => set({ cost: e.target.value })}>{CONFIRMABLE_COST.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Date checked" hint="Required for verified status." htmlFor="hk-checked"><input id="hk-checked" type="date" value={f.checkedAt} onChange={(e) => set({ checkedAt: e.target.value })} /></Field>
        <Field label="Verification" htmlFor="hk-ver">
          <select id="hk-ver" value={f.verification} onChange={(e) => set({ verification: e.target.value })}>
            {Object.entries(HACKATHON_VERIFICATION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <div className="span2">
          <Field label="Why it may match the project" htmlFor="hk-why"><textarea id="hk-why" rows={2} value={f.whyMatch} onChange={(e) => set({ whyMatch: e.target.value })} /></Field>
        </div>
        <div className="span2">
          <div className="label" style={{ marginBottom: 5 }}>Fields confirmed against the source</div>
          <div className="chip-row">
            {FIELDS.map((field) => (
              <label key={field} className="check" style={{ border: '1px solid var(--line)', padding: '3px 7px', borderRadius: 2 }}>
                <input type="checkbox" checked={f.fieldsConfirmed.includes(field)} onChange={(e) => set({ fieldsConfirmed: e.target.checked ? [...f.fieldsConfirmed, field] : f.fieldsConfirmed.filter((x) => x !== field) })} />
                <span className="xs">{field}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={!hasProjects} title={hasProjects ? '' : 'Create a project first to track opportunities'}>Save listing</Btn>
      </div>
    </form>
  );
}

function TrackingModal({ event, tracking, projects, defaultProjectId, onClose, onSave, onRemove, onViewProject }) {
  const [f, setF] = useState({
    status: tracking?.status || 'Interested',
    notes: tracking?.notes || '',
    teamSize: tracking?.teamSize ?? 1,
    projectId: tracking?.projectId || defaultProjectId || '',
    checklist: tracking?.checklist || [],
    tasks: tracking?.tasks || [],
  });
  const [label, setLabel] = useState('');
  const [taskLabel, setTaskLabel] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={event.name}
      eyebrow="Opportunity tracking"
      footer={<>
        {tracking && <Btn variant="danger" onClick={onRemove}><Trash2 size={13} /> Remove tracking</Btn>}
        <span style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => onSave({
          ...f,
          checklist: f.checklist.filter((c) => c.label.trim()),
          tasks: f.tasks.filter((t) => t.label.trim()),
        })}>Save tracking</Btn>
      </>}
    >
      <div className="grid g2" style={{ gap: 14 }}>
        <Field label="Project" htmlFor="trk-project">
          <select id="trk-project" value={f.projectId} onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">Not linked</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.caseId} · {p.name}</option>)}
          </select>
        </Field>
        <Field label="Your status" htmlFor="trk-status">
          <select id="trk-status" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            {HACKATHON_STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Team size for this event" htmlFor="trk-size">
          <input id="trk-size" type="number" min="1" max="20" value={f.teamSize} onChange={(e) => set({ teamSize: Number(e.target.value) })} />
        </Field>
        <Field label="Event dates" htmlFor="trk-dates">
          <input id="trk-dates" type="text" value={`${fmtDate(event.startsAt)} → ${fmtDate(event.endsAt)}`} disabled />
        </Field>
      </div>

      <div className="mt12">
        <Field label="Notes" htmlFor="trk-notes"><textarea id="trk-notes" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>

      <div className="grid g2 mt12" style={{ gap: 16 }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Eligibility checklist</div>
          <div className="stack-sm">
            {f.checklist.map((c) => (
              <div key={c.id} className="row" style={{ gap: 6 }}>
                <input type="checkbox" checked={c.done} onChange={(e) => set({ checklist: f.checklist.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)) })} aria-label={c.label} />
                <span className="xs" style={{ flex: 1 }}>{c.label}</span>
                <Btn variant="quiet" size="xs" onClick={() => set({ checklist: f.checklist.filter((x) => x.id !== c.id) })} aria-label="Remove checklist item"><Trash2 size={11} /></Btn>
              </div>
            ))}
          </div>
          <div className="row mt8" style={{ gap: 6 }}>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add eligibility item" aria-label="New eligibility item" />
            <Btn variant="ghost" size="sm" aria-label="Add eligibility item" onClick={() => { if (label.trim()) { set({ checklist: [...f.checklist, { id: uid('chk'), label: label.trim(), done: false }] }); setLabel(''); } }}><Plus size={12} /></Btn>
          </div>
        </div>

        <div>
          <div className="label" style={{ marginBottom: 6 }}>Preparation tasks</div>
          <div className="stack-sm">
            {f.tasks.map((t) => (
              <div key={t.id} className="row" style={{ gap: 6 }}>
                <input type="checkbox" checked={t.done} onChange={(e) => set({ tasks: f.tasks.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)) })} aria-label={t.label} />
                <span className="xs" style={{ flex: 1 }}>{t.label}{t.due ? <span className="mono muted"> · {fmtDate(t.due)}</span> : null}</span>
                <Btn variant="quiet" size="xs" onClick={() => set({ tasks: f.tasks.filter((x) => x.id !== t.id) })} aria-label="Remove task"><Trash2 size={11} /></Btn>
              </div>
            ))}
          </div>
          <div className="row mt8" style={{ gap: 6 }}>
            <input type="text" value={taskLabel} onChange={(e) => setTaskLabel(e.target.value)} placeholder="Add preparation task" aria-label="New preparation task" />
            <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} aria-label="Task due date" style={{ width: 140 }} />
            <Btn variant="ghost" size="sm" aria-label="Add preparation task" onClick={() => { if (taskLabel.trim()) { set({ tasks: [...f.tasks, { id: uid('task'), label: taskLabel.trim(), done: false, due: taskDue }] }); setTaskLabel(''); setTaskDue(''); } }}><Plus size={12} /></Btn>
          </div>
        </div>
      </div>

      <div className="mt12">
        <Notice tone={verificationMeta(event.verification).cls === 'green' ? 'ok' : 'warn'}>
          Verification: <b>{verificationMeta(event.verification).label}</b>. {event.demo ? 'This is a simulated demo listing; its dates are not real deadlines.' : 'Only fields you confirmed are treated as known.'}
        </Notice>
      </div>
      {f.projectId && tracking && (
        <div className="mt12"><Btn variant="ghost" size="sm" onClick={() => onViewProject(f.projectId)}>Open linked project <ArrowRight size={12} /></Btn></div>
      )}
    </Modal>
  );
}

export default function HackathonRadar() {
  const { state, actions, pushToast } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ time: '', reg: '', format: '', domain: '', participation: '', cost: '', team: '', from: '', to: '' });
  const [sort, setSort] = useState('soonest');
  const [modal, setModal] = useState(null);
  usePageTitle('Hackathon Radar');

  const events = useMemo(() => [...state.hackathons, ...DEMO_HACKATHONS], [state.hackathons]);
  const domains = [...new Set(events.flatMap((e) => e.domains || []))];
  const project = state.projects.find((p) => p.id === state.activeProjectId) || null;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = events.filter((e) => {
      if (term && !`${e.name} ${e.organiser} ${e.theme} ${(e.domains || []).join(' ')} ${e.location}`.toLowerCase().includes(term)) return false;
      if (filters.time && timeStatus(e) !== filters.time) return false;
      if (filters.reg && regStatus(e) !== filters.reg) return false;
      if (filters.format && e.format !== filters.format) return false;
      if (filters.domain && !(e.domains || []).includes(filters.domain)) return false;
      if (filters.participation && e.participation !== filters.participation) return false;
      if (filters.cost && (e.cost || 'Unconfirmed') !== filters.cost) return false;
      if (filters.team && !teamFits(e.teamSize, Number(filters.team))) return false;
      if (filters.from && e.startsAt && e.startsAt < filters.from) return false;
      if (filters.to && e.startsAt && e.startsAt > filters.to) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'checked') return String(b.checkedAt).localeCompare(String(a.checkedAt));
      return String(a.startsAt || '9999').localeCompare(String(b.startsAt || '9999'));
    });
    return out;
  }, [events, q, filters, sort]);

  const tracked = state.hackathonTracking;
  const trackingFor = (eventId) => tracked.find((t) => t.hackathonId === eventId);
  const eventById = (id) => events.find((e) => e.id === id);

  const deadlineLabel = (e) => {
    const reliable = e.verification === 'verified' || (e.fieldsConfirmed || []).includes('Registration deadline');
    if (!e.registrationDeadline) return { text: 'Registration deadline unconfirmed', reliable: false };
    if (!reliable) return { text: `Unconfirmed date: ${fmtDate(e.registrationDeadline)}`, reliable: false };
    const days = daysUntil(e.registrationDeadline);
    if (days == null) return { text: 'Registration deadline unconfirmed', reliable: false };
    if (days < 0) return { text: `Registration closed ${fmtDate(e.registrationDeadline)}`, reliable: true };
    return { text: `Registration closes ${fmtDate(e.registrationDeadline)} · ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`, reliable: true };
  };

  const saveTracking = (event, data) => {
    const existing = trackingFor(event.id);
    const rec = {
      id: existing?.id || uid('trk'),
      hackathonId: event.id,
      projectId: data.projectId,
      status: data.status,
      notes: data.notes,
      teamSize: data.teamSize,
      checklist: data.checklist,
      tasks: data.tasks,
      createdAt: existing?.createdAt || nowIso(),
    };
    actions.upsertTracking(rec);
    pushToast(existing ? 'Opportunity tracking updated.' : 'Opportunity saved to your radar.');
    setModal(null);
  };

  const removeTracking = (event) => {
    const t = trackingFor(event.id);
    if (t) actions.removeTracking(t.id);
    pushToast('Tracking removed. The event listing is unchanged.');
    setModal(null);
  };

  return (
    <div>
      <PageHead
        eyebrow="08 · Field opportunities"
        title="Hackathon Radar"
        description="Find events worth your time and track what preparation they require. A listing is only treated as verified when key fields were checked against an official organiser source."
        actions={<Btn variant="primary" onClick={() => setModal({ type: 'add' })}><Plus size={14} /> Add event manually</Btn>}
      />

      <div className="demo-banner" role="note">
        <AlertTriangle size={15} aria-hidden="true" />
        <div>
          <b>DEMO DATA — NOT LIVE VERIFIED.</b> Every seeded event below is a simulated fixture with a fictional organiser.
          Dates are illustrative, not real deadlines, and no event is described as accepting registrations. Add a live listing
          yourself after checking the official source.
        </div>
      </div>

      <div className="grid g4 mb16">
        {[
          ['Simulated listings', String(DEMO_HACKATHONS.length)],
          ['Manual listings', String(state.hackathons.length)],
          ['Tracked opportunities', String(tracked.length)],
          ['Verified events', String(events.filter((e) => e.verification === 'verified').length)],
        ].map(([l, v]) => (
          <div key={l} className="card card-tight">
            <div className="eyebrow plain">{l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>

      {tracked.length > 0 && (
        <Card title="Tracked opportunities" eyebrow="Your application pipeline" className="mb16">
          <div className="stack-sm">
            {tracked.map((t) => {
              const e = eventById(t.hackathonId);
              if (!e) return null;
              const tasksDone = (t.tasks || []).filter((x) => x.done).length;
              return (
                <div key={t.id} className="spread" style={{ alignItems: 'flex-start', gap: 10, borderBottom: '1px dashed var(--line-soft)', paddingBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="small strong">{e.name}</span>
                      <StatusBadge meta={verificationMeta(e.verification)} />
                      {e.demo && <Badge tone="demo">DEMO</Badge>}
                    </div>
                    <div className="xs muted">
                      {t.projectId ? `Linked to ${state.projects.find((p) => p.id === t.projectId)?.caseId || 'a deleted project'}` : 'Not linked to a project'}
                      {' · '}{tasksDone}/{t.tasks?.length || 0} prep tasks done
                      {' · '}{t.status}
                    </div>
                    {e.demo && <div className="xs" style={{ color: 'var(--orange)' }}>DEMO LISTING — dates simulated, not verified.</div>}
                    {t.notes && <div className="xs muted clamp-2">{t.notes}</div>}
                  </div>
                  <div className="row nowrap">
                    <select
                      value={t.status}
                      onChange={(ev) => actions.upsertTracking({ ...t, status: ev.target.value })}
                      aria-label={`Tracking status for ${e.name}`}
                      style={{ width: 'auto', fontSize: 11, padding: '4px 22px 4px 6px' }}
                    >
                      {HACKATHON_STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <Btn variant="ghost" size="xs" onClick={() => setModal({ type: 'track', event: e })}><Edit3 size={12} /> Manage</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="toolbar">
        <div className="search">
          <Search size={14} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, themes, organisers, locations…" aria-label="Search hackathons" />
        </div>
        <select value={filters.time} onChange={(e) => setFilters({ ...filters, time: e.target.value })} aria-label="Filter by event period">
          <option value="">Any period</option>
          <option value="upcoming">Upcoming</option>
          <option value="ongoing">Ongoing</option>
          <option value="past">Past</option>
        </select>
        <select value={filters.reg} onChange={(e) => setFilters({ ...filters, reg: e.target.value })} aria-label="Filter by registration state">
          <option value="">Any registration state</option>
          <option value="open">Registration open</option>
          <option value="closed">Registration closed</option>
          <option value="unconfirmed">Unconfirmed</option>
        </select>
        <select value={filters.format} onChange={(e) => setFilters({ ...filters, format: e.target.value })} aria-label="Filter by format">
          <option value="">Any format</option>
          <option>Online</option><option>In person</option><option>Hybrid</option>
        </select>
        <select value={filters.domain} onChange={(e) => setFilters({ ...filters, domain: e.target.value })} aria-label="Filter by theme">
          <option value="">Any theme</option>
          {domains.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={filters.participation} onChange={(e) => setFilters({ ...filters, participation: e.target.value })} aria-label="Filter by participation">
          <option value="">Team or individual</option>
          <option>Team</option><option>Individual</option><option>Either</option>
        </select>
        <select value={filters.cost} onChange={(e) => setFilters({ ...filters, cost: e.target.value })} aria-label="Filter by cost">
          <option value="">Any cost</option>
          <option>Free</option><option>Paid</option><option>Unconfirmed</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} aria-label="Event start after" style={{ width: 'auto' }} />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} aria-label="Event start before" style={{ width: 'auto' }} />
        <select value={filters.team} onChange={(e) => setFilters({ ...filters, team: e.target.value })} aria-label="Filter by team size">
          <option value="">Any team size</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} member{n > 1 ? 's' : ''}</option>)}
        </select>
        <div className="divider" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort events">
          <option value="soonest">Sort: soonest</option>
          <option value="checked">Sort: last checked</option>
          <option value="name">Sort: name</option>
        </select>
        {(q || Object.values(filters).some(Boolean)) && (
          <Btn variant="quiet" size="sm" onClick={() => { setQ(''); setFilters({ time: '', reg: '', format: '', domain: '', participation: '', cost: '', team: '', from: '', to: '' }); }}>Clear</Btn>
        )}
      </div>

      <div className="spread mb16">
        <span className="mono xs muted">{filtered.length} OF {events.length} LISTINGS</span>
        <span className="mono xs muted">UPCOMING FIRST · VERIFICATION IS PER FIELD</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={CalendarClock} title="No events match these filters" action={<Btn variant="ghost" onClick={() => { setQ(''); setFilters({ time: '', reg: '', format: '', domain: '', participation: '', cost: '', team: '', from: '', to: '' }); }}>Clear filters</Btn>}>
          Filters are combined. Clearing them will not delete your tracked opportunities or preparation tasks.
        </EmptyState></div>
      ) : (
        <div className="grid g3">
          {filtered.map((e) => {
            const v = verificationMeta(e.verification);
            const dl = deadlineLabel(e);
            const isTracked = Boolean(trackingFor(e.id));
            return (
              <article key={e.id} className="card hack-card">
                <div className="spread" style={{ alignItems: 'flex-start', gap: 6 }}>
                  <div className="row" style={{ gap: 5 }}>
                    <StatusBadge meta={v} />
                    {e.demo && <Badge tone="demo">DEMO</Badge>}
                  </div>
                  {isTracked && <Badge tone="sage">TRACKED</Badge>}
                </div>

                <div>
                  <h3 style={{ fontSize: 16, lineHeight: 1.25 }}>{e.name}</h3>
                  <div className="xs muted">{e.organiser || 'Organiser not recorded'}</div>
                </div>

                <div className="hack-dates">
                  <DateBlock date={e.startsAt} />
                  <span>→</span>
                  <DateBlock date={e.endsAt} />
                  <span className="mono xs" style={{ marginLeft: 4 }}>
                    {timeStatus(e).toUpperCase()}
                    <br />
                    {e.format} · {e.location}
                  </span>
                </div>

                <div className="stack-sm" style={{ gap: 4 }}>
                  <div className={`xs ${dl.reliable ? '' : 'muted'}`}>
                    <Flag size={11} style={{ verticalAlign: -1 }} /> {dl.text}
                    {!dl.reliable && e.registrationDeadline ? ' — not a confirmed deadline' : ''}
                  </div>
                  <div className="xs muted"><Users size={11} style={{ verticalAlign: -1 }} /> {e.teamSize || 'Team size unknown'} · {e.participation || 'Participation unknown'} · {e.cost || 'Cost unconfirmed'}</div>
                  <div className="xs muted"><MapPin size={11} style={{ verticalAlign: -1 }} /> {e.theme || 'Theme not recorded'}</div>
                </div>

                {e.whyMatch && <div className="evidence-strip"><div className="mono xs muted">WHY IT MAY MATCH</div><div className="xs">{e.whyMatch}</div></div>}

                <div className="xs muted" style={{ lineHeight: 1.5 }}>
                  <b>Checked:</b> {e.checkedAt ? fmtDate(e.checkedAt) : 'not checked by you'} · <b>Fields confirmed:</b> {(e.fieldsConfirmed || []).length ? e.fieldsConfirmed.join(', ') : 'none'}
                </div>
                {e.notes && <div className="xs" style={{ color: 'var(--orange)' }}>{e.notes}</div>}

                <div className="row between" style={{ marginTop: 'auto', paddingTop: 6 }}>
                  <div className="source-line">
                    {safeHref(e.url) ? <a href={e.url} target="_blank" rel="noopener noreferrer nofollow">Official page <ExternalLink size={10} /></a> : <span>No official link recorded</span>}
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {e.demo && <Btn variant="quiet" size="xs" onClick={() => setModal({ type: 'details', event: e })} aria-label="Why this is demo data"><ShieldCheck size={12} /></Btn>}
                    <Btn variant={isTracked ? 'ghost' : 'primary'} size="xs" onClick={() => setModal({ type: 'track', event: e })}>
                      {isTracked ? 'Manage' : 'Save'} <ArrowRight size={11} />
                    </Btn>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt16">
        <Notice tone="warn">
          <b>Verification is per field.</b> A listing marked verified means the confirmed fields (dates, deadline, format, eligibility, cost)
          were checked against an official source on the recorded date. Everything else remains unknown. Unverified demo listings must not
          drive real deadline decisions.
        </Notice>
      </div>

      {modal?.type === 'add' && (
        <Modal open wide onClose={() => setModal(null)} title="Add a hackathon listing" eyebrow="Manual entry, honest fields">
          <AddHackathonForm
            hasProjects={state.projects.length > 0}
            onCancel={() => setModal(null)}
            onSave={(data) => {
              actions.addHackathon({ ...data, id: uid('hk'), demo: false, domains: data.theme ? [data.theme] : [], tech: [], source: 'manual' });
              pushToast('Listing saved as a manual record. Only confirmed fields count.');
              setModal(null);
            }}
          />
        </Modal>
      )}

      {modal?.type === 'track' && (
        <TrackingModal
          event={modal.event}
          tracking={trackingFor(modal.event.id)}
          projects={state.projects}
          defaultProjectId={project?.id}
          onClose={() => setModal(null)}
          onSave={(data) => saveTracking(modal.event, data)}
          onRemove={() => removeTracking(modal.event)}
          onViewProject={(pid) => { setModal(null); navigate(`/projects/${pid}`); }}
        />
      )}

      {modal?.type === 'details' && (
        <Modal open onClose={() => setModal(null)} title={modal.event.name} eyebrow="Demo listing — limitations">
          <p className="small">
            This event is a simulated fixture created to demonstrate the radar workflow. The organiser is fictional, the dates are
            illustrative, and no registration channel exists. They are not real deadlines.
          </p>
          <p className="small muted">
            <b>What was confirmed:</b> {(modal.event.fieldsConfirmed || []).join(', ') || 'nothing'}.
            Even the marked fields are demo values, not live verification.
          </p>
          <p className="small muted">To work with a real opportunity, add it manually with its official URL and check date, then confirm each field you verified.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>Close</Btn>
            <Btn variant="primary" onClick={() => { setModal({ type: 'track', event: modal.event }); }}>Track anyway (demo)</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
