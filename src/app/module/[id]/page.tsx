'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useApp } from '@/lib/state';
import { BOOKS } from '@/lib/books';
import Header from '@/components/Header';
import Exercise from '@/components/Exercise';
import ProgressBar from '@/components/ProgressBar';

export default function ModulePage() {
  const router = useRouter();
  const { id: moduleId } = useParams<{ id: string }>();
  const { tgUser, authToken, currentProject, updateCurrentProject, syncToServer, ready } = useApp();

  const [loading, setLoading] = useState(false);
  const [exercises, setExercises] = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(0);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenCorrection, setRegenCorrection] = useState('');
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [allAnswered, setAllAnswered] = useState(false);
  const [showConcept, setShowConcept] = useState(false);

  const module = BOOKS.bangey.modules.find((m) => m.id === moduleId);
  const moduleIndex = BOOKS.bangey.modules.findIndex((m) => m.id === moduleId);

  useEffect(() => {
    if (!ready) return;
    if (!tgUser || !authToken) { router.push('/'); return; }
    if (!module) { router.push('/modules'); return; }
    if (!currentProject) { router.push('/modules'); return; }
    loadOrGenerate();
  }, [ready, moduleId, currentProject?.id]);

  useEffect(() => {
    checkAllAnswered();
  }, [exercises, currentProject?.answers]);

  const checkAllAnswered = () => {
    if (!currentProject) return;
    const all = ['ex1', 'ex2', 'ex3'].every((exId) => {
      const val = currentProject.answers?.[`${moduleId}_${exId}`] || '';
      return val.trim().length >= 100;
    });
    setAllAnswered(all);
  };

  const loadOrGenerate = async () => {
    if (!currentProject) return;
    const cached = currentProject.exerciseCache?.[moduleId!];
    if (cached) {
      setExercises(cached);
      const savedFeedback = currentProject.feedbackCache?.[moduleId!];
      if (savedFeedback) setFeedback(savedFeedback);
      const savedRating = currentProject.ratingCache?.[moduleId!] || 0;
      setRating(savedRating);
      return;
    }
    await generateExercises();
  };

  const generateExercises = async (correction?: string) => {
    if (!currentProject) return;
    setLoading(true);
    setExercises(null);
    setFeedback('');
    try {
      const previousAnswers: Record<string, string> = {};
      const moduleOrder = ['gaps', 'intent', 'cascade', 'independence'];
      const idx = moduleOrder.indexOf(moduleId!);
      moduleOrder.slice(0, idx).forEach((modId) => {
        ['ex1', 'ex2', 'ex3'].forEach((exId) => {
          const val = currentProject.answers?.[`${modId}_${exId}`];
          if (val) previousAnswers[`${modId}_${exId}`] = val;
        });
      });

      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({
          context: { role: currentProject.role, size: currentProject.size, biz: currentProject.biz, pain: currentProject.pain },
          moduleId,
          bookId: 'bangey',
          previousAnswers,
          correction: correction || currentProject.correction || '',
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setExercises(data);
      updateCurrentProject((p) => ({ ...p, exerciseCache: { ...p.exerciseCache, [moduleId!]: data } }));
      syncToServer();
    } catch (err) {
      console.error('Generate error:', err);
    }
    setLoading(false);
  };

  const handleNextModule = async () => {
    if (!currentProject || !moduleId) return;
    setFeedbackLoading(true);

    // Get feedback from AI
    try {
      const answers = {
        ex1: currentProject.answers?.[`${moduleId}_ex1`] || '',
        ex2: currentProject.answers?.[`${moduleId}_ex2`] || '',
        ex3: currentProject.answers?.[`${moduleId}_ex3`] || '',
      };
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ context: { role: currentProject.role, biz: currentProject.biz, pain: currentProject.pain }, moduleId, answers }),
      });
      const data = await resp.json();
      if (data.feedback) {
        setFeedback(data.feedback);
        updateCurrentProject((p) => ({ ...p, feedbackCache: { ...p.feedbackCache, [moduleId]: data.feedback } }));
        syncToServer();
      }
    } catch {}
    setFeedbackLoading(false);
  };

  const markDoneAndNav = () => {
    updateCurrentProject((p) => ({
      ...p,
      completedModules: p.completedModules.includes(moduleId!) ? p.completedModules : [...p.completedModules, moduleId!],
    }));
    syncToServer();
    router.push('/modules');
  };

  const handleRegen = () => {
    if (!regenCorrection.trim()) return;
    setRegenConfirm(true);
  };

  const confirmRegen = async () => {
    setRegenConfirm(false);
    updateCurrentProject((p) => {
      const answers = { ...p.answers };
      ['ex1', 'ex2', 'ex3'].forEach((exId) => delete answers[`${moduleId}_${exId}`]);
      const exerciseCache = { ...p.exerciseCache };
      delete exerciseCache[moduleId!];
      const dialogCache = { ...p.dialogCache };
      delete dialogCache[moduleId!];
      return { ...p, answers, exerciseCache, dialogCache, correction: regenCorrection };
    });
    setShowRegen(false);
    await generateExercises(regenCorrection);
    setRegenCorrection('');
  };

  const handleRatingChange = (n: number) => {
    setRating(n);
    updateCurrentProject((p) => ({ ...p, ratingCache: { ...p.ratingCache, [moduleId!]: n } }));
    syncToServer();
  };

  if (!ready || !currentProject) return null;
  if (!module) return null;

  return (
    <div className="app-wrap">
      <Header />
      <ProgressBar step={loading ? 4 : 5} showBack />
      <div className="step active" style={{ paddingTop: 0 }}>

        {/* Header: title + back button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div className="page-title" style={{ marginBottom: 0 }}>Модуль {moduleIndex + 1} — {module.title}</div>
          <button className="edit-ctx" onClick={() => router.push('/modules')}>← К плану</button>
        </div>



        {loading && (
          <div className="loading-state">
            <div className="loading-title"><span className="spinner" /> Генерирую упражнения...</div>
            <div className="loading-sub">Адаптирую под ваш контекст через AI — это займёт несколько секунд.</div>
            <div className="ex-block">
              <div className="ex-header">Загрузка модуля...</div>
              <div className="ex-body">
                <div className="skeleton sk-w90" />
                <div className="skeleton sk-w70" />
                <div className="skeleton sk-w55" />
                <div style={{ height: 10 }} />
                <div className="skeleton sk-w90" />
                <div className="skeleton sk-w70" />
              </div>
            </div>
          </div>
        )}

        {!loading && exercises && (
          <>
            {exercises.intro && (
              <div className="intro-box" style={{ marginBottom: '1rem' }}>{exercises.intro}</div>
            )}

            <div className="quote-block">
              <div className="quote-text">{module.quote}</div>
              <div className="quote-cite">— Стивен Бангей</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div className="ai-badge" style={{ marginBottom: 0 }}><span className="ctx-dot" /> Упражнения адаптированы под ваш контекст</div>
              <button
                className="info-btn"
                style={{ width: 'auto', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}
                onClick={() => setShowConcept(true)}
              >📖 Концепция</button>
            </div>

            <Exercise exId="ex1" exIndex={1} moduleId={moduleId!} title={exercises.ex1?.title || 'Диагностика'} instruction={exercises.ex1?.instruction || ''} onAnswerChange={checkAllAnswered} />
            <Exercise exId="ex2" exIndex={2} moduleId={moduleId!} title={exercises.ex2?.title || 'Инструмент'} instruction={exercises.ex2?.instruction || ''} onAnswerChange={checkAllAnswered} />
            <Exercise exId="ex3" exIndex={3} moduleId={moduleId!} title={exercises.ex3?.title || 'Следующий шаг'} instruction={exercises.ex3?.instruction || ''} onAnswerChange={checkAllAnswered} />

            {/* Regen section */}
            <div id="regen-wrap" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
              {!showRegen ? (
                <button className="edit-ctx" onClick={() => setShowRegen(true)}>↺ Упражнения не попали в точку — пересоздать</button>
              ) : (
                <div className="regen-form" style={{ marginTop: 12 }}>
                  <div className="section-label">Что понято неверно?</div>
                  <textarea
                    rows={3}
                    placeholder="Например: я не продаю через соцсети, работаю только B2B через тендеры..."
                    value={regenCorrection}
                    onChange={(e) => setRegenCorrection(e.target.value)}
                  />
                  <button className="btn primary" style={{ marginTop: 10 }} onClick={handleRegen} disabled={!regenCorrection.trim()}>Пересоздать упражнения →</button>
                </div>
              )}
            </div>

            {/* Feedback block */}
            {feedback && (
              <div className="feedback-block" style={{ marginTop: '2rem' }}>
                <div className="feedback-label">Обратная связь</div>
                <div className="feedback-text">{feedback}</div>
                <div style={{ marginTop: '1rem' }}>
                  <div className="section-label">Оцените модуль</div>
                  <div className="star-rating">
                    {[1,2,3,4,5].map((i) => (
                      <span key={i} className={`star ${i <= rating ? 'active' : ''}`} onClick={() => handleRatingChange(i)}>★</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Always-visible bottom nav */}
            <div className="nav" style={{ marginTop: '2rem' }}>
              <button className="btn" onClick={() => router.push('/modules')}>← К плану</button>
              {!feedback ? (
                <button className="btn primary" onClick={handleNextModule} disabled={!allAnswered || feedbackLoading}>
                  {feedbackLoading ? 'Анализирую ответы...' : 'Получить обратную связь →'}
                </button>
              ) : (
                <button className="btn primary" onClick={markDoneAndNav}>Следующий модуль →</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Regen confirm modal */}
      {regenConfirm && (
        <div className="delete-confirm-overlay" onClick={() => setRegenConfirm(false)}>
          <div className="delete-confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-title">Пересоздать упражнения?</div>
            <div className="delete-confirm-sub">Все ответы, которые ты написал в этом модуле, не сохранятся.</div>
            <div className="delete-confirm-btns">
              <button className="btn" onClick={() => setRegenConfirm(false)}>Отмена</button>
              <button className="btn primary" onClick={confirmRegen}>Продолжить</button>
            </div>
          </div>
        </div>
      )}

      {showConcept && module && (
        <div className="modal-overlay open" onClick={() => setShowConcept(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowConcept(false)}>✕</button>
            <div className="modal-tag">Модуль {moduleIndex + 1}</div>
            <div className="modal-title">{module.title}</div>
            <div className="modal-body" style={{ whiteSpace: 'pre-line' }}>{module.conceptDisplay}</div>
          </div>
        </div>
      )}
    </div>
  );
}
