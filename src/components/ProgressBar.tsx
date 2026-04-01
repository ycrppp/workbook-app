'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/state';

interface Props {
  step: number; // 0-6
  showBack?: boolean; // show "← Все воркбуки" button
}

const PCT: Record<number, number> = { 0: 0, 1: 10, 2: 28, 3: 50, 4: 68, 5: 88, 6: 100 };
const LABELS: Record<number, string> = {
  0: 'Ваши воркбуки', 1: 'Шаг 1 из 5', 2: 'Шаг 2 из 5',
  3: 'Шаг 3 из 5', 4: 'Загрузка...', 5: 'Упражнения', 6: 'Итог',
};

export default function ProgressBar({ step, showBack = false }: Props) {
  const router = useRouter();
  const { projectsData } = useApp();
  const hasProjects = projectsData.projects.length > 0;

  return (
    <div className="progress-wrap">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${PCT[step] ?? 0}%` }} />
      </div>
      <div className="progress-row">
        <div className="progress-label">{LABELS[step]}</div>
        {showBack && hasProjects && (
          <button className="all-workbooks-btn" onClick={() => router.push('/projects')}>← Все воркбуки</button>
        )}
      </div>
    </div>
  );
}
