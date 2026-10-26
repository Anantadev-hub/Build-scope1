import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, useCallback } from 'react';
import { createProject } from '../lib/models';
import { uid, makeCaseId, nowIso } from '../lib/id';
import { DEMO_PROJECT, DEMO_TRACKING, DEMO_LEARNING_PROGRESS, DEMO_ACTIVITY } from '../data/demo';
import { pendingAchievements, pendingXpAwards } from '../lib/scoring';
import { LEGACY_WORKSPACE_KEY } from '../services/auth';

// Default only. The live key is supplied by the signed-in demo account so two
// accounts in the same browser never share a workspace.
const DEFAULT_STORAGE_KEY = LEGACY_WORKSPACE_KEY;

const blankState = {
  version: 1,
  projects: [],
  activeProjectId: null,
  xpEvents: [],
  achievements: [],
  activity: [],
  learningProgress: [],
  hackathonTracking: [],
  hackathons: [],
  preferences: { welcomed: false, caseSeq: 1, showHints: true, demoSeeded: null },
};

function withDemo() {
  return {
    ...blankState,
    projects: [DEMO_PROJECT],
    activeProjectId: DEMO_PROJECT.id,
    activity: [...DEMO_ACTIVITY],
    learningProgress: [...DEMO_LEARNING_PROGRESS],
    hackathonTracking: [...DEMO_TRACKING],
    preferences: { welcomed: false, caseSeq: 2, showHints: true, demoSeeded: 'auto' },
  };
}

function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const base = createProject();
  const merged = { ...base, ...raw };
  ['targetUsers', 'features', 'skills', 'stack', 'repositories', 'solutions', 'evidence', 'claims',
    'feasibility', 'risks', 'requirements', 'acceptance', 'skillGaps', 'scope', 'reports', 'passports',
    'proofNodes', 'proofLinks', 'tests']
    .forEach((k) => { if (!Array.isArray(merged[k])) merged[k] = []; });
  merged.briefMeta = merged.briefMeta || { sourceUrl: '', checkedAt: '', checkedBy: '' };
  merged.comparison = merged.comparison || { selectedIds: [], notes: {}, confirmedAt: null };
  return merged;
}

function hydrate(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.projects)) return null;
  const projects = raw.projects.map(normalizeProject).filter(Boolean);
  return {
    ...blankState,
    ...raw,
    projects,
    activeProjectId: projects.some((p) => p.id === raw.activeProjectId)
      ? raw.activeProjectId
      : (projects[0]?.id || null),
    xpEvents: Array.isArray(raw.xpEvents) ? raw.xpEvents : [],
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    activity: Array.isArray(raw.activity) ? raw.activity.slice(0, 120) : [],
    learningProgress: Array.isArray(raw.learningProgress) ? raw.learningProgress : [],
    hackathonTracking: Array.isArray(raw.hackathonTracking) ? raw.hackathonTracking : [],
    hackathons: Array.isArray(raw.hackathons) ? raw.hackathons : [],
    preferences: { ...blankState.preferences, ...(raw.preferences || {}) },
  };
}

// `seedDemo` is explicit: only a demo account (or a demo-mode build) starts
// with the worked case. A normal account begins empty rather than inheriting
// fixtures it never asked for.
function freshState(seedDemo) {
  return seedDemo ? withDemo() : { ...blankState, preferences: { ...blankState.preferences } };
}

function load(storageKey, seedDemo) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { state: freshState(seedDemo), error: null };
    const parsed = JSON.parse(raw);
    const state = hydrate(parsed);
    if (!state) {
      return {
        state: freshState(seedDemo),
        error: seedDemo
          ? 'Stored workspace could not be read. A fresh demo workspace was loaded.'
          : 'Stored workspace could not be read. An empty workspace was loaded; nothing was deleted.',
      };
    }
    return { state, error: null };
  } catch {
    return {
      state: freshState(seedDemo),
      error: seedDemo
        ? 'Stored workspace was malformed and could not be read. Demo data was restored; nothing else was changed.'
        : 'Stored workspace was malformed and could not be read. An empty workspace was loaded; storage was left untouched.',
    };
  }
}

function touch(p) {
  return { ...p, updatedAt: nowIso() };
}

function reducer(state, action) {
  switch (action.type) {
    case 'project/create': {
      return {
        ...state,
        projects: [action.project, ...state.projects],
        activeProjectId: action.project.id,
        preferences: { ...state.preferences, caseSeq: state.preferences.caseSeq + 1 },
        activity: [{ id: uid('act'), projectId: action.project.id, kind: 'project', message: `Case ${action.project.caseId} opened for ${action.project.name}.`, at: nowIso() }, ...state.activity].slice(0, 120),
      };
    }
    case 'project/update': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? touch({ ...p, ...action.patch }) : p)),
      };
    }
    case 'project/delete': {
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        activeProjectId: state.activeProjectId === action.id
          ? (state.projects.find((p) => p.id !== action.id)?.id || null)
          : state.activeProjectId,
        learningProgress: state.learningProgress.filter((l) => l.projectId !== action.id),
        hackathonTracking: state.hackathonTracking.filter((t) => t.projectId !== action.id),
        activity: state.activity.filter((a) => a.projectId !== action.id),
        xpEvents: state.xpEvents.filter((e) => e.projectId !== action.id),
      };
    }
    // Removing a graph node must never leave a link pointing at nothing.
    case 'project/nodeRemove': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.projectId
          ? touch({
            ...p,
            proofNodes: p.proofNodes.filter((n) => n.id !== action.id),
            proofLinks: p.proofLinks.filter((l) => l.from !== action.id && l.to !== action.id),
          })
          : p)),
      };
    }
    case 'project/active':
      return { ...state, activeProjectId: action.id };
    case 'project/itemAdd': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.projectId
          ? touch({ ...p, [action.collection]: [action.item, ...p[action.collection]] })
          : p)),
      };
    }
    case 'project/itemUpdate': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.projectId
          ? touch({
            ...p,
            [action.collection]: p[action.collection].map((it) => (it.id === action.id
              ? { ...it, ...action.patch, updatedAt: nowIso() }
              : it)),
          })
          : p)),
      };
    }
    case 'project/itemRemove': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.projectId
          ? touch({ ...p, [action.collection]: p[action.collection].filter((it) => it.id !== action.id) })
          : p)),
      };
    }
    case 'project/itemReplace': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.projectId
          ? touch({ ...p, [action.collection]: action.items })
          : p)),
      };
    }
    case 'project/collectionAdd': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.projectId
          ? touch({ ...p, [action.collection]: [...action.items, ...p[action.collection]] })
          : p)),
      };
    }
    case 'activity/add': {
      return { ...state, activity: [action.event, ...state.activity].slice(0, 120) };
    }
    case 'xp/add': {
      // Deduplicate by project + stable key so effects can never double-award.
      const have = new Set(state.xpEvents.map((e) => `${e.projectId}:${e.key}`));
      const fresh = action.events.filter((e) => {
        const k = `${e.projectId}:${e.key}`;
        if (have.has(k)) return false;
        have.add(k);
        return true;
      });
      return fresh.length ? { ...state, xpEvents: [...state.xpEvents, ...fresh] } : state;
    }
    case 'achievement/add': {
      const have = new Set(state.achievements.map((a) => a.key));
      const fresh = action.items.filter((a) => {
        if (have.has(a.key)) return false;
        have.add(a.key);
        return true;
      });
      return fresh.length ? { ...state, achievements: [...state.achievements, ...fresh] } : state;
    }
    case 'learning/upsert': {
      const exists = state.learningProgress.some((l) => l.id === action.record.id);
      return {
        ...state,
        learningProgress: exists
          ? state.learningProgress.map((l) => (l.id === action.record.id ? action.record : l))
          : [action.record, ...state.learningProgress],
      };
    }
    case 'learning/remove':
      return { ...state, learningProgress: state.learningProgress.filter((l) => l.id !== action.id) };
    case 'hackathon/add':
      return { ...state, hackathons: [action.record, ...state.hackathons] };
    case 'hackathon/remove':
      return { ...state, hackathons: state.hackathons.filter((h) => h.id !== action.id) };
    case 'tracking/upsert': {
      const exists = state.hackathonTracking.some((t) => t.id === action.record.id);
      return {
        ...state,
        hackathonTracking: exists
          ? state.hackathonTracking.map((t) => (t.id === action.record.id ? action.record : t))
          : [action.record, ...state.hackathonTracking],
      };
    }
    case 'tracking/remove':
      return { ...state, hackathonTracking: state.hackathonTracking.filter((t) => t.id !== action.id) };
    case 'prefs/patch':
      return { ...state, preferences: { ...state.preferences, ...action.patch } };
    case 'workspace/replace':
      return action.state;
    case 'workspace/mergeDemo': {
      const projects = state.projects.some((p) => p.id === DEMO_PROJECT.id)
        ? state.projects
        : [DEMO_PROJECT, ...state.projects];
      return {
        ...state,
        projects,
        activeProjectId: DEMO_PROJECT.id,
        learningProgress: state.learningProgress.some((l) => l.projectId === DEMO_PROJECT.id)
          ? state.learningProgress
          : [...DEMO_LEARNING_PROGRESS, ...state.learningProgress],
        hackathonTracking: state.hackathonTracking.some((t) => t.projectId === DEMO_PROJECT.id)
          ? state.hackathonTracking
          : [...DEMO_TRACKING, ...state.hackathonTracking],
      };
    }
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children, storageKey = DEFAULT_STORAGE_KEY, seedDemo = true }) {
  const loaded = useMemo(() => load(storageKey, seedDemo), [storageKey, seedDemo]);
  const [state, dispatch] = useReducer(reducer, loaded.state);
  const [toasts, setToasts] = useState([]);
  const [savedAt, setSavedAt] = useState(null);
  const syncReady = useRef(false);
  const seenAchievements = useRef(new Set(state.achievements.map((a) => a.key)));

  // Persist. Never let a quota/storage error crash the workspace.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setSavedAt(Date.now());
    } catch {
      setSavedAt(null);
    }
  }, [state, storageKey]);

  // Derived awards: append once per stable key. This is the anti-farming gate.
  useEffect(() => {
    if (!syncReady.current) {
      // First pass still records awards, but stays silent.
      const xp = pendingXpAwards(state);
      const ach = pendingAchievements(state);
      if (xp.length) dispatch({ type: 'xp/add', events: xp.map((a) => ({ ...a, id: uid('xp'), at: nowIso() })) });
      if (ach.length) dispatch({ type: 'achievement/add', items: ach.map((a) => ({ ...a, id: uid('ach'), at: nowIso() })) });
      syncReady.current = true;
      return;
    }
    const xp = pendingXpAwards(state);
    const ach = pendingAchievements(state);
    if (xp.length) {
      dispatch({ type: 'xp/add', events: xp.map((a) => ({ ...a, id: uid('xp'), at: nowIso() })) });
      const total = xp.reduce((n, a) => n + a.amount, 0);
      pushToast(`+${total} XP · ${xp[0].reason}`, { tone: 'xp' });
    }
    const fresh = ach.filter((a) => !seenAchievements.current.has(a.key));
    if (ach.length) dispatch({ type: 'achievement/add', items: ach.map((a) => ({ ...a, id: uid('ach'), at: nowIso() })) });
    fresh.forEach((a) => {
      seenAchievements.current.add(a.key);
      pushToast(`Achievement unlocked: ${a.key.replace(/-/g, ' ')}`, { tone: 'achievement' });
    });
  }, [state]);

  const pushToast = useCallback((message, opts = {}) => {
    const id = uid('toast');
    setToasts((t) => [...t, { id, message, tone: opts.tone || 'info' }].slice(-3));
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.tone === 'achievement' ? 5200 : 3600);
  }, []);

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const project = state.projects.find((p) => p.id === state.activeProjectId) || state.projects[0] || null;

  const actions = useMemo(() => ({
    setActive(id) {
      dispatch({ type: 'project/active', id });
    },
    createProject(draft) {
      const seq = Math.max(1, state.preferences.caseSeq || 1);
      const p = createProject({ ...draft, caseId: makeCaseId(seq) });
      dispatch({ type: 'project/create', project: p });
      return p;
    },
    updateProject(id, patch, message) {
      dispatch({ type: 'project/update', id, patch });
      if (message) dispatch({ type: 'activity/add', event: { id: uid('act'), projectId: id, kind: 'project', message, at: nowIso() } });
    },
    updateActive(patch, message) {
      if (!project) return;
      this.updateProject(project.id, patch, message);
    },
    deleteProject(id) {
      dispatch({ type: 'project/delete', id });
    },
    addItem(collection, item, message) {
      if (!project) return;
      dispatch({ type: 'project/itemAdd', projectId: project.id, collection, item });
      if (message) dispatch({ type: 'activity/add', event: { id: uid('act'), projectId: project.id, kind: collection, message, at: nowIso() } });
    },
    updateItem(collection, id, patch, message) {
      if (!project) return;
      dispatch({ type: 'project/itemUpdate', projectId: project.id, collection, id, patch });
      if (message) dispatch({ type: 'activity/add', event: { id: uid('act'), projectId: project.id, kind: collection, message, at: nowIso() } });
    },
    removeItem(collection, id, message) {
      if (!project) return;
      dispatch({ type: 'project/itemRemove', projectId: project.id, collection, id });
      if (message) dispatch({ type: 'activity/add', event: { id: uid('act'), projectId: project.id, kind: collection, message, at: nowIso() } });
    },
    replaceCollection(collection, items) {
      if (!project) return;
      dispatch({ type: 'project/itemReplace', projectId: project.id, collection, items });
    },
    addItems(collection, items, message) {
      if (!project || !items.length) return;
      dispatch({ type: 'project/collectionAdd', projectId: project.id, collection, items });
      if (message) dispatch({ type: 'activity/add', event: { id: uid('act'), projectId: project.id, kind: collection, message, at: nowIso() } });
    },
    removeNode(id, message) {
      if (!project) return;
      dispatch({ type: 'project/nodeRemove', projectId: project.id, id });
      if (message) dispatch({ type: 'activity/add', event: { id: uid('act'), projectId: project.id, kind: 'proofNodes', message, at: nowIso() } });
    },
    log(message, kind = 'note') {
      if (!project) return;
      dispatch({ type: 'activity/add', event: { id: uid('act'), projectId: project.id, kind, message, at: nowIso() } });
    },
    upsertLearning(record) {
      dispatch({ type: 'learning/upsert', record: { ...record, updatedAt: nowIso() } });
    },
    upsertTracking(record) {
      dispatch({ type: 'tracking/upsert', record: { ...record, updatedAt: nowIso() } });
    },
    removeTracking(id) {
      dispatch({ type: 'tracking/remove', id });
    },
    removeLearning(id) {
      dispatch({ type: 'learning/remove', id });
    },
    addHackathon(record) {
      dispatch({ type: 'hackathon/add', record });
    },
    removeHackathon(id) {
      dispatch({ type: 'hackathon/remove', id });
    },
    prefs(patch) {
      dispatch({ type: 'prefs/patch', patch });
    },
    resetWorkspace(mode) {
      if (mode === 'demo') dispatch({ type: 'workspace/replace', state: withDemo() });
      else dispatch({ type: 'workspace/replace', state: { ...blankState, preferences: { ...blankState.preferences, caseSeq: 1 } } });
      pushToast(mode === 'demo' ? 'Demo workspace restored.' : 'Workspace cleared. All local projects removed.');
    },
    loadDemo() {
      this.prefs({ demoSeeded: 'explicit' });
      // The reducer ignores this if the demo case is already present.
      dispatch({ type: 'workspace/mergeDemo' });
    },
    // First-run screen, blank path: a workspace that only holds the auto-seeded
    // demo case is emptied so the demo never appears in the visitor's register.
    discardAutoDemo({ safe }) {
      if (!safe) {
        this.prefs({ welcomed: true });
        return;
      }
      dispatch({
        type: 'workspace/replace',
        state: { ...blankState, preferences: { ...blankState.preferences, caseSeq: 1, welcomed: true, demoSeeded: null } },
      });
    },
  }), [project, state.preferences.caseSeq, pushToast]);

  const value = useMemo(() => ({
    state, project, actions, toasts, dismissToast, pushToast, savedAt, loadError: loaded.error,
  }), [state, project, actions, toasts, dismissToast, pushToast, savedAt, loaded.error]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
