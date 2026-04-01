import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  const pool = getPool();
  const status: any = { status: 'ok', db: pool ? 'checking' : 'disabled', ts: new Date().toISOString() };
  if (pool) {
    try {
      await pool.query('SELECT 1');
      status.db = 'ok';
    } catch (e: any) {
      status.db = 'error';
      status.dbError = e.message;
      return NextResponse.json(status, { status: 503 });
    }
  }
  return NextResponse.json(status);
}
