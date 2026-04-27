'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useApp } from '@/lib/state';
import { BOOKS } from '@/lib/books';
import Header from '@/components/Header';
import Exercise from '@/components/Exercise';
import ProgressBar from '@/components/ProgressBar';

type ExData = { title: string; instruction: string };

export default function ModulePage() {
  const router = useRouter();
  const { id: moduleId } = useParams<{ id: string }>();
  const { tgUser, authToken, currentProject, updateCurrentProject, syncToServer, ready } = useApp();

  const [loadingEx1, setLoadingEx1] = useState(false);
  const [loadingEx2, setLoadingEx2] = useState(false);
  const [loadingEx3, setLoadingEx3] = useState(false);
  const [intro, setIntro] = useState('');
  const [ex1Data, setEx1Data] = useState<ExData | null>(null);
  const [ex2Data, setEx2Data] = useState<ExData | null>(null);
  const [ex3Data, setEx3Data] = useState<ExData | null>(null);

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

  // Prevent double-triggering adaptive generation
  const generatingEx2 = useRef(false);
  const generatingEx3 = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!tgUser || !authToken) { router.push('/'); return; }
    if (!module) { router.push('/modules'); return; }
    if (!currentProject) { router.push('/modules'); return; }
    loadOrGenerate();
  }, [ready, moduleId, currentProject?.id]);

  useEffect(() => {
    checkAllAnswered();
  }, [ex1Data, ex2Data, ex3Data, currentProject?.answers]);

  const checkAllAnswered = () => {
    if (!currentProject) return;
    const all = ['ex1', 'ex2', 'ex3'].every((exId) => {
      const val = currentProject.answers?.[`${moduleId}_${exId}`] || '';
      return val.trim().length >= 100;
    });
    setAllAnswered(all);
  };

  const getPreviousAnswers = () => {
    if (!currentProject) return {};
    const previousAnswers: Record<string, string> = {};
    const moduleOrder = ['gaps', 'intent', 'cascade', 'independence'];
    const idx = moduleOrder.indexOf(moduleId!);
    moduleOrder.slice(0, idx).forEach((modId) => {
      ['ex1', 'ex2', 'ex3'].forEach((exId) => {
        const val = currentProject.answers?.[`${modId}_${exId}`];
        if (val) previousAnswers[`${modId}_${exId}`] = val;
      });
    });
    return previousAnswers;
  };

  const getPreviousThreadStates = () => {
    if (!currentProject?.threadStateCache) return {};
    const moduleOrder = ['gaps', 'intent', 'cascade', 'independence'];
    const idx = moduleOrder.indexOf(moduleId!);
    const prev: Record<string, any> = {};
    moduleOrder.slice(0, idx).forEach((modId) => {
      const ts = currentProject.threadStateCache?.[modId];
      if (ts) prev[modId] = ts;
    });
    return prev;
  };

  const loadOrGenerate = async () => {
    if (!currentProject) return;
    const cached = currentProject.exerciseCache?.[moduleId!];

    if (cached?.ex1) {
      setIntro(cached.intro || '');
      setEx1Data(cached.ex1);
      if (cached.ex2) setEx2Data(cached.ex2);
      if (cached.ex3) setEx3Data(cached.ex3);

      const savedFeedback = currentProject.feedbackCache?.[moduleId!];
      if (savedFeedback) setFeedback(savedFeedback);
      setRating(currentProject.ratingCache?.[moduleId!] || 0);

      // Generate missing adaptive exercises if answers exist.
      // Two independent checks (not else-if) — ex3 must be reachable when ex2 is already cached.
      const ex1Ans = currentProject.answers?.[`${moduleId}_ex1`] || '';
      const ex2Ans = currentProject.answers?.[`${moduleId}_ex2`] || '';
      if (ex1Ans.trim().length >= 100 && !cached.ex2) {
        await generateEx2(ex1Ans);
      }
      if (ex1Ans.trim().length >= 100 && ex2Ans.trim().length >= 100 && !cached.ex3) {
        await generateEx3(ex1Ans, ex2Ans);
      }
      return;
    }

    await generateEx1();
  };

  const buildGenerateBody = (extra: object, correction?: string) => ({
    context: {
      role: currentProject?.role,
      size: currentProject?.size,
      biz: currentProject?.biz,
      pain: currentProject?.pain,
      painSymptom: currentProject?.painSymptom,
      painHistory: currentProject?.painHistory,
      painTried: currentProject?.painTried,
      painStakes: currentProject?.painStakes,
    },
    moduleId,
    bookId: 'bangey',
    previousAnswers: getPreviousAnswers(),
    previousThreadStates: getPreviousThreadStates(),
    correction: correction || currentProject?.correction || '',
    ...extra,
  });

  const generateEx1 = async (correction?: string) => {
    if (!currentProject) return;
    setLoadingEx1(true);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(buildGenerateBody({ targetEx: 'ex1' }, correction)),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setIntro(data.intro || '');
      setEx1Data(data.ex1);
      updateCurrentProject((p) => ({
        ...p,
        exerciseCache: { ...p.exerciseCache, [moduleId!]: { intro: data.intro, ex1: data.ex1 } },
      }));
      syncToServer();
    } catch (err) {
      console.error('Generate ex1 error:', err);
    }
    setLoadingEx1(false);
  };

  const generateEx2 = async (ex1Answer: string) => {
    if (!currentProject || generatingEx2.current) return;
    generatingEx2.current = true;
    setLoadingEx2(true);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(buildGenerateBody({ targetEx: 'ex2', currentModuleAnswers: { ex1: ex1Answer } })),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setEx2Data(data.ex2);
      updateCurrentProject((p) => ({
        ...p,
        exerciseCache: { ...p.exerciseCache, [moduleId!]: { ...p.exerciseCache?.[moduleId!], ex2: data.ex2 } },
      }));
      syncToServer();
    } catch (err) {
      console.error('Generate ex2 error:', err);
    }
    setLoadingEx2(false);
    generatingEx2.current = false;
  };

  const generateEx3 = async (ex1Answer: string, ex2Answer: string) => {
    if (!currentProject || generatingEx3.current) return;
    generatingEx3.current = true;
    setLoadingEx3(true);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(buildGenerateBody({ targetEx: 'ex3', currentModuleAnswers: { ex1: ex1Answer, ex2: ex2Answer } })),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setEx3Data(data.ex3);
      updateCurrentProject((p) => ({
        ...p,
        exerciseCache: { ...p.exerciseCache, [moduleId!]: { ...p.exerciseCache?.[moduleId!], ex3: data.ex3 } },
      }));
      syncToServer();
    } catch (err) {
      console.error('Generate ex3 error:', err);
    }
    setLoadingEx3(false);
    generatingEx3.current = false;
  };

  const handleNextModule = async () => {
    if (!currentProject || !moduleId) return;
    setFeedbackLoading(true);
    try {
      const answers = {
        ex1: currentProject.answers?.[`${moduleId}_ex1`] || '',
        ex2: currentProject.answers?.[`${moduleId}_ex2`] || '',
        ex3: currentProject.answers?.[`${moduleId}_ex3`] || '',
      };
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({
          context: {
            role: currentProject.role,
            size: currentProject.size,
            biz: currentProject.biz,
            pain: currentProject.pain,
            painSymptom: currentProject.painSymptom,
            painHistory: currentProject.painHistory,
            painTried: currentProject.painTried,
            painStakes: currentProject.painStakes,
          },
          moduleId,
          answers,
        }),
      });
      const data = await resp.json();
      if (data.feedback) {
        setFeedback(data.feedback);
        updateCurrentProject((p) => ({
          ...p,
          feedbackCache: { ...p.feedbackCache, [moduleId]: data.feedback },
          threadStateCache: data.threadState
            ? { ...(p.threadStateCache || {}), [moduleId]: data.threadState }
            : p.threadStateCache,
        }));
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
    const correction = regenCorrection;

    setEx1Data(null);
    setEx2Data(null);
    setEx3Data(null);
    setIntro('');
    setFeedback('');
    generatingEx2.current = false;
    generatingEx3.current = false;

    updateCurrentProject((p) => {
      const answers = { ...p.answers };
      ['ex1', 'ex2', 'ex3'].forEach((exId) => delete answers[`${moduleId}_${exId}`]);
      const exerciseCache = { ...p.exerciseCache };
      delete exerciseCache[moduleId!];
      const dialogCache = { ...p.dialogCache };
      delete dialogCache[moduleId!];
      return { ...p, answers, exerciseCache, dialogCache, correction };
    });

    setShowRegen(false);
    await generateEx1(correction);
    setRegenCorrection('');
  };

  const handleRatingChange = (n: number) => {
    setRating(n);
    updateCurrentProject((p) => ({ ...p, ratingCache: { ...p.ratingCache, [moduleId!]: n } }));
    syncToServer();
  };

  if (!ready || !currentProject) return null;
  if (!module) return null;

  const initialLoading = loadingEx1 && !ex1Data;

  const ExSkeleton = ({ index, label }: { index: number; label: string }) => (
    <div className="ex-block">
      <div className="ex-header">Упражнение {index} — <span className="spinner" style={{ display: 'inline-block', width: 12, height: 12, borderWidth: 2, verticalAlign: 'middle', marginRight: 6 }} />Генерирую {label}...</div>
      <div className="ex-body">
        <div className="skeleton sk-w90" />
        <div className="skeleton sk-w70" />
        <div className="skeleton sk-w55" />
        <div style={{ height: 10 }} />
        <div className="skeleton sk-w90" />
        <div className="skeleton sk-w70" />
      </div>
    </div>
  );

  return (
    <div className="app-wrap">
      <Header />
      <ProgressBar step={initialLoading ? 4 : 5} showBack />
      <div className="step active" style={{ paddingTop: 0 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div className="page-title" style={{ marginBottom: 0 }}>Модуль {moduleIndex + 1} — {module.title}</div>
          <button className="edit-ctx" onClick={() => router.push('/modules')}>← К плану</button>
        </div>

        {initialLoading && (
          <div className="loading-state">
            <div className="loading-title"><span className="spinner" /> Генерирую упражнения...</div>
            <div className="loading-sub">Адаптирую под ваш контекст через AI — это займёт несколько секунд.</div>
            <ExSkeleton index={1} label="диагностику" />
          </div>
        )}

        {!initialLoading && ex1Data && (
          <>
            {intro && (
              <div className="intro-box" style={{ marginBottom: '1rem' }}>{intro}</div>
            )}

            <div className="quote-block">
              <div className="quote-text">{module.quote}</div>
              <div className="quote-cite">— Стивен Бангей</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div className="ai-badge" style={{ marginBottom: 0 }}><span className="ctx-dot" /> Упражнения адаптируются к вашим ответам</div>
              <button
                className="info-btn"
                style={{ width: 'auto', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}
                onClick={() => setShowConcept(true)}
              >📖 Концепция</button>
            </div>

            <Exercise
              exId="ex1"
              exIndex={1}
              moduleId={moduleId!}
              title={ex1Data.title}
              instruction={ex1Data.instruction}
              onAnswerChange={checkAllAnswered}
              onFirstComplete={(answer) => {
                if (!ex2Data && !loadingEx2) generateEx2(answer);
              }}
            />

            {(loadingEx2 || ex2Data) && (
              <>
                {loadingEx2 && <ExSkeleton index={2} label="инструмент" />}
                {!loadingEx2 && ex2Data && (
                  <Exercise
                    exId="ex2"
                    exIndex={2}
                    moduleId={moduleId!}
                    title={ex2Data.title}
                    instruction={ex2Data.instruction}
                    onAnswerChange={checkAllAnswered}
                    onFirstComplete={(answer) => {
                      const ex1Ans = currentProject?.answers?.[`${moduleId}_ex1`] || '';
                      if (!ex3Data && !loadingEx3) generateEx3(ex1Ans, answer);
                    }}
                  />
                )}
              </>
            )}

            {(loadingEx3 || ex3Data) && (
              <>
                {loadingEx3 && <ExSkeleton index={3} label="следующий шаг" />}
                {!loadingEx3 && ex3Data && (
                  <Exercise
                    exId="ex3"
                    exIndex={3}
                    moduleId={moduleId!}
                    title={ex3Data.title}
                    instruction={ex3Data.instruction}
                    onAnswerChange={checkAllAnswered}
                  />
                )}
              </>
            )}

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

            {/* Bottom nav */}
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
