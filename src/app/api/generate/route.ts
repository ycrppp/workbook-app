import { NextRequest, NextResponse } from 'next/server';
import { BOOKS, MODULE_TITLES, EX_LABELS } from '@/lib/books';

export async function POST(req: NextRequest) {
  const { context, moduleId, bookId, previousAnswers, dialogReplies, correction } = await req.json();

  const book = BOOKS[bookId] || BOOKS.bangey;
  const module = book.modules.find((m) => m.id === moduleId) || book.modules[0];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const prevAnswersText =
    previousAnswers && Object.keys(previousAnswers).length > 0
      ? `\nОтветы пользователя из предыдущих модулей:\n` +
        Object.entries(previousAnswers)
          .filter(([, v]: any) => v && v.trim())
          .map(([k, v]: any) => {
            const [modId, exId] = k.split('_');
            return `[${MODULE_TITLES[modId] || modId} / ${EX_LABELS[exId] || exId}]: ${v}`;
          })
          .join('\n')
      : '';

  const dialogRepliesText =
    dialogReplies && Object.keys(dialogReplies).length > 0
      ? `\nУточнения пользователя:\n` +
        Object.entries(dialogReplies)
          .filter(([, v]: any) => v && v.trim())
          .map(([k, v]: any) => {
            const [modId, exId] = k.split('_');
            return `[${MODULE_TITLES[modId] || modId} / ${EX_LABELS[exId] || exId} — уточнение]: ${v}`;
          })
          .join('\n')
      : '';

  const systemPrompt = `Ты создаёшь упражнения для воркбука по книге «${book.title}» (${book.author}).

МОДУЛЬ: «${module.title}»
ЦИТАТА МОДУЛЯ: «${module.quote}»

СОДЕРЖАНИЕ МОДУЛЯ — используй эти концепции как основу упражнений:
${module.concept}

СКВОЗНАЯ НИТЬ ВОРКБУКА — прочитай это первым:
Пользователь пришёл с конкретной болью (см. поле "Боль" в анкете). Это не контекст — это ПРЕДМЕТ всего воркбука. Каждый модуль — это новый инструмент из книги, приложенный к этой же боли. Каждое упражнение — шаг к её решению. Если боль не заполнена или слишком общая — строй упражнения вокруг самой типичной проблемы для его роли и бизнеса. Никогда не предлагай пользователю "взять любую ситуацию из практики" — всегда работай с его конкретной болью.

ЛОГИКА ЧЕТЫРЁХ МОДУЛЕЙ — один путь, четыре угла:
Все четыре модуля смотрят на одну и ту же боль пользователя через разные линзы книги. Не четыре разные темы — а четыре шага к решению одной проблемы. Каждый следующий модуль углубляет и продолжает предыдущий.

СТРУКТУРА ТРЁХ УПРАЖНЕНИЙ — все три про одно и то же:
- Упражнение 1 (Диагностика): интро уже назвало какой именно аспект модуля объясняет боль пользователя. Задача ex1 — не открывать заново, а углублять: попроси пользователя описать как именно этот аспект проявляется в его конкретной практике — 2-3 примера из реальной работы. Никаких списков «выбери один из трёх» — только его конкретные ситуации.
- Упражнение 2 (Инструмент): примени инструмент модуля к боли пользователя. Результат — конкретный артефакт (текст, список, формулировка) который он может использовать прямо сейчас. Это должно быть что-то реальное — не план создать, а сам текст.
- Упражнение 3 (Следующий шаг): одно конкретное действие на этой неделе — использовать или передать то, что пользователь сформулировал в предыдущем упражнении. Требования: (1) максимально маленькое — один звонок, одно сообщение, одна встреча, (2) с конкретным человеком, (3) в конкретный день. В тексте задания называй что именно он создал в предыдущем упражнении (например «замысел который ты написал выше», «реакцию которую ты описал» — никогда не пиши «упражнение 2»).

ПРЕЕМСТВЕННОСТЬ МЕЖДУ МОДУЛЯМИ (если есть предыдущие ответы):
Читай ответы пользователя из предыдущих модулей как продолжение одного разговора о его боли.

ЖЁСТКИЕ ЗАПРЕТЫ:
- "Как ты думаешь..." — запрещено
- Гипотетические вопросы ("если бы", "представь что") — запрещены
- Вопросы с односложным ответом — запрещены

КАЖДОЕ УПРАЖНЕНИЕ ДОЛЖНО:
- Требовать написать что-то конкретное: список, формулировку, план, текст
- Быть напрямую связано с болью и контекстом пользователя из анкеты

ТРЕБОВАНИЯ К ТЕКСТУ:
- Короткие предложения. Максимум 15 слов.
- Пиши на «ты», живым языком.

СТРУКТУРА КАЖДОГО УПРАЖНЕНИЯ (всё в поле instruction):
1. Одно предложение — какой навык из книги тренирует это упражнение
2. Конкретный сценарий из жизни пользователя (1-2 предложения)
3. Точная инструкция что написать — с форматом ответа

ПОЛЕ intro:
- Одно предложение. Назови какой аспект темы этого модуля напрямую объясняет боль пользователя.

${prevAnswersText ? 'Предыдущие ответы пользователя — учитывай их, углубляй:\n' + prevAnswersText : ''}
${dialogRepliesText ? dialogRepliesText + '\n(Уточнения содержат дополнительный контекст.)' : ''}

Верни строго JSON без markdown, с \\n для переносов строк внутри instruction:
{
  "intro": "...",
  "ex1": {"title": "...", "instruction": "..."},
  "ex2": {"title": "...", "instruction": "..."},
  "ex3": {"title": "...", "instruction": "..."}
}`;

  const userMsg = `Контекст пользователя:
Роль: ${context.role || 'не указана'}
Команда: ${context.size || 'не указан размер'}
Бизнес: ${context.biz || 'не описан'}
Главная боль: ${context.pain || 'не описана'}
${correction ? `\nУточнение от пользователя: ${correction}` : ''}
Создай три упражнения по книге для этого человека.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
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
    return NextResponse.json({ success: true, quote: module.quote, ...parsed });
  } catch (err: any) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
