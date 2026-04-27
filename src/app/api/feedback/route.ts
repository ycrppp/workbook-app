import { NextRequest, NextResponse } from 'next/server';
import { MODULE_TITLES } from '@/lib/books';
import { getContextSummary } from '@/lib/scenario';

export async function POST(req: NextRequest) {
  const { context, moduleId, answers } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const answersText = [
    answers?.ex1 ? `Диагностика: ${answers.ex1.trim()}` : null,
    answers?.ex2 ? `Инструмент: ${answers.ex2.trim()}` : null,
    answers?.ex3 ? `Следующий шаг: ${answers.ex3.trim()}` : null,
  ].filter(Boolean).join('\n\n');

  // Pain layered context if available
  const painLayers = [
    context?.pain ? `Боль: ${context.pain}` : null,
    context?.painSymptom ? `Симптом: ${context.painSymptom}` : null,
    context?.painHistory ? `История: ${context.painHistory}` : null,
    context?.painTried ? `Что уже пробовал: ${context.painTried}` : null,
    context?.painStakes ? `Ставка: ${context.painStakes}` : null,
  ].filter(Boolean).join('\n');

  const systemPrompt = `Ты — куратор воркбука по книге «Искусство действия» Стивена Бангея. Пользователь только что завершил модуль и ты даёшь обратную связь и формируешь состояние нити.

У тебя ДВЕ задачи:

1. FEEDBACK — синтез-мост для пользователя (4-6 предложений, видит он):
   Это не короткая выжимка и не похвала — это мост между модулем который он завершил и его болью. Структура:
   - Что он реально увидел про свою ситуацию через этот модуль — его словами, опираясь на конкретику из его ответов (что было в ex1, что он создал в ex2, что решил сделать в ex3). Не пересказывай ответы — назови сдвиг.
   - Что в его боли стало понятнее или сдвинулось благодаря этому модулю — связь с его болью из анкеты, конкретно.
   - Что осталось открытым в его боли и зачем нужен следующий модуль — не «дальше будет про X», а «вот эта часть твоей боли пока не закрыта, и следующий модуль работает именно с ней».
   Тон: тёплый, по-человечески, как будто говорит куратор который реально прочитал ответы. Без оценок («хорошо», «молодец», «отличный ответ»), без коррекции («попробуй уточнить»), без общих фраз («важный шаг», «полезное упражнение»). На «ты». Не бойся длины — синтез важнее краткости, но и не растекайся.

2. THREAD STATE — машинно-читаемое состояние нити (для AI следующего модуля, пользователь не видит):
   - closed: что именно из боли закрылось этим модулем — 1-2 предложения, конкретно
   - open: что осталось нерешённым из боли, что должны подхватить следующие модули — 1-2 предложения
   - artifact: самый конкретный результат который пользователь создал в этом модуле — одна фраза (например "замысел для запуска Q4 с 5 элементами Бангея", "список 3 задач где говорю КАК вместо ЗАЧЕМ")

Верни строго JSON без markdown:
{"feedback": "...", "threadState": {"closed": "...", "open": "...", "artifact": "..."}}`;

  const userMsg = `Модуль: ${MODULE_TITLES[moduleId] || moduleId}

Контекст пользователя:
Роль: ${context?.role || 'не указана'}
Размер команды: ${context?.size || 'не указан'}
Бизнес: ${context?.biz || 'не описан'}
${painLayers || 'Боль не описана'}
Сценарий: ${getContextSummary(context?.role || '', context?.size || '')}

Его ответы:
${answersText || 'Ответы не заполнены'}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] }),
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
    const data = await response.json();
    const raw = data.content?.[0]?.text?.trim() || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    let parsed: { feedback?: string; threadState?: { closed?: string; open?: string; artifact?: string } } = {};
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Fallback: if model returned plain text instead of JSON, treat all as feedback
      parsed = { feedback: clean };
    }
    return NextResponse.json({
      success: true,
      feedback: parsed.feedback || '',
      threadState: parsed.threadState || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
