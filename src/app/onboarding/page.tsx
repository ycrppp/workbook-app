'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/state';
import ProgressBar from '@/components/ProgressBar';
import Header from '@/components/Header';

const ROLES = ['Фаундер / CEO', 'Руководитель отдела', 'Менеджер проекта', 'Фрилансер', 'Другое'];

export default function OnboardingPage() {
  const router = useRouter();
  const { tgUser, authToken, currentProject, updateCurrentProject, renameProject, syncToServer, ready } = useApp();

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [size, setSize] = useState('');
  const [biz, setBiz] = useState('');
  const [pain, setPain] = useState('');
  const [painTried, setPainTried] = useState('');
  const [painStakes, setPainStakes] = useState('');
  const [painHistory, setPainHistory] = useState('');
  const [showPainDeep, setShowPainDeep] = useState(false);
  const [bizCount, setBizCount] = useState(0);
  const [painCount, setPainCount] = useState(0);
  const [checking, setChecking] = useState(false);
  const [summary, setSummary] = useState('');
  const [correction, setCorrection] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!tgUser || !authToken) { router.push('/'); return; }
    if (currentProject) {
      setName(currentProject.name || '');
      setRole(currentProject.role || '');
      setSize(currentProject.size || '');
      setBiz(currentProject.biz || '');
      setPain(currentProject.pain || '');
      setPainTried(currentProject.painTried || '');
      setPainStakes(currentProject.painStakes || '');
      setPainHistory(currentProject.painHistory || '');
      setBizCount(currentProject.biz?.length || 0);
      setPainCount(currentProject.pain?.length || 0);
      // Auto-expand deep pain section if any deep field is filled
      if (currentProject.painTried || currentProject.painStakes || currentProject.painHistory) {
        setShowPainDeep(true);
      }
    }
  }, [ready, tgUser, authToken, currentProject?.id]);

  const canProceed = role && size && biz.trim().length >= 30 && pain.trim().length >= 30;

  const handleCheck = async () => {
    setChecking(true);
    setError('');
    try {
      const resp = await fetch('/api/context-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { role, size, biz, pain, painTried, painStakes, painHistory } }),
      });
      const data = await resp.json();
      setSummary(data.summary || '');
    } catch {
      setError('Ошибка проверки — попробуйте снова');
    }
    setChecking(false);
  };

  const handleConfirm = () => {
    if (currentProject) {
      const trimmedName = name.trim();
      if (trimmedName && trimmedName !== currentProject.name) {
        renameProject(currentProject.id, trimmedName);
      }
    }
    updateCurrentProject((p) => ({
      ...p,
      role,
      size,
      biz,
      pain,
      painTried: painTried.trim(),
      painStakes: painStakes.trim(),
      painHistory: painHistory.trim(),
      correction,
    }));
    syncToServer();
    setConfirmed(true);
    setTimeout(() => router.push('/modules'), 300);
  };

  // Summary screen (S2) — replaces the form
  if (summary && !confirmed) {
    return (
      <div className="app-wrap">
        <Header />
        <ProgressBar step={2} showBack />
        <div className="step active">
          <div className="page-title">Проверьте контекст</div>
          <div className="page-sub">Вот как я понял вашу ситуацию. Если что-то неверно — уточните перед началом, чтобы упражнения точно попали в цель.</div>
          <div className="intro-box" style={{ marginBottom: '1.25rem' }}>{summary}</div>
          <div className="section-label">Хотите добавить уточнение?</div>
          <textarea
            className="ctx-textarea"
            rows={3}
            placeholder="Например: работаю удалённо, команда в трёх городах, основные клиенты — B2B..."
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
          />
          <div className="nav">
            <button className="btn" onClick={() => setSummary('')}>← Изменить анкету</button>
            <button className="btn primary" onClick={handleConfirm}>Сохранить и начать →</button>
          </div>
        </div>
      </div>
    );
  }

  // Main form (S1)
  return (
    <div className="app-wrap">
      <Header />
      <ProgressBar step={1} showBack />
      <div className="step active">
        <div className="page-title">Настройка воркбука</div>
        <div className="page-sub">Расскажите о себе — все упражнения будут написаны под вашу конкретную ситуацию, а не про абстрактного менеджера.</div>

        <div className="section-label">Название воркбука</div>
        <input
          type="text"
          placeholder="Например: Мой стартап, Команда продаж..."
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 15, outline: 'none', marginBottom: '1.25rem', fontFamily: 'inherit' }}
        />

        <div className="section-label">Кто вы</div>
        <div className="chip-row">
          {ROLES.map((r) => (
            <button key={r} className={`chip ${role === r ? 'selected' : ''}`} onClick={() => setRole(r)}>{r}</button>
          ))}
        </div>

        <div className="section-label">Сколько человек в команде</div>
        <input
          type="text"
          placeholder="Например: 1, 7, 30..."
          maxLength={20}
          value={size}
          onChange={(e) => setSize(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 15, outline: 'none', marginBottom: '1.25rem', fontFamily: 'inherit' }}
        />

        <div className="section-label">Чем занимаетесь</div>
        <textarea
          className="ctx-textarea"
          rows={2}
          placeholder="Например: digital-агентство, influence marketing, клиенты — онлайн-образование..."
          value={biz}
          onChange={(e) => { setBiz(e.target.value); setBizCount(e.target.value.length); }}
        />
        <div className="char-counter">{bizCount > 0 ? (bizCount < 30 ? `${bizCount} / мин. 30` : `${bizCount} ✓`) : `0 / мин. 30`}</div>

        <div className="section-label">Главная боль прямо сейчас</div>
        <textarea
          className="ctx-textarea"
          rows={3}
          placeholder="Например: всё замыкается на мне, команда не принимает решений самостоятельно, планы расходятся с результатами..."
          value={pain}
          onChange={(e) => { setPain(e.target.value); setPainCount(e.target.value.length); }}
        />
        <div className="char-counter">{painCount > 0 ? (painCount < 30 ? `${painCount} / мин. 30` : `${painCount} ✓`) : `0 / мин. 30`}</div>

        {!showPainDeep && (
          <button
            type="button"
            className="edit-ctx"
            onClick={() => setShowPainDeep(true)}
            style={{ marginTop: 8 }}
          >
            + Углубить боль (необязательно — но упражнения станут точнее)
          </button>
        )}

        {showPainDeep && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: 10, border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
              Эти три вопроса делают упражнения сильнее. AI не будет предлагать то что ты уже пробовал, и учтёт срочность.
            </div>

            <div className="section-label">Что уже пробовал — и что не сработало?</div>
            <textarea
              className="ctx-textarea"
              rows={2}
              placeholder="Например: писал инструкции — устаревали к моменту выполнения; нанял проджекта — стал бутылочным горлышком..."
              value={painTried}
              onChange={(e) => setPainTried(e.target.value)}
            />

            <div className="section-label" style={{ marginTop: 12 }}>Что произойдёт если не решить за месяц-два?</div>
            <textarea
              className="ctx-textarea"
              rows={2}
              placeholder="Например: не закроем Q4, потеряю двух ключевых людей, выгорю и продам долю..."
              value={painStakes}
              onChange={(e) => setPainStakes(e.target.value)}
            />

            <div className="section-label" style={{ marginTop: 12 }}>Когда это началось / как давно болит?</div>
            <textarea
              className="ctx-textarea"
              rows={2}
              placeholder="Например: после того как наняли двух новых; последние полгода как выросли с 5 до 12..."
              value={painHistory}
              onChange={(e) => setPainHistory(e.target.value)}
            />
          </div>
        )}

        {error && <div style={{ color: 'var(--accent)', fontSize: 13, marginTop: 8 }}>{error}</div>}

        <div className="nav">
          <span className="ai-badge"><span className="ctx-dot" />Ответы используются только для персонализации</span>
          <button className="btn primary" onClick={handleCheck} disabled={!canProceed || checking}>
            {checking ? 'Проверяю...' : 'Создать воркбук →'}
          </button>
        </div>
      </div>
    </div>
  );
}
