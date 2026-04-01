import { NextRequest, NextResponse } from 'next/server';

// Этот эндпоинт принимает ответы для аналитики
// Сейчас просто возвращает success, данные хранятся в projects через /api/user/sync
export async function POST(req: NextRequest) {
  return NextResponse.json({ success: true });
}
