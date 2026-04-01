import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ projects: { projects: [], currentProjectId: null } });

  try {
    const result = await pool.query(
      `UPDATE users SET login_count = login_count + 1 WHERE telegram_id = $1
       RETURNING projects, login_count`,
      [auth.tid]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ projects: { projects: [], currentProjectId: null }, isNew: true });
    }
    return NextResponse.json({ projects: result.rows[0].projects });
  } catch (e: any) {
    console.error('[db] load error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
