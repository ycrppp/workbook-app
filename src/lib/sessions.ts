// In-memory session store for Telegram bot auth
// Sessions are short-lived (10 min), so in-memory is fine for single-instance deployments

export interface BotSession {
  status: 'pending' | 'confirmed';
  createdAt: number;
  telegramId?: number;
  chatId?: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  authToken?: string;
}

const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

class SessionStore {
  private map = new Map<string, BotSession>();

  set(token: string, session: BotSession) {
    this.map.set(token, session);
    setTimeout(() => this.map.delete(token), SESSION_TTL);
  }

  get(token: string): BotSession | undefined {
    const session = this.map.get(token);
    if (!session) return undefined;
    if (Date.now() - session.createdAt > SESSION_TTL) {
      this.map.delete(token);
      return undefined;
    }
    return session;
  }

  confirm(token: string, data: Omit<BotSession, 'status' | 'createdAt'>): boolean {
    const session = this.get(token);
    if (!session || session.status !== 'pending') return false;
    this.map.set(token, { ...session, ...data, status: 'confirmed' });
    return true;
  }

  delete(token: string) {
    this.map.delete(token);
  }
}

// Singleton — shared across all requests in the same Node.js process
export const sessions = new SessionStore();
