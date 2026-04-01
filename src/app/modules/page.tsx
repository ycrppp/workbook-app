'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/state';
import { BOOKS } from '@/lib/books';
import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';

const MODULES = BOOKS.bangey.modules;

export default function ModulesPage() {
  const router = useRouter();
  const { tgUser, authToken, currentProject, ready } = useApp();
  const [conceptModal, setConceptModal] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!tgUser || !authToken) { router.push('/'); return; }
    if (!currentProject) { router.push('/projects'); return; }
  }, [ready, tgUser, authToken, currentProject]);

  if (!currentProject) return null;

  const completedCount = currentProject.completedModules?.length || 0;
  const allDone = completedCount === MODULES.length;

  // Find next available module
  const nextModuleIdx = MODULES.findIndex((m, i) => {
    const done = currentProject.completedModules?.includes(m.id);
    const prev = i === 0 || currentProject.completedModules?.includes(MODULES[i - 1]?.id);
    return !done && prev;
  });
  const nextModule = nextModuleIdx >= 0 ? MODULES[nextModuleIdx] : null;

  return (
    <div className="app-wrap">
      <Header />
      <ProgressBar step={3} />
      <div className="step active" style={{ paddingTop: 0 }}>

        {/* Project label */}
        {currentProject.name && (
          <div className="project-label" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 6 }}>
            {currentProject.name}
          </div>
        )}

        <div className="page-title">Ваш план</div>
        <div className="page-sub">Воркбук по книге «Искусство действия» — 4 модуля, каждый про вашу конкретную ситуацию.</div>

        {/* Context edit button */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button className="edit-ctx" onClick={() => router.push('/onboarding')}>
            {currentProject.role ? 'изменить контекст' : 'Заполнить контекст →'}
          </button>
        </div>

        {/* Module list */}
        <div className="module-list">
            {MODULES.map((mod, i) => {
              const done = currentProject.completedModules?.includes(mod.id);
              const isCurrent = !done && (i === 0 || currentProject.completedModules?.includes(MODULES[i - 1]?.id));
              const locked = !done && !isCurrent;
              return (
                <div
                  key={mod.id}
                  className={`module-item ${done ? 'done' : isCurrent ? 'current' : 'locked'}`}
                  onClick={() => !locked && router.push(`/module/${mod.id}`)}
                >
                  <div>
                    <div className="module-name">
                      Модуль {i + 1} — {mod.title}
                      <button
                        className="info-btn"
                        onClick={(e) => { e.stopPropagation(); setConceptModal(mod.id); }}
                        title="О концепции"
                      >i</button>
                    </div>
                    <div className="module-sub">
                      {done ? mod.description : isCurrent ? mod.description : `Открывается после модуля ${i}`}
                    </div>
                  </div>
                  <div className={`module-badge ${done ? 'badge-done' : isCurrent ? 'badge-current' : 'badge-locked'}`}>
                    {done ? '✓ Готово' : isCurrent ? 'Начать' : 'Закрыт'}
                  </div>
                </div>
              );
            })}
            <div
              className={`module-item module-item-final ${allDone ? 'current' : 'locked'}`}
              onClick={() => allDone && router.push('/final')}
            >
              <div>
                <div className="module-name">Итог — Синтез и план действий</div>
                <div className="module-sub">{allDone ? 'Доступен' : 'Открывается после всех модулей'}</div>
              </div>
              <div className={`module-badge ${allDone ? 'badge-final' : 'badge-locked'}`}>
                {allDone ? 'Открыть →' : 'Закрыт'}
              </div>
            </div>
          </div>

        {/* Bottom nav */}
        <div className="nav" style={{ marginTop: '1.5rem' }}>
          <button className="edit-ctx" onClick={() => router.push('/projects')}>← Назад</button>
          {allDone ? (
            <button className="btn primary" onClick={() => router.push('/final')}>Перейти к итогу →</button>
          ) : nextModule ? (
            <button className="btn primary" onClick={() => router.push(`/module/${nextModule.id}`)}>
              Начать модуль {nextModuleIdx + 1} →
            </button>
          ) : null}
        </div>
      </div>

      {/* Concept modal */}
      {conceptModal && (() => {
        const mod = MODULES.find((m) => m.id === conceptModal);
        if (!mod) return null;
        return (
          <div className="modal-overlay open" onClick={() => setConceptModal(null)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setConceptModal(null)}>✕</button>
              <div className="modal-tag">Модуль {MODULES.indexOf(mod) + 1}</div>
              <div className="modal-title">{mod.title}</div>
              <div className="modal-body" style={{ whiteSpace: 'pre-line' }}>{mod.conceptDisplay}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
