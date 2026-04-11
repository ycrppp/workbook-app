'use client';

import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/state';
import MiniChat from './MiniChat';

interface ExerciseProps {
  exId: string;
  exIndex: number;
  moduleId: string;
  title: string;
  instruction: string;
  onAnswerChange?: () => void;
  onFirstComplete?: (answer: string) => void;
}

const MIN_CHARS = 100;

export default function Exercise({ exId, exIndex, moduleId, title, instruction, onAnswerChange, onFirstComplete }: ExerciseProps) {
  const { currentProject, updateCurrentProject, syncToServer } = useApp();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ans = currentProject?.answers?.[`${moduleId}_${exId}`] || '';
    setValue(ans);
    setShowChat(ans.trim().length >= MIN_CHARS);
  }, [moduleId, exId, currentProject?.answers]);

  const len = value.trim().length;
  const counterText = len === 0 ? `0 / мин. ${MIN_CHARS}` : len >= MIN_CHARS ? `${len} ✓` : `${len} / мин. ${MIN_CHARS}`;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);
    const trimLen = val.trim().length;
    if (trimLen < MIN_CHARS) {
      setShowChat(false);
    }
    onAnswerChange?.();
  };

  const handleBlur = async () => {
    const trimmed = value.trim();
    updateCurrentProject((p) => ({
      ...p,
      answers: { ...p.answers, [`${moduleId}_${exId}`]: trimmed },
    }));
    syncToServer();

    if (trimmed.length >= MIN_CHARS && !showChat) {
      setShowChat(true);
      onFirstComplete?.(trimmed);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="ex-block">
      <div className="ex-header">Упражнение {exIndex} — {title}</div>
      <div className="ex-body">
        <div className="ex-instruction">{instruction}</div>
        <textarea
          ref={textareaRef}
          className="ex-answer"
          rows={5}
          placeholder="Напишите ответ здесь..."
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <div className="char-counter ex-ans-counter">{counterText}</div>
        <div className={`ex-saved ${saved ? 'show' : ''}`}>✓ Сохранено</div>

        {showChat && (
          <MiniChat
            exId={exId}
            moduleId={moduleId}
            instruction={instruction}
            userAnswer={value}
            onFocusAnswer={() => {
              textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => textareaRef.current?.focus(), 300);
            }}
          />
        )}
      </div>
    </div>
  );
}
