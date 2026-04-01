import { NextRequest, NextResponse } from 'next/server';
import { MODULE_TITLES } from '@/lib/books';

const EX_LABELS: Record<string, string> = {
  ex1: 'Диагностика',
  ex2: 'Инструмент',
  ex3: 'Следующий шаг',
};

export async function POST(req: NextRequest) {
  const { context, moduleId, exId, instruction, userAnswer, messages } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const systemPrompt = `Ты — куратор воркбука по книге «Искусство действия» Стивена Бангея. Ты ведёшь короткий диалог с пользователем, чтобы помочь ему глубже разобраться с конкретным упражнением.

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

ПРАВИЛА:
- Ответ максимум 2-3 предложения. Коротко.
- Задавай уточняющие вопросы или помогай конкретизировать.
- СТРОГО в рамках этого упражнения.
- Пиши на «ты». Живо, без официоза.`;

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
