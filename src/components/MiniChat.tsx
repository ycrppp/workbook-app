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

function chatMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export default function MiniChat({ exId, moduleId, instruction, userAnswer, onFocusAnswer }: MiniChatProps) {
  const { currentProject, authToken, updateCurrentProject } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = currentProject?.dialogCache?.[moduleId]?.[exId];
    if (cached?.chat) setMessages(cached.chat);
  }, [moduleId, exId]);

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

  const scrollToBottom = () => {
    setTimeout(() => {
      msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  const openChat = async () => {
    setOpen(true);
    if (messages.length > 0) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/dialog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({
          context: { role: currentProject?.role, size: currentProject?.size, biz: currentProject?.biz, pain: currentProject?.pain },
          moduleId,
          exId,
          instruction,
          userAnswer,
          previousAnswers: getPreviousAnswers(currentProject?.answers, moduleId, exId),
          messages: [],
        }),
      });
      const data = await resp.json();
      if (data.reply) {
        const msgs: Message[] = [{ role: 'ai', text: data.reply }];
        setMessages(msgs);
        saveChat(msgs);
        scrollToBottom();
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
    scrollToBottom();
    try {
      const resp = await fetch('/api/dialog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({
          context: { role: currentProject?.role, size: currentProject?.size, biz: currentProject?.biz, pain: currentProject?.pain },
          moduleId,
          exId,
          instruction,
          userAnswer,
          previousAnswers: getPreviousAnswers(currentProject?.answers, moduleId, exId),
          messages: newMsgs,
        }),
      });
      const data = await resp.json();
      const reply = data.reply || 'Сервис временно перегружен.';
      const withReply: Message[] = [...newMsgs, { role: 'ai', text: reply }];
      setMessages(withReply);
      saveChat(withReply);
      scrollToBottom();
    } catch {
      const withErr: Message[] = [...newMsgs, { role: 'ai', text: 'Ошибка соединения — попробуй снова.' }];
      setMessages(withErr);
      saveChat(withErr);
    }
    setLoading(false);
  };

  return (
    <div>
      {!open && (
        <button className="chat-open-btn" onClick={openChat}>
          Разобрать подробнее →
        </button>
      )}
      {open && (
        <div className="chat-panel">
          <div className="chat-messages" ref={msgsRef}>
            {loading && messages.length === 0 && (
              <div className="chat-msg chat-msg-ai">
                <span className="spinner" /> Думаю...
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg-${m.role}`} dangerouslySetInnerHTML={{ __html: chatMarkdown(m.text) }} />
            ))}
          </div>
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              rows={2}
              placeholder="Ответить..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              disabled={loading}
            />
            <button className="chat-send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
              {loading ? '...' : '↑'}
            </button>
          </div>
          {onFocusAnswer && (
            <button
              className="chat-update-answer-btn"
              onClick={onFocusAnswer}
            >
              ✏️ Обновить ответ
            </button>
          )}
        </div>
      )}
    </div>
  );
}
