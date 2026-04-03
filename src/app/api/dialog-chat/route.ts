import { NextRequest, NextResponse } from 'next/server';
import { MODULE_TITLES } from '@/lib/books';

const EX_LABELS: Record<string, string> = {
  ex1: 'Диагностика',
  ex2: 'Инструмент',
  ex3: 'Следующий шаг',
};

const EX_GOAL: Record<string, string> = {
  ex1: 'Упражнение — ДИАГНОСТИКА. Твои допустимые действия: (1) спросить где именно или как именно это проявляется в его ситуации, (2) попросить привести конкретный пример из его практики, (3) уточнить что он имеет в виду под тем или иным словом в своём ответе. Цель — чтобы ответ стал конкретнее и точнее описывал его реальность через концепцию модуля. Больше ничего.',
  ex2: 'Упражнение — ИНСТРУМЕНТ. Твои допустимые действия: (1) спросить про конкретный элемент инструмента который он не заполнил или заполнил размыто, (2) попросить уточнить формулировку чтобы она была применима прямо сейчас, (3) спросить как именно это выглядит в его конкретной ситуации. Цель — чтобы артефакт упражнения получился рабочим. Больше ничего.',
  ex3: 'Упражнение — СЛЕДУЮЩИЙ ШАГ. Твои допустимые действия: (1) спросить кто конкретно это сделает, (2) спросить что именно он сделает — одно действие, (3) спросить когда именно — конкретная дата или день недели. Цель — одно действие с максимальной конкретикой. Больше ничего.',
};

export async function POST(req: NextRequest) {
  const { context, moduleId, exId, instruction, userAnswer, messages } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const systemPrompt = `Ты — инструмент улучшения ответа на упражнение воркбука по книге «Искусство действия» Стивена Бангея.

ЧТО ТЫ ЕСТЬ: ты задаёшь ровно один вопрос за раз, который помогает пользователю сделать его текущий ответ конкретнее и точнее. Ты не консультант, не коуч, не эксперт — ты инструмент с одной функцией.

УПРАЖНЕНИЕ:
Модуль: ${MODULE_TITLES[moduleId] || moduleId}
Тип: ${EX_LABELS[exId] || exId}
Задание: ${instruction || ''}

Контекст пользователя:
Роль: ${context?.role || 'не указана'}
Бизнес: ${context?.biz || 'не описан'}
Боль: ${context?.pain || 'не описана'}

Его ответ на упражнение:
${(userAnswer || '').trim()}

ЧТО ТЫ МОЖЕШЬ ДЕЛАТЬ — только это:
${EX_GOAL[exId] || 'Задавай уточняющие вопросы по ответу пользователя, чтобы он стал конкретнее.'}

ЧТО ТЫ НЕ ДЕЛАЕШЬ НИКОГДА:
- Не вводишь термины, концепции или идеи которых нет в ответе пользователя или в задании упражнения
- Не интерпретируешь ситуацию пользователя — только уточняешь то, что он сам написал
- Не даёшь советов, оценок и рекомендаций
- Не выходишь за пределы одного упражнения
- Если пользователь спрашивает о чём-то вне упражнения — один раз коротко возвращаешь его к заданию

ФОРМАТ: 1-2 предложения максимум. Один вопрос. На «ты». Без вступлений.`;

  const history = (messages || []).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  if (history.length === 0) {
    history.push({ role: 'user', content: 'Начни диалог — сразу с вопроса, без вступления.' });
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 3000, 6000];
  let lastErr: Error = new Error('Unknown error');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
      console.log(`[dialog-chat] retry ${attempt}/${MAX_RETRIES - 1}`);
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 200, system: systemPrompt, messages: history }),
      });
      clearTimeout(timeout);
      if (response.status === 529) { lastErr = new Error('Anthropic error: 529'); continue; }
      if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
      const data = await response.json();
      const reply = data.content?.[0]?.text?.trim() || '';
      return NextResponse.json({ success: true, reply });
    } catch (err: any) {
      lastErr = err;
      if (!err.message?.includes('529')) break;
    }
  }

  console.error('[dialog-chat] error:', lastErr);
  return NextResponse.json({ error: lastErr.message }, { status: 500 });
}
