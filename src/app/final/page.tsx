'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/state';
import { BOOKS } from '@/lib/books';
import Header from '@/components/Header';
import StarRating from '@/components/StarRating';
import ProgressBar from '@/components/ProgressBar';

export default function FinalPage() {
  const router = useRouter();
  const { tgUser, authToken, currentProject, updateCurrentProject, syncToServer, ready } = useApp();

  const [loading, setLoading] = useState(false);
  const [synthesis, setSynthesis] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBody, setTaskBody] = useState('');
  const [finalPlan, setFinalPlan] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!tgUser || !authToken) { router.push('/'); return; }
    if (!currentProject) { router.push('/modules'); return; }

    setFinalPlan(currentProject.finalPlan || '');

    if (currentProject.finalCache) {
      setSynthesis(currentProject.finalCache.synthesis || '');
      setTaskTitle(currentProject.finalCache.task_title || '');
      setTaskBody(currentProject.finalCache.task_body || '');
    } else {
      generateFinal();
    }
  }, [ready, currentProject?.id]);

  const generateFinal = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const answers: Record<string, string> = {};
      ['gaps', 'intent', 'cascade', 'independence'].forEach((modId) => {
        ['ex1', 'ex2', 'ex3'].forEach((exId) => {
          const val = currentProject.answers?.[`${modId}_${exId}`];
          if (val) answers[`${modId}_${exId}`] = val;
        });
      });

      const resp = await fetch('/api/final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({
          context: { role: currentProject.role, size: currentProject.size, biz: currentProject.biz, pain: currentProject.pain },
          answers,
        }),
      });
      const data = await resp.json();
      if (data.synthesis) {
        setSynthesis(data.synthesis);
        setTaskTitle(data.task_title || '');
        setTaskBody(data.task_body || '');
        updateCurrentProject((p) => ({ ...p, finalCache: data }));
        syncToServer();
      }
    } catch (err) {
      console.error('Final error:', err);
    }
    setLoading(false);
  };

  const handlePlanBlur = (val: string) => {
    updateCurrentProject((p) => ({ ...p, finalPlan: val }));
    syncToServer();
  };

  const handleWbRating = (n: number) => {
    updateCurrentProject((p) => ({ ...p, workbookRating: n }));
    syncToServer();
  };

  const handleWbFeedback = (val: string) => {
    updateCurrentProject((p) => ({ ...p, workbookFeedback: val }));
    syncToServer();
  };

  const handleBookSuggestion = (val: string) => {
    updateCurrentProject((p) => ({ ...p, bookSuggestion: val }));
    syncToServer();
  };

  const handleFinish = () => {
    const planEl = document.getElementById('final-plan') as HTMLTextAreaElement;
    if (planEl) handlePlanBlur(planEl.value);
    router.push('/modules');
  };

  return (
    <div className="app-wrap">
      <Header />
      <ProgressBar step={6} showBack />
      <div className="step active" style={{ paddingTop: 0 }}>
        <div className="final-badge">✓ Все модули пройдены</div>
        <div className="page-title">Итог воркбука</div>
        <div className="page-sub">Ты прошёл все 4 модуля. Вот что ты выяснил о своём бизнесе — и один конкретный шаг.</div>

        {/* Summary of user answers */}
        <div className="final-answers-block">
          {['gaps', 'intent', 'cascade', 'independence'].map((modId) => {
            const mod = BOOKS.bangey.modules.find((m) => m.id === modId);
            const labels: Record<string, string> = { ex1: 'Диагностика', ex2: 'Инструмент', ex3: 'Следующий шаг' };
            const items = ['ex1', 'ex2', 'ex3'].filter((exId) => {
              const val = currentProject?.answers?.[`${modId}_${exId}`];
              return val && val.trim();
            });
            if (!items.length) return null;
            return (
              <div key={modId} className="final-module-group">
                <div className="final-module-title">{`Модуль — ${mod?.title}`}</div>
                {items.map((exId) => (
                  <div key={exId} className="final-answer-item">
                    <div className="final-ex-label">{labels[exId]}</div>
                    <div className="final-ex-text">{currentProject?.answers?.[`${modId}_${exId}`]}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="loading-state">
            <div className="loading-title"><span className="spinner" /> Готовлю итог...</div>
            <div className="loading-sub">Анализирую твои ответы — займёт несколько секунд.</div>
          </div>
        )}

        {!loading && synthesis && (
          <>
            <div className="synthesis-box">{synthesis}</div>

            <div className="final-task-card">
              <div className="final-task-label">{taskTitle}</div>
              <div className="final-task-body" style={{ whiteSpace: 'pre-line' }}>{taskBody}</div>
            </div>

            <div className="final-section-label">Твой план действий</div>
            <textarea
              id="final-plan"
              rows={5}
              className="ex-answer"
              placeholder="Запиши что именно сделаешь — своими словами..."
              defaultValue={finalPlan}
              onBlur={(e) => handlePlanBlur(e.target.value)}
            />

            <div className="wb-feedback-section">
              <div className="final-section-label">Оцените воркбук</div>
              <StarRating value={currentProject?.workbookRating || 0} onChange={handleWbRating} />

              <div className="final-section-label">Ваш отзыв</div>
              <textarea
                rows={3}
                placeholder="Что понравилось, что можно улучшить..."
                defaultValue={currentProject?.workbookFeedback || ''}
                onBlur={(e) => handleWbFeedback(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, padding: '10px 12px', fontFamily: 'inherit', resize: 'vertical', marginBottom: '1.25rem' }}
              />

              <div className="final-section-label">Предложить книгу для следующего воркбука</div>
              <input
                type="text"
                className="wb-book-input"
                placeholder="Название и автор"
                defaultValue={currentProject?.bookSuggestion || ''}
                onBlur={(e) => handleBookSuggestion(e.target.value)}
              />
            </div>

            <div className="nav" style={{ marginTop: '1.5rem' }}>
              <button className="btn" onClick={() => router.push('/modules')}>← К модулям</button>
              <button className="btn primary" onClick={handleFinish}>Завершить →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
