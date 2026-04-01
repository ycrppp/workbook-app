import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function initDb() {
  const p = getPool();
  if (!p) { console.log('[db] DATABASE_URL not set, skipping DB init'); return; }
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        first_name  TEXT,
        last_name   TEXT,
        username    TEXT,
        photo_url   TEXT,
        projects    JSONB NOT NULL DEFAULT '{"projects":[],"currentProjectId":null}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await p.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0
    `);
    await p.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_id BIGINT
    `);
    console.log('[db] table ready');
  } catch (e: any) {
    console.error('[db] init error:', e.message);
  }
}
