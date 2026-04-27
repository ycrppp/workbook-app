'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/state';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface MiniChatProps {
  exId: string;
  moduleId: string;
  instruction: string;
  userAnswer: string;
  onFocusAnswer?: () => void;
}

function getPreviousAnswers(answers: Record<string, string> | undefined, moduleId: string, currentExId: string): Record<string, string> {
  if (!answers) return {};
  const order = ['ex1', 'ex2', 'ex3'];
  const currentIdx = order.indexOf(currentExId);
  const result: Record<string, string> = {};
  order.slice(0, currentIdx).forEach((exId) => {
    const key = `${moduleId}_${exId}`;
    if (answers[key]?.trim()) result[exId] = answers[key].trim();
  });
  return result;
}

const EX_LABELS: Record<string, string> = {
  ex1: 'Диагностика',
  ex2: 'Инструмент',
  ex3: 'Следующий шаг',
};

export default function MiniChat({ exId, moduleId, instruction, userAnswer, onFocusAnswer }: MiniChatProps) {
  const { currentProject, authToken, updateCurrentProject } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = currentProject?.dialogCache?.[moduleId]?.[exId];
    if (cached?.chat) setMessages(cached.chat);
  }, [moduleId, exId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveChat = (msgs: Message[]) => {
    updateCurrentProject((p) => ({
      ...p,
      dialogCache: {
        ...p.dialogCache,
        [moduleId]: {
          ...p.dialogCache[moduleId],
          [exId]: { chat: msgs },
        },
      },
    }));
  };

  const callApi = async (msgs: Message[]) => {
    const resp = await fetch('/api/dialog-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        context: {
          role: currentProject?.role,
          size: currentProject?.size,
          biz: currentProject?.biz,
          pain: currentProject?.pain,
          painTried: currentProject?.painTried,
          painStakes: currentProject?.painStakes,
          painHistory: currentProject?.painHistory,
        },
        moduleId,
        exId,
        instruction,
        userAnswer,
        previousAnswers: getPreviousAnswers(currentProject?.answers, moduleId, exId),
        messages: msgs,
      }),
    });
    const data = await resp.json();
    return data.reply || '';
  };

  const openChat = async () => {
    setOpen(true);
    if (messages.length > 0) return;
    setLoading(true);
    try {
      const reply = await callApi([]);
      if (reply) {
        const [mainText, sug] = reply.includes('|||') ? reply.split('|||') : [reply, ''];
        const msgs: Message[] = [{ role: 'ai', text: mainText.trim() }];
        setMessages(msgs);
        setSuggestion(sug.trim());
        saveChat(msgs);
      } else {
        setMessages([{ role: 'ai', text: 'Сервис временно перегружен — попробуй через минуту.' }]);
      }
    } catch {
      setMessages([{ role: 'ai', text: 'Сервис временно перегружен — попробуй через минуту.' }]);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMsgs: Message[] = [...messages, { role: 'user', text }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    setSuggestion('');
    try {
      const reply = await callApi(newMsgs);
      const [mainText, sug] = reply.includes('|||') ? reply.split('|||') : [reply || 'Сервис временно перегружен.', ''];
      const withReply: Message[] = [...newMsgs, { role: 'ai', text: mainText.trim() }];
      setMessages(withReply);
      setSuggestion(sug.trim());
      saveChat(withReply);
    } catch {
      const withErr: Message[] = [...newMsgs, { role: 'ai', text: 'Ошибка соединения — попробуй снова.' }];
      setMessages(withErr);
      saveChat(withErr);
    }
    setLoading(false);
  };

  const exLabel = EX_LABELS[exId] || exId;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={openChat}
        style={{
          background: 'transparent',
          color: 'var(--accent)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginTop: 10,
        }}
      >
        Рассказать подробнее →
      </button>

      {/* Overlay */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 200,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              margin: '0 auto',
              background: 'var(--bg)',
              borderTop: '1px solid var(--border)',
              borderRadius: '16px 16px 0 0',
              padding: '16px 20px 28px',
              maxHeight: '65vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                Упражнение: <span style={{ color: 'var(--text2)' }}>{exLabel}</span>
              </p>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text3)',
                  fontSize: 20,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
              {messages.length === 0 && !loading && (
                <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
                  Разберём твой ответ подробнее — задавай вопросы или жди первого комментария.
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  {m.role === 'ai' && (
                    <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI</p>
                  )}
                  <p style={{
                    fontSize: 14,
                    color: m.role === 'ai' ? 'var(--text2)' : 'var(--text)',
                    lineHeight: 1.55,
                    background: m.role === 'user' ? 'var(--bg2)' : 'transparent',
                    padding: m.role === 'user' ? '8px 12px' : '0',
                    borderRadius: m.role === 'user' ? 10 : 0,
                  }}>
                    {m.text}
                  </p>
                </div>
              ))}
              {loading && (
                <p style={{ fontSize: 13, color: 'var(--text3)' }}>Думаю...</p>
              )}

              {/* Suggestion block */}
              {suggestion && (
                <div style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  marginTop: 8,
                }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Предложение для ответа:
                  </p>
                  <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, marginBottom: 12 }}>{suggestion}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {onFocusAnswer && (
                      <button
                        onClick={() => { setOpen(false); onFocusAnswer(); }}
                        style={{
                          flex: 1,
                          background: 'var(--text)',
                          color: 'var(--bg)',
                          border: 'none',
                          borderRadius: 10,
                          padding: '9px 12px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Вставить ✓
                      </button>
                    )}
                    <button
                      onClick={() => setSuggestion('')}
                      style={{
                        background: 'transparent',
                        color: 'var(--text2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '9px 12px',
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Изменить
                    </button>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
                placeholder="Ваш ответ..."
                style={{
                  flex: 1,
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 14,
                  color: 'var(--text)',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  background: 'var(--text)',
                  color: 'var(--bg)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: (!input.trim() || loading) ? 0.4 : 1,
                }}
              >
                →
              </button>
            </div>

            {/* Update answer button */}
            {onFocusAnswer && !suggestion && messages.length > 0 && (
              <button
                onClick={() => { setOpen(false); onFocusAnswer(); }}
                style={{
                  background: 'transparent',
                  color: 'var(--text3)',
                  border: 'none',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginTop: 10,
                  padding: '4px 0',
                  textAlign: 'center',
                }}
              >
                ✏️ Обновить ответ
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
