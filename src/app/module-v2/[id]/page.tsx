'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useApp } from '@/lib/state';
import { BOOKS } from '@/lib/books';
import Header from '@/components/Header';

type Screen = 'loading' | 'ex1' | 'ex2' | 'ex3' | 'done';
type ExData = { title: string; instruction: string };

const MIN_CHARS = { ex1: 150, ex2: 100, ex3: 80 };

export default function ModuleV2() {
  const router = useRouter();
  const { id: moduleId } = useParams<{ id: string }>();
  const { tgUser, authToken, currentProject, ready } = useApp();

  const [screen, setScreen] = useState<Screen>('loading');
  const [error, setError] = useState('');
  const [ex1, setEx1] = useState<ExData | null>(null);
  const [ex2, setEx2] = useState<ExData | null>(null);
  const [ex3, setEx3] = useState<ExData | null>(null);
  const [ans1, setAns1] = useState('');
  const [ans2, setAns2] = useState('');
  const [ans3, setAns3] = useState('');

  const module = BOOKS.bangey.modules.find((m) => m.id === moduleId);
  const moduleIndex = BOOKS.bangey.modules.findIndex((m) => m.id === moduleId);

  useEffect(() => {
    if (!ready) return;
    if (!module) { router.push('/modules'); return; }
    generate('ex1', '', '');
  }, [ready, moduleId]);

  const ctx = {
    role: currentProject?.role,
    size: currentProject?.size,
    biz: currentProject?.biz,
    pain: currentProject?.pain,
    painTried: currentProject?.painTried,
    painStakes: currentProject?.painStakes,
  };

  const generate = async (action: 'ex1' | 'ex2' | 'ex3', a1: string, a2: string) => {
    setError('');
    setScreen('loading');
    try {
      const resp = await fetch('/api/generate-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ action, moduleId, context: ctx, ex1Answer: a1, ex2Answer: a2 }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (action === 'ex1') { setEx1(data); setScreen('ex1'); }
      if (action === 'ex2') { setEx2(data); setScreen('ex2'); }
      if (action === 'ex3') { setEx3(data); setScreen('ex3'); }
    } catch (err: any) {
      setError(err.message || 'Ошибка генерации');
      setScreen(action); // stay on same screen
    }
  };

  if (!ready) return null;
  if (!module) return null;

  return (
    <div className="app-wrap">
      <Header />
      <div className="step active" style={{ paddingTop: 0 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Модуль {moduleIndex + 1} · {module.title} · v2
          </div>
          <button className="edit-ctx" onClick={() => router.push('/modules')}>← К плану</button>
        </div>

        {error && (
          <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 16 }}>
            Ошибка: {error}
            <button style={{ marginLeft: 12, fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--accent)', textDecoration: 'underline' }}
              onClick={() => generate('ex1', '', '')}>
              Попробовать снова
            </button>
          </div>
        )}

        {screen === 'loading' && (
          <div style={{ marginTop: 48, textAlign: 'center' }}>
            <span className="spinner" style={{ marginRight: 8 }} />
            <span style={{ fontSize: 14, color: 'var(--text3)' }}>Генерирую упражнение...</span>
          </div>
        )}

        {screen === 'ex1' && ex1 && (
          <ExerciseScreen
            index={1}
            title={ex1.title}
            instruction={ex1.instruction}
            value={ans1}
            onChange={setAns1}
            min={MIN_CHARS.ex1}
            onContinue={() => generate('ex2', ans1, '')}
            continueLabel="Продолжить →"
          />
        )}

        {screen === 'ex2' && ex2 && (
          <ExerciseScreen
            index={2}
            title={ex2.title}
            instruction={ex2.instruction}
            value={ans2}
            onChange={setAns2}
            min={MIN_CHARS.ex2}
            onContinue={() => generate('ex3', ans1, ans2)}
            continueLabel="Продолжить →"
          />
        )}

        {screen === 'ex3' && ex3 && (
          <ExerciseScreen
            index={3}
            title={ex3.title}
            instruction={ex3.instruction}
            value={ans3}
            onChange={setAns3}
            min={MIN_CHARS.ex3}
            onContinue={() => setScreen('done')}
            continueLabel="Завершить →"
          />
        )}

        {screen === 'done' && (
          <DoneScreen
            module={module}
            ex1={ex1} ex2={ex2} ex3={ex3}
            ans1={ans1} ans2={ans2} ans3={ans3}
            onBack={() => router.push('/modules')}
          />
        )}
      </div>
    </div>
  );
}

// ─── Exercise screen ──────────────────────────────────────────────────────────

function ExerciseScreen({
  index, title, instruction, value, onChange, min, onContinue, continueLabel,
}: {
  index: number; title: string; instruction: string;
  value: string; onChange: (v: string) => void;
  min: number; onContinue: () => void; continueLabel: string;
}) {
  const len = value.trim().length;
  const ready = len >= min;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 500) + 'px';
  };

  return (
    <div>
      <div className="ex-block">
        <div className="ex-header">Упражнение {index} — {title}</div>
        <div className="ex-body">
          <div className="ex-instruction" style={{ whiteSpace: 'pre-line' }}>{instruction}</div>
          <textarea
            ref={textareaRef}
            className="ex-answer"
            rows={7}
            placeholder="Напишите здесь..."
            value={value}
            onChange={handleChange}
            style={{ resize: 'none', overflow: 'hidden' }}
          />
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right', marginTop: 4 }}>
            {len === 0 ? `0 / мин. ${min}` : len >= min ? `${len} ✓` : `${len} / мин. ${min}`}
          </div>
        </div>
      </div>
      <button
        className="btn primary"
        disabled={!ready}
        onClick={onContinue}
        style={{ width: '100%', marginTop: 8, opacity: ready ? 1 : 0.4 }}
      >
        {continueLabel}
      </button>
    </div>
  );
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({ module, ex1, ex2, ex3, ans1, ans2, ans3, onBack }: {
  module: { title: string };
  ex1: ExData | null; ex2: ExData | null; ex3: ExData | null;
  ans1: string; ans2: string; ans3: string;
  onBack: () => void;
}) {
  return (
    <div>
      <div style={{ marginTop: 8, marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Модуль завершён
        </div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{module.title}</div>
      </div>

      {[
        { ex: ex1, ans: ans1, i: 1 },
        { ex: ex2, ans: ans2, i: 2 },
        { ex: ex3, ans: ans3, i: 3 },
      ].map(({ ex, ans, i }) => ex && (
        <div key={i} style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {i}. {ex.title}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{ans}</div>
        </div>
      ))}

      <button className="btn primary" style={{ width: '100%', marginTop: 16 }} onClick={onBack}>
        ← К плану
      </button>
    </div>
  );
}
