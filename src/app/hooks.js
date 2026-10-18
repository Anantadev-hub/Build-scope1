import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from './store';

export function useRouteProject() {
  const { id } = useParams();
  const { state, actions } = useApp();
  const project = state.projects.find((p) => p.id === id) || null;

  useEffect(() => {
    if (project && state.activeProjectId !== project.id) actions.setActive(project.id);
  }, [project, state.activeProjectId, actions]);

  return project;
}

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — BuildScope AI` : 'BuildScope AI';
  }, [title]);
}
