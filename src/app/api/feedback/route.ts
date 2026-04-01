import { NextRequest, NextResponse } from 'next/server';
import { MODULE_TITLES } from '@/lib/books';

export async function POST(req: NextRequest) {
  const { context, moduleId, answers } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const answersText = [
    answers?.ex1 ? `Диагностика: ${answers.ex1.trim()}` : null,
    answers?.ex2 ? `Инструмент: ${answers.ex2.trim()}` : null,
    answers?.ex3 ? `Следующий шаг: ${answers.ex3.trim()}` : null,
  ].filter(Boolean).join('\n\n');

  const systemPrompt = `Ты — куратор воркбука по книге «Искусство действия» Стивена Бангея. Пользователь только что завершил модуль и ты даёшь короткую обратную связь по его ответам.

ФОРМАТ — строго 2-3 предложения:
1. Отразить что конкретно он сделал — его словами, не своими.
2. Если ответ поверхностный — мягко обозначь: "Следующий шаг пока звучит широко — попробуй сузить до одного конкретного действия на этой неделе".
3. Одно предложение-мостик к следующему модулю — что он теперь сможет увидеть иначе.

ЗАПРЕТЫ:
- Никаких оценок ("хорошо", "отлично", "молодец")
- Никаких общих фраз ("это важный шаг", "ты на верном пути")
- Максимум 3 предложения

Пиши на «ты». Живым языком. Коротко.`;

  const userMsg = `Модуль: ${MODULE_TITLES[moduleId] || moduleId}

Контекст пользователя:
Роль: ${context?.role || 'не указана'}
Бизнес: ${context?.biz || 'не описан'}
Боль: ${context?.pain || 'не описана'}

Его ответы:
${answersText || 'Ответы не заполнены'}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 300, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] }),
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() || '';
    return NextResponse.json({ success: true, feedback: text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
