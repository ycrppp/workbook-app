import { NextRequest, NextResponse } from 'next/server';
import { MODULE_TITLES } from '@/lib/books';

const EX_LABELS: Record<string, string> = {
  ex1: 'Диагностика',
  ex2: 'Инструмент',
  ex3: 'Следующий шаг',
};

export async function POST(req: NextRequest) {
  const { context, answers } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const answersText = ['gaps', 'intent', 'cascade', 'independence']
    .map((modId) => {
      const items = ['ex1', 'ex2', 'ex3']
        .map((exId) => {
          const val = answers && answers[`${modId}_${exId}`];
          return val && val.trim() ? `  ${EX_LABELS[exId]}: ${val.trim()}` : null;
        })
        .filter(Boolean)
        .join('\n');
      return items ? `### ${MODULE_TITLES[modId]}\n${items}` : null;
    })
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = `Ты завершаешь воркбук по книге «Искусство действия» Стивена Бангея для конкретного предпринимателя или руководителя.

ЧАСТЬ 1 — СИНТЕЗ (2–3 предложения):
Покажи человеку, что именно он сделал за этот воркбук. Используй его собственные слова из ответов. Не оценивай — только отражение. Пиши про него, а не к нему.

ЧАСТЬ 2 — ФИНАЛЬНОЕ ЗАДАНИЕ:
Сформулируй одно конкретное действие на эту неделю. Не список — одно главное действие. Оно должно:
- Вытекать из его ответов в "Следующий шаг" по модулям
- Быть конкретным: не "улучшить коммуникацию" — а конкретное действие с кем, что, когда
- Начинаться с глагола действия

Пиши на «ты». Короткие предложения. Без вводных фраз типа "Итак".

Верни строго JSON без markdown:
{
  "synthesis": "...",
  "task_title": "Твоё первое действие",
  "task_body": "..."
}`;

  const userMsg = `Контекст пользователя:
Роль: ${context?.role || 'не указана'}
Команда: ${context?.size || 'не указан размер'}
Бизнес: ${context?.biz || 'не описан'}
Главная боль: ${context?.pain || 'не описана'}

Его ответы по всем модулям:
${answersText || 'Ответы не заполнены'}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${err}`);
    }
    const data = await response.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json({ success: true, ...parsed });
  } catch (err: any) {
    console.error('[final] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
