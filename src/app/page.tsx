'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/state';
import KinematicText from '@/components/KinematicText';

type AuthStep = 'idle' | 'waiting' | 'expired';

export default function WelcomePage() {
  const router = useRouter();
  const { tgUser, authToken, setTgUser, setAuthToken, setProjectsData, createNewProject, syncToServer, ready } = useApp();
  const devBtnRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<AuthStep>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // If already logged in — redirect
  useEffect(() => {
    if (!ready) return;
    if (tgUser && authToken) router.push('/projects');
  }, [ready, tgUser, authToken]);

  // Check if dev mode is available
  useEffect(() => {
    fetch('/api/dev-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => { if (r.ok && devBtnRef.current) devBtnRef.current.style.display = 'block'; })
      .catch(() => {});
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const loadUserData = async (token: string): Promise<boolean> => {
    try {
      const resp = await fetch('/api/user/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.projects) {
        const serverHasProjects = data.projects.projects?.length > 0;
        const localData = JSON.parse(localStorage.getItem('projects_data') || 'null');
        const localHasProjects = localData?.projects?.length > 0;

        if (serverHasProjects) {
          setProjectsData(data.projects);
          return false;
        } else if (localHasProjects) {
          syncToServer();
          return false;
        } else {
          createNewProject();
          return true;
        }
      }
    } catch {}
    return false;
  };

  const handleBotLogin = async () => {
    try {
      const resp = await fetch('/api/auth/bot-session', { method: 'POST' });
      const { token, botUsername } = await resp.json();
      sessionTokenRef.current = token;
      setStep('waiting');

      // Open bot with the session token
      window.open(`https://t.me/${botUsername}?start=${token}`, '_blank');

      // Start polling every 2.5s for up to 10 minutes
      let elapsed = 0;
      pollRef.current = setInterval(async () => {
        elapsed += 2500;
        if (elapsed > 10 * 60 * 1000) {
          clearInterval(pollRef.current!);
          setStep('expired');
          return;
        }
        try {
          const r = await fetch(`/api/auth/check-session?token=${token}`);
          const data = await r.json();
          if (data.confirmed) {
            clearInterval(pollRef.current!);
            setTgUser(data.user);
            setAuthToken(data.authToken);
            const isNew = await loadUserData(data.authToken);
            router.push(isNew ? '/onboarding' : '/projects');
          } else if (data.expired) {
            clearInterval(pollRef.current!);
            setStep('expired');
          }
        } catch {}
      }, 2500);
    } catch {
      setStep('idle');
    }
  };

  const handleDevLogin = async () => {
    try {
      const resp = await fetch('/api/dev-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: 1 }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const devUser = { id: 1, first_name: 'Dev', username: 'dev' };
      setTgUser(devUser);
      setAuthToken(data.token);
      const isNew = await loadUserData(data.token);
      router.push(isNew ? '/onboarding' : '/projects');
    } catch {}
  };

  const handleRetry = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    sessionTokenRef.current = null;
    setStep('idle');
  };

  const openModal = (id: string) => {
    const el = document.getElementById(`modal-${id}`);
    if (el) { el.style.display = 'flex'; el.style.opacity = '1'; el.style.pointerEvents = 'all'; }
  };

  return (
    <>
      <div id="welcome-page">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: '1.5rem' }}>
          <div className="app-logo" style={{ pointerEvents: 'none' }}>Workbook</div>
          <span style={{ fontSize: 10, fontWeight: 300, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text3)' }}>beta</span>
        </div>
        <div className="w-badge">Воркбук · <em>Стивен Бангей</em></div>
        <div className="w-icon">📖</div>
        <KinematicText text="Искусство действия" className="w-title" />
        <KinematicText text="Персональные упражнения по книге — сгенерированные AI под вашу конкретную ситуацию. Не шаблоны, а работа с вашим реальным контекстом." className="w-sub" />

        <div ref={devBtnRef} style={{ display: 'none', marginBottom: '1rem' }}>
          <button
            onClick={handleDevLogin}
            style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.2)', color: 'rgba(0,0,0,0.45)', padding: '7px 20px', borderRadius: '50px', fontSize: 12, fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}
          >
            dev login
          </button>
        </div>

        <div id="tg-login-wrap" style={{ textAlign: 'center' }}>
          {step === 'idle' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 300, color: 'rgba(0,0,0,0.55)', marginBottom: '0.75rem', lineHeight: 1.6, letterSpacing: '-0.1px' }}>
                Авторизуйтесь через Telegram, чтобы начать
              </div>
              <button
                onClick={handleBotLogin}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#2AABEE', color: '#fff', border: 'none', padding: '11px 28px', borderRadius: '50px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em' }}
              >
                <TelegramIcon />
                Войти через Telegram
              </button>
            </>
          )}

          {step === 'waiting' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text1)', marginBottom: '0.5rem' }}>
                Ожидаем подтверждение...
              </div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                Нажмите <strong>Старт</strong> в боте, затем вернитесь сюда
              </div>
              <Spinner />
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  onClick={handleRetry}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.4)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.2)' }}
                >
                  Начать заново
                </button>
              </div>
            </div>
          )}

          {step === 'expired' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '0.75rem' }}>
                Ссылка устарела. Попробуйте снова.
              </div>
              <button
                onClick={handleRetry}
                className="w-cta"
                style={{ display: 'inline-block' }}
              >
                Попробовать снова
              </button>
            </div>
          )}
        </div>

        <div className="w-hint" style={{ marginTop: '1.5rem' }}>4 модуля · ~30 минут каждый</div>

        <button
          onClick={() => openModal('book')}
          style={{ marginTop: '1rem', marginBottom: '2rem', background: 'transparent', border: '1px solid rgba(0,0,0,0.2)', color: 'rgba(0,0,0,0.6)', padding: '9px 24px', borderRadius: '50px', fontSize: 13, fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em', transition: 'all 0.15s' }}
          onMouseOver={(e) => { (e.target as HTMLElement).style.borderColor = '#fa471f'; (e.target as HTMLElement).style.color = '#fa471f'; }}
          onMouseOut={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(0,0,0,0.2)'; (e.target as HTMLElement).style.color = 'rgba(0,0,0,0.6)'; }}
        >
          Что за книга? →
        </button>

        <div className="w-features">
          <div className="w-feat">
            <div className="wf-icon">🎯</div>
            <div>
              <div className="wf-title">Персонализация</div>
              <div className="wf-sub">Каждое упражнение пишется под вашу роль и ситуацию</div>
            </div>
          </div>
          <div className="w-feat">
            <div className="wf-icon">⚡</div>
            <div>
              <div className="wf-title">AI-генерация</div>
              <div className="wf-sub">Упражнения создаются мгновенно — не из банка заданий</div>
            </div>
          </div>
          <div className="w-feat">
            <div className="wf-icon">🔓</div>
            <div>
              <div className="wf-title">Прогрессия</div>
              <div className="wf-sub">Модули открываются последовательно, каждый строится на предыдущем</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', fontSize: 12, color: 'rgba(0,0,0,0.4)', textAlign: 'center', letterSpacing: '0.02em', lineHeight: 1.4, maxWidth: 440, paddingBottom: '1rem' }}>
          Авторизуясь, вы принимаете условия{' '}
          <span onClick={() => openModal('oferta')} style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.25)' }}>публичной оферты</span>{' '}
          и соглашаетесь на обработку персональных данных согласно{' '}
          <span onClick={() => openModal('privacy')} style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.25)' }}>политике конфиденциальности</span>
          {' · '}
          <span onClick={() => openModal('nda')} style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.25)' }}>Соглашение о конфиденциальности данных</span>
        </div>
      </div>

      {['book', 'oferta', 'privacy', 'nda'].map((id) => (
        <div key={id} id={`modal-${id}`} className="modal-overlay" style={{ display: 'none' }} onClick={(e) => { if (e.target === e.currentTarget) (e.currentTarget as HTMLElement).style.display = 'none'; }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => { document.getElementById(`modal-${id}`)!.style.display = 'none'; }}>✕</button>
            <ModalContent id={id} />
          </div>
        </div>
      ))}
    </>
  );
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.367l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.192z" fill="currentColor"/>
    </svg>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'inline-block', width: 28, height: 28, border: '2.5px solid rgba(0,0,0,0.1)', borderTopColor: '#2AABEE', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ModalContent({ id }: { id: string }) {
  if (id === 'book') return (
    <>
      <div className="modal-title">Искусство действия</div>
      <div className="modal-sub">Стивен Бангей · The Art of Action</div>
      <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
        Книга о том, почему между стратегией и результатом всегда есть разрыв — и что с этим делать.
        Бангей исследует прусскую военную доктрину и переводит её принципы в язык современного бизнеса.
        Основная идея: чем подробнее план, тем быстрее он разваливается при контакте с реальностью.
        Решение — передавать намерение, а не инструкции.
      </p>
    </>
  );
  if (id === 'oferta') return <><div className="modal-title">Публичная оферта</div><p style={{ fontSize: 14, color: 'var(--text2)' }}>Текст публичной оферты.</p></>;
  if (id === 'privacy') return <><div className="modal-title">Политика конфиденциальности</div><p style={{ fontSize: 14, color: 'var(--text2)' }}>Текст политики конфиденциальности.</p></>;
  if (id === 'nda') return <><div className="modal-title">Соглашение о конфиденциальности</div><p style={{ fontSize: 14, color: 'var(--text2)' }}>Текст соглашения.</p></>;
  return null;
}
