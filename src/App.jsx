import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import AppShell from './app/AppShell';
import { RequireAuth, RedirectIfSignedIn, useAuth } from './app/auth';
import { AppProvider } from './app/store';
import Welcome from './features/onboarding/Welcome';
import LoginScreen from './features/auth/LoginScreen';
import RegisterScreen from './features/auth/RegisterScreen';
import ForgotScreen from './features/auth/ForgotScreen';
import MissionControl from './features/missions/MissionControl';
import ProjectsList from './features/projects/ProjectsList';
import ProjectForm from './features/projects/ProjectForm';
import ProjectOverview from './features/projects/ProjectOverview';
import PriorArtLab from './features/discovery/PriorArtLab';
import Differentiation from './features/differentiation/Differentiation';
import FeasibilityLab from './features/feasibility/FeasibilityLab';
import Requirements from './features/requirements/Requirements';
import LearningHub from './features/learning/LearningHub';
import ProofGraph from './features/graph/ProofGraph';
import Assurance from './features/assurance/Assurance';
import HackathonRadar from './features/hackathons/HackathonRadar';
import Reports from './features/reports/Reports';
import Passport from './features/passport/Passport';
import Achievements from './features/gamification/Achievements';

// Every workspace view runs inside its own account's storage key, so switching
// demo accounts swaps the whole dataset instead of merging two people's cases.
function Workspace({ children }) {
  const { workspaceKey } = useAuth();
  return (
    <AppProvider key={workspaceKey || 'unscoped'} storageKey={workspaceKey || undefined}>
      {children}
    </AppProvider>
  );
}

function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <div className="eyebrow">Route not found</div>
      <h1 style={{ fontSize: 24, margin: '6px 0 8px' }}>That page is not in this dossier.</h1>
      <p className="small muted">The link may be old or the case may have been deleted from this browser.</p>
      <Link to="/" className="btn ghost">Return to Mission Control</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfSignedIn><LoginScreen /></RedirectIfSignedIn>} />
      <Route path="/register" element={<RedirectIfSignedIn><RegisterScreen /></RedirectIfSignedIn>} />
      <Route path="/forgot" element={<RedirectIfSignedIn><ForgotScreen /></RedirectIfSignedIn>} />

      <Route path="/welcome" element={<RequireAuth><Workspace><Welcome /></Workspace></RequireAuth>} />

      <Route element={<RequireAuth><Workspace><AppShell /></Workspace></RequireAuth>}>
        <Route index element={<MissionControl />} />
        <Route path="projects" element={<ProjectsList />} />
        <Route path="projects/new" element={<ProjectForm mode="create" />} />
        <Route path="projects/:id" element={<ProjectOverview />} />
        <Route path="projects/:id/edit" element={<ProjectForm mode="edit" />} />
        <Route path="projects/:id/prior-art" element={<PriorArtLab />} />
        <Route path="projects/:id/differentiation" element={<Differentiation />} />
        <Route path="projects/:id/feasibility" element={<FeasibilityLab />} />
        <Route path="projects/:id/requirements" element={<Requirements />} />
        <Route path="projects/:id/learning" element={<LearningHub />} />
        <Route path="projects/:id/proof" element={<ProofGraph />} />
        <Route path="projects/:id/assurance" element={<Assurance />} />
        <Route path="projects/:id/reports" element={<Reports />} />
        <Route path="projects/:id/passport" element={<Passport />} />
        <Route path="hackathons" element={<HackathonRadar />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
