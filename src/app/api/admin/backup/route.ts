import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const secret = process.env.BACKUP_SECRET;
  if (!secret || req.headers.get('x-backup-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: 'No database' }, { status: 503 });

  try {
    const result = await pool.query(
      'SELECT telegram_id, first_name, last_name, username, projects, created_at, updated_at FROM users'
    );
    return new NextResponse(JSON.stringify(result.rows), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup_${Date.now()}.json"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
