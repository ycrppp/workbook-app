import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (process.env.DEV_MODE !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  try {
    let telegram_id = 1;
    try {
      const body = await req.json();
      telegram_id = body?.telegram_id || 1;
    } catch {}
    const token = signToken(telegram_id);
    return NextResponse.json({ token });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
