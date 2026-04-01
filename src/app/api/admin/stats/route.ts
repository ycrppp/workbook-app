import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const secret = process.env.BACKUP_SECRET;
  if (!secret || req.headers.get('x-backup-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: 'No database' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : null;
  const to = searchParams.get('to') ? new Date(searchParams.get('to')! + 'T23:59:59Z') : null;

  const rangeWhere = from && to ? `AND created_at BETWEEN $1 AND $2` : from ? `AND created_at >= $1` : to ? `AND created_at <= $1` : '';
  const rangeParams = from && to ? [from, to] : from ? [from] : to ? [to] : [];

  try {
    const [byDay, byWeek, byMonth, avgModules, avgProjects, total, inRange, avgLogins] = await Promise.all([
      pool.query(`SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS label, COUNT(*)::int AS count FROM users WHERE 1=1 ${rangeWhere} GROUP BY label ORDER BY label`, rangeParams),
      pool.query(`SELECT TO_CHAR(DATE_TRUNC('week', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS label, COUNT(*)::int AS count FROM users WHERE 1=1 ${rangeWhere} GROUP BY label ORDER BY label`, rangeParams),
      pool.query(`SELECT TO_CHAR(DATE_TRUNC('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS label, COUNT(*)::int AS count FROM users WHERE 1=1 ${rangeWhere} GROUP BY label ORDER BY label`, rangeParams),
      pool.query(`SELECT ROUND(AVG(modules_count)::numeric, 1)::float AS avg FROM (SELECT telegram_id, COALESCE(SUM(COALESCE(jsonb_array_length(p->'completedModules'), 0)), 0) AS modules_count FROM users, jsonb_array_elements(projects->'projects') p GROUP BY telegram_id) t`),
      pool.query(`SELECT ROUND(AVG(jsonb_array_length(projects->'projects'))::numeric, 1)::float AS avg FROM users WHERE jsonb_array_length(projects->'projects') > 0`),
      pool.query(`SELECT COUNT(*)::int AS count FROM users`),
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE 1=1 ${rangeWhere}`, rangeParams),
      pool.query(`SELECT ROUND(AVG(login_count)::numeric, 1)::float AS avg FROM users WHERE login_count > 0`),
    ]);

    return NextResponse.json({
      total: total.rows[0].count,
      inRange: inRange.rows[0].count,
      byDay: byDay.rows,
      byWeek: byWeek.rows,
      byMonth: byMonth.rows,
      avgModules: avgModules.rows[0].avg ?? 0,
      avgProjects: avgProjects.rows[0].avg ?? 0,
      avgLogins: avgLogins.rows[0].avg ?? 0,
      from: searchParams.get('from') || null,
      to: searchParams.get('to') || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
