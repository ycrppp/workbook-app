import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ success: true });

  const { first_name, last_name, username, photo_url, projects } = await req.json();

  try {
    await pool.query(
      `INSERT INTO users (telegram_id, first_name, last_name, username, photo_url, projects, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (telegram_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name  = EXCLUDED.last_name,
         username   = EXCLUDED.username,
         photo_url  = EXCLUDED.photo_url,
         projects   = EXCLUDED.projects,
         updated_at = NOW()`,
      [auth.tid, first_name || '', last_name || '', username || '', photo_url || '', JSON.stringify(projects)]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[db] sync error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
