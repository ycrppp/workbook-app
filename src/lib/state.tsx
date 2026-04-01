'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export interface Project {
  id: string;
  name: string;
  role: string;
  size: string;
  biz: string;
  pain: string;
  correction: string;
  sessionId: string;
  completedModules: string[];
  answers: Record<string, string>;
  exerciseCache: Record<string, any>;
  feedbackCache: Record<string, any>;
  ratingCache: Record<string, any>;
  dialogCache: Record<string, any>;
  workbookRating: number;
  workbookFeedback: string;
  bookSuggestion: string;
  finalPlan: string;
  finalCache: any;
}

export interface ProjectsData {
  projects: Project[];
  currentProjectId: string | null;
}

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface AppState {
  // Auth
  tgUser: TgUser | null;
  authToken: string | null;
  // Projects
  projectsData: ProjectsData;
  // Current project state (derived from current project)
  currentProject: Project | null;
  // UI
  ready: boolean;
}

interface AppContextValue extends AppState {
  setTgUser: (user: TgUser | null) => void;
  setAuthToken: (token: string | null) => void;
  setProjectsData: (data: ProjectsData) => void;
  updateCurrentProject: (updater: (p: Project) => Project) => void;
  createNewProject: () => Project;
  selectProject: (id: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  logout: () => void;
  syncToServer: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_' + Math.random().toString(36).slice(2),
    name: 'Воркбук',
    role: '',
    size: '',
    biz: '',
    pain: '',
    correction: '',
    sessionId: 'session_' + Math.random().toString(36).slice(2),
    completedModules: [],
    answers: {},
    exerciseCache: {},
    feedbackCache: {},
    ratingCache: {},
    dialogCache: {},
    workbookRating: 0,
    workbookFeedback: '',
    bookSuggestion: '',
    finalPlan: '',
    finalCache: null,
    ...overrides,
  };
}

function loadFromStorage(): Partial<AppState> {
  if (typeof window === 'undefined') return {};
  try {
    const tgUser = JSON.parse(localStorage.getItem('tg_user') || 'null');
    const authToken = localStorage.getItem('auth_token');
    const projectsData = JSON.parse(localStorage.getItem('projects_data') || 'null') || { projects: [], currentProjectId: null };
    return { tgUser, authToken, projectsData };
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tgUser, setTgUserState] = useState<TgUser | null>(null);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [projectsData, setProjectsDataState] = useState<ProjectsData>({ projects: [], currentProjectId: null });
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.tgUser) setTgUserState(stored.tgUser);
    if (stored.authToken) setAuthTokenState(stored.authToken);
    if (stored.projectsData) setProjectsDataState(stored.projectsData);
    setReady(true);
  }, []);

  const currentProject = projectsData.projects.find((p) => p.id === projectsData.currentProjectId) || null;

  const saveToStorage = useCallback((data: ProjectsData) => {
    localStorage.setItem('projects_data', JSON.stringify(data));
  }, []);

  const setTgUser = useCallback((user: TgUser | null) => {
    setTgUserState(user);
    if (user) localStorage.setItem('tg_user', JSON.stringify(user));
    else localStorage.removeItem('tg_user');
  }, []);

  const setAuthToken = useCallback((token: string | null) => {
    setAuthTokenState(token);
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  }, []);

  const setProjectsData = useCallback((data: ProjectsData) => {
    setProjectsDataState(data);
    saveToStorage(data);
  }, [saveToStorage]);

  const updateCurrentProject = useCallback((updater: (p: Project) => Project) => {
    setProjectsDataState((prev) => {
      const idx = prev.projects.findIndex((p) => p.id === prev.currentProjectId);
      if (idx === -1) return prev;
      const updated = [...prev.projects];
      updated[idx] = updater(updated[idx]);
      const next = { ...prev, projects: updated };
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const syncToServer = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const token = localStorage.getItem('auth_token');
      const user = JSON.parse(localStorage.getItem('tg_user') || 'null');
      const data = JSON.parse(localStorage.getItem('projects_data') || 'null');
      if (!token || !data) return;
      try {
        await fetch('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            first_name: user?.first_name || '',
            last_name: user?.last_name || '',
            username: user?.username || '',
            photo_url: user?.photo_url || '',
            projects: data,
          }),
        });
      } catch {}
    }, 2000);
  }, []);

  const createNewProject = useCallback(() => {
    const proj = makeProject();
    setProjectsDataState((prev) => {
      const next = { projects: [...prev.projects, proj], currentProjectId: proj.id };
      saveToStorage(next);
      return next;
    });
    return proj;
  }, [saveToStorage]);

  const selectProject = useCallback((id: string) => {
    setProjectsDataState((prev) => {
      const next = { ...prev, currentProjectId: id };
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const deleteProject = useCallback((id: string) => {
    setProjectsDataState((prev) => {
      const projects = prev.projects.filter((p) => p.id !== id);
      const currentProjectId = prev.currentProjectId === id
        ? (projects[0]?.id || null)
        : prev.currentProjectId;
      const next = { projects, currentProjectId };
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const renameProject = useCallback((id: string, name: string) => {
    setProjectsDataState((prev) => {
      const projects = prev.projects.map((p) => p.id === id ? { ...p, name } : p);
      const next = { ...prev, projects };
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const logout = useCallback(() => {
    localStorage.clear();
    setTgUserState(null);
    setAuthTokenState(null);
    setProjectsDataState({ projects: [], currentProjectId: null });
  }, []);

  return (
    <AppContext.Provider value={{
      ready,
      tgUser,
      authToken,
      projectsData,
      currentProject,
      setTgUser,
      setAuthToken,
      setProjectsData,
      updateCurrentProject,
      createNewProject,
      selectProject,
      deleteProject,
      renameProject,
      logout,
      syncToServer,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
