'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/state';
import { BOOKS } from '@/lib/books';
import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';

const MODULES = BOOKS.bangey.modules;

export default function ProjectsPage() {
  const router = useRouter();
  const { tgUser, authToken, projectsData, currentProject, createNewProject, selectProject, deleteProject, renameProject, ready } = useApp();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!tgUser || !authToken) router.push('/');
  }, [ready, tgUser, authToken]);

  const handleNewWorkbook = () => {
    createNewProject();
    router.push('/onboarding');
  };

  const handleSelectProject = (id: string) => {
    selectProject(id);
    router.push('/modules');
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirmId) return;
    deleteProject(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleRenameSubmit = (id: string) => {
    const name = renameValue.trim();
    if (name) renameProject(id, name);
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <div className="app-wrap">
      <Header />
      <ProgressBar step={0} />
      <div className="step active">
        <div className="page-title">Ваши воркбуки</div>
        <div className="page-sub">Книгу можно проходить несколько раз — под разные контексты. Один воркбук для своей компании, другой для личного развития, третий для конкретного проекта. Упражнения и прогресс у каждого свои.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1.5rem' }}>
          {[...projectsData.projects].reverse().map((proj) => {
            const doneCount = proj.completedModules?.length || 0;
            const date = new Date(proj.id.replace('proj_', '') ? Date.now() : Date.now())
              .toLocaleDateString('ru', { day: 'numeric', month: 'short' });

            return (
              <div
                key={proj.id}
                className={`project-card ${proj.id === projectsData.currentProjectId ? 'project-current' : ''}`}
                onClick={() => handleSelectProject(proj.id)}
                style={{ position: 'relative' }}
              >
                <div className="proj-name-row">
                  {renamingId === proj.id ? (
                    <input
                      className="proj-rename-input"
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(proj.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(proj.id); if (e.key === 'Escape') setRenamingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span
                        className="proj-name"
                        onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(proj.id); setRenameValue(proj.name || ''); }}
                      >{proj.name || 'Воркбук'}</span>
                      <span
                        className="proj-edit-btn"
                        onClick={(e) => { e.stopPropagation(); setRenamingId(proj.id); setRenameValue(proj.name || ''); }}
                        title="Переименовать"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M9.5 1.5L11.5 3.5L4.5 10.5H2.5V8.5L9.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                          <path d="M8 3L10 5" stroke="currentColor" strokeWidth="1.2"/>
                        </svg>
                      </span>
                    </>
                  )}
                  <span className="proj-menu-wrap" onClick={(e) => e.stopPropagation()}>
                    <span
                      className="proj-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const dropdown = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                        dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
                      }}
                      title="Действия"
                    >···</span>
                    <div className="proj-dropdown" style={{ display: 'none', flexDirection: 'column' }}>
                      <div className="proj-dropdown-item" onClick={(e) => { e.stopPropagation(); setRenamingId(proj.id); setRenameValue(proj.name || ''); }}>Переименовать</div>
                      <div className="proj-dropdown-item danger" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(proj.id); }}>Удалить</div>
                    </div>
                  </span>
                </div>
                <div className="proj-meta">
                  {doneCount === MODULES.length
                    ? '✓ Завершён'
                    : doneCount > 0
                      ? `${doneCount} из ${MODULES.length} модулей`
                      : 'Не начат'}
                </div>
              </div>
            );
          })}

          {projectsData.projects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text3)', fontSize: 14 }}>
              Нет воркбуков — создайте первый
            </div>
          )}
        </div>

        <button className="btn primary" onClick={handleNewWorkbook}>+ Новый воркбук</button>
      </div>

      {deleteConfirmId && (
        <div className="delete-confirm-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="delete-confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-title">Удалить воркбук?</div>
            <div className="delete-confirm-sub">Все ответы и упражнения будут удалены. Это действие нельзя отменить.</div>
            <div className="delete-confirm-btns">
              <button className="btn" onClick={() => setDeleteConfirmId(null)}>Отмена</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }} onClick={handleDeleteConfirm}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
