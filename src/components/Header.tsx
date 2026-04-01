'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/state';

export default function Header() {
  const { tgUser, logout } = useApp();
  const router = useRouter();

  if (!tgUser) return null;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="app-header" style={{ display: 'flex' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, cursor: 'pointer' }} onClick={() => router.push('/projects')}>
        <div className="app-logo">Workbook</div>
        <span style={{ fontSize: 10, fontWeight: 300, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text3)' }}>beta</span>
      </div>
      <div className="user-badge">
        {tgUser.photo_url && (
          <img className="user-avatar" src={tgUser.photo_url} alt="" />
        )}
        <span className="user-name">{tgUser.first_name}</span>
        <div className="user-dropdown">
          <div className="user-dropdown-item" onClick={() => router.push('/projects')}>
            Мои воркбуки
          </div>
          <div className="user-dropdown-item danger" onClick={handleLogout}>
            Выйти
          </div>
        </div>
      </div>
    </header>
  );
}
