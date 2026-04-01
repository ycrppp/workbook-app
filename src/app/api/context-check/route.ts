import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { context } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Пользователь заполнил анкету для воркбука. Перескажи его ситуацию своими словами — 2–3 коротких предложения. Только то, что он написал. Никаких выводов, советов и оценок. Пиши на «ты».

Роль: ${context.role || 'не указана'}
Команда: ${context.size || 'не указан размер'}
Бизнес: ${context.biz || 'не описан'}
Главная боль: ${context.pain || 'не описана'}

Верни просто текст, без JSON и markdown.`,
        }],
      }),
    });
    clearTimeout(t);
    const data = await response.json();
    const summary = data.content?.[0]?.text?.trim() || '';
    return NextResponse.json({ summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
