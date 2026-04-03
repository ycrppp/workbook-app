import { NextRequest, NextResponse } from 'next/server';
import { MODULE_TITLES } from '@/lib/books';

const EX_LABELS: Record<string, string> = {
  ex1: 'Диагностика',
  ex2: 'Инструмент',
  ex3: 'Следующий шаг',
};

const EX_GOAL: Record<string, string> = {
  ex1: 'Упражнение — ДИАГНОСТИКА. Каждый твой ответ состоит из двух частей: (1) наблюдение — что в его ответе уже есть и что осталось размытым или не названным относительно задания, (2) один вопрос — который помогает заполнить главный пробел. Наблюдение строго по тексту его ответа и заданию — не додумывай. Цель — чтобы ответ точнее описывал его реальную ситуацию через концепцию модуля. ЗАПРЕЩЕНО спрашивать про действия, решения или следующие шаги — это не задача диагностики.',
  ex2: 'Упражнение — ИНСТРУМЕНТ. Каждый твой ответ состоит из двух частей: (1) наблюдение — какой элемент инструмента заполнен конкретно, а какой остался размытым или пропущенным, (2) один вопрос — про самый слабый элемент артефакта. Наблюдение строго по тексту его ответа и заданию. Цель — чтобы все элементы артефакта были заполнены конкретно. ЗАПРЕЩЕНО спрашивать про действия, звонки, следующие шаги — это не твоя задача здесь.',
  ex3: 'Упражнение — СЛЕДУЮЩИЙ ШАГ. Каждый твой ответ состоит из двух частей: (1) наблюдение — что из «кто / что / когда» уже названо конкретно, а что осталось расплывчатым, (2) один вопрос — про самое расплывчатое. Наблюдение строго по тексту его ответа. Цель — одно действие с максимальной конкретикой.',
};

export async function POST(req: NextRequest) {
  const { context, moduleId, exId, instruction, userAnswer, previousAnswers, messages } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const systemPrompt = `Ты — инструмент улучшения ответа на упражнение воркбука по книге «Искусство действия» Стивена Бангея.

ЧТО ТЫ ЕСТЬ: ты помогаешь пользователю улучшить его ответ на упражнение — замечаешь что уже есть и что можно уточнить, задаёшь один вопрос за раз.

УПРАЖНЕНИЕ:
Модуль: ${MODULE_TITLES[moduleId] || moduleId}
Тип: ${EX_LABELS[exId] || exId}
Задание: ${instruction || ''}

Контекст пользователя:
Роль: ${context?.role || 'не указана'}
Размер команды: ${context?.size || 'не указан'}
Бизнес: ${context?.biz || 'не описан'}
Боль: ${context?.pain || 'не описана'}
${previousAnswers && Object.keys(previousAnswers).length > 0
  ? `\nПредыдущие ответы в этом модуле (фоновый контекст — используй чтобы точнее понимать ситуацию, не обсуждай их напрямую):\n${Object.entries(previousAnswers).map(([k, v]) => `${EX_LABELS[k] || k}: ${v}`).join('\n')}`
  : ''}

Его ответ на упражнение:
${(userAnswer || '').trim()}

ЧТО ТЫ ДЕЛАЕШЬ:
${EX_GOAL[exId] || 'Задавай уточняющие вопросы по ответу пользователя, чтобы он стал конкретнее.'}

КРИТЕРИЙ ЗАВЕРШЕНИЯ: если все элементы задания заполнены конкретно и ответ не требует уточнений — скажи об этом одним предложением, затем попроси пользователя нажать кнопку «Обновить ответ» и вписать финальную версию в поле упражнения.

ФОРМАТ: наблюдение (1-2 предложения) + один вопрос. Итого не более 3 предложений. На «ты». Без вступлений и похвалы.

ТОНАЛЬНОСТЬ: живо, тепло, по-человечески. Никогда не используй фразы «не могу», «за пределами», «только уточняю» — они звучат холодно и механично.

КОГДА ПОЛЬЗОВАТЕЛЬ УХОДИТ ЗА РАМКИ УПРАЖНЕНИЯ:
Обязательный формат ответа — три части:
1. Короткое тёплое признание («К сожалению,» или «Хороший вопрос, но...»)
2. Мягкое объяснение без слова «функция»: «здесь я помогаю только с доработкой твоего ответа на это упражнение»
3. Конкретное предложение что делать: «Переформулируй сообщение в контексте упражнения — или нажми "Обновить ответ" и впиши финальную версию в поле упражнения»
Пример: «К сожалению, здесь я помогаю только с доработкой ответа на это упражнение. Переформулируй своё сообщение — или нажми "Обновить ответ" и впиши финальную версию в поле упражнения.»`;

  const history = (messages || []).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  if (history.length === 0) {
    history.push({ role: 'user', content: 'Начни диалог — сразу с наблюдения по моему ответу, затем один вопрос. Без вступления.' });
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
