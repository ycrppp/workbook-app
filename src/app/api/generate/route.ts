import { NextRequest, NextResponse } from 'next/server';
import { BOOKS, MODULE_TITLES, EX_LABELS } from '@/lib/books';
import { detectScenario, getScenarioBlock, getRoleBlock } from '@/lib/scenario';


export async function POST(req: NextRequest) {
  const { context, moduleId, bookId, previousAnswers, previousThreadStates, dialogReplies, correction, targetEx, currentModuleAnswers } = await req.json();

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

  // Thread state from previous modules — what's closed, what's open, what's the artifact.
  // This is the "сквозная нить" — not just answer dump, but synthesized state of the user's path.
  const threadStateText =
    previousThreadStates && Object.keys(previousThreadStates).length > 0
      ? `\nСОСТОЯНИЕ НИТИ (что предыдущие модули уже закрыли из боли пользователя и что осталось открыто — используй чтобы продолжить путь, не повторяться):\n` +
        Object.entries(previousThreadStates)
          .map(([modId, ts]: any) => {
            const lines = [`[${MODULE_TITLES[modId] || modId}]`];
            if (ts?.closed) lines.push(`  закрыто: ${ts.closed}`);
            if (ts?.open) lines.push(`  открыто: ${ts.open}`);
            if (ts?.artifact) lines.push(`  артефакт: ${ts.artifact}`);
            return lines.join('\n');
          })
          .join('\n')
      : '';

  // Pain layers — if user filled them in onboarding, use the deeper structure
  const painLayersText = (() => {
    const parts: string[] = [];
    if (context?.painSymptom) parts.push(`Симптом боли (как проявляется в поведении): ${context.painSymptom}`);
    if (context?.painHistory) parts.push(`История (когда началось, как давно): ${context.painHistory}`);
    if (context?.painTried) parts.push(`Что уже пробовал — и что не сработало: ${context.painTried}`);
    if (context?.painStakes) parts.push(`Ставка (что произойдёт если не решить): ${context.painStakes}`);
    return parts.length > 0 ? `\nГЛУБОКИЕ СЛОИ БОЛИ — учитывай их в упражнениях:\n${parts.join('\n')}\n` : '';
  })();

  // Detect user scenario from onboarding data
  const scenario = detectScenario(context.role || '', context.size || '');
  const scenarioBlock = getScenarioBlock(scenario, moduleId);
  const roleBlock = getRoleBlock(context.role || '', scenario);

  // Build context from within-module answers for adaptive generation
  let currentModuleAnswersText = '';
  if (targetEx === 'ex2' && currentModuleAnswers?.ex1) {
    currentModuleAnswersText = `\nОТВЕТ ПОЛЬЗОВАТЕЛЯ НА УПРАЖНЕНИЕ 1 ЭТОГО МОДУЛЯ:\n${currentModuleAnswers.ex1}\n`;
  } else if (targetEx === 'ex3') {
    const parts: string[] = [];
    if (currentModuleAnswers?.ex1) parts.push(`Упражнение 1: ${currentModuleAnswers.ex1}`);
    if (currentModuleAnswers?.ex2) parts.push(`Упражнение 2: ${currentModuleAnswers.ex2}`);
    if (parts.length > 0) currentModuleAnswersText = `\nОТВЕТЫ ПОЛЬЗОВАТЕЛЯ НА ПРЕДЫДУЩИЕ УПРАЖНЕНИЯ ЭТОГО МОДУЛЯ:\n${parts.join('\n')}\n`;
  }

  // What to generate and expected format
  const targetInstruction =
    targetEx === 'ex2'
      ? `Создай ТОЛЬКО упражнение 2 (Инструмент). Оно должно напрямую продолжать то что пользователь написал в упражнении 1 — не общий инструмент, а применение именно к его конкретной ситуации. Используй детали из его ответа.`
      : targetEx === 'ex3'
      ? `Создай ТОЛЬКО упражнение 3 (Следующий шаг). Оно должно быть конкретным действием основанным именно на том что пользователь создал в упражнении 2. Называй конкретный результат который он получил — формулировку, список, артефакт.`
      : `Создай intro и упражнение 1 (Диагностика).`;

  const targetFormat =
    targetEx === 'ex2'
      ? `{"ex2": {"title": "...", "instruction": "..."}}`
      : targetEx === 'ex3'
      ? `{"ex3": {"title": "...", "instruction": "..."}}`
      : `{"intro": "...", "ex1": {"title": "...", "instruction": "..."}}`;

  const systemPrompt = `Ты создаёшь упражнения для воркбука по книге «${book.title}» (${book.author}).

МОДУЛЬ: «${module.title}»
ЦИТАТА МОДУЛЯ: «${module.quote}»

СОДЕРЖАНИЕ МОДУЛЯ — используй эти концепции как основу упражнений:
${module.concept}

СКВОЗНАЯ НИТЬ ВОРКБУКА — прочитай это первым:
Пользователь пришёл с конкретной болью (см. поле "Боль" в анкете). Это не контекст — это ПРЕДМЕТ всего воркбука. Каждый модуль — это новый инструмент из книги, приложенный к этой же боли. Каждое упражнение — шаг к её решению. Если боль не заполнена или слишком общая — строй упражнения вокруг самой типичной проблемы для его роли и бизнеса. Никогда не предлагай пользователю "взять любую ситуацию из практики" — всегда работай с его конкретной болью.

ЛОГИКА ЧЕТЫРЁХ МОДУЛЕЙ — один путь, четыре угла:
Все четыре модуля смотрят на одну и ту же боль пользователя через разные линзы книги. Не четыре разные темы — а четыре шага к решению одной проблемы. Каждый следующий модуль углубляет и продолжает предыдущий.

СТРУКТУРА ТРЁХ УПРАЖНЕНИЙ:
- Упражнение 1 (Диагностика): пользователь сам ставит диагноз — не подтверждает твой. Интро даёт оптику модуля, но не называет готовый диагноз. В ex1 — один самый острый аспект модуля в его ситуации, с 2-3 конкретными примерами из реальной работы. Не каталог всех аспектов — только самый живой для него.
- Упражнение 2 (Инструмент): напрямую опирается на то, что пользователь написал в ex1. Результат — один конкретный артефакт (текст, список, формулировка), который он может использовать прямо сейчас. Начни instruction с прямой отсылки к его диагнозу из ex1.
- Упражнение 3 (Следующий шаг): одно действие до конца недели, применяющее артефакт из ex2. Называй конкретно что именно он создал (не «упражнение 2», а «формулировку которую ты написал», «список реакций выше»). Максимально маленькое — один момент, один человек или одна ситуация.

ПРЕЕМСТВЕННОСТЬ МЕЖДУ МОДУЛЯМИ — это критически важно:
Если есть СОСТОЯНИЕ НИТИ от предыдущих модулей — это твоя главная опора. Читай поле "открыто" — именно эти аспекты боли нужно подхватить в этом модуле. Поле "артефакт" — то конкретное, что пользователь уже создал; ссылайся на него, а не начинай с нуля. Поле "закрыто" — не повторяй то что уже разобрано.
Если состояния нити нет (это первый модуль или предыдущие не завершены) — работай напрямую с болью пользователя.
Не относись к ответам предыдущих модулей как к фоновому контексту. Это активная нить — ты её продолжаешь.

ЕСЛИ ЕСТЬ ГЛУБОКИЕ СЛОИ БОЛИ (симптом / история / попытки / ставка):
- "Что уже пробовал" — НИКОГДА не предлагай в упражнениях это же. Если пользователь уже пробовал больше контроля и не сработало — твоё упражнение не должно вести его обратно к контролю.
- "Ставка" — даёт срочность; упражнение 3 (Следующий шаг) должно быть реалистичным с учётом этой ставки.
- "Симптом vs причина" — пользователь обычно описывает симптом; упражнения должны помогать копать глубже к причине, а не оставаться на поверхности.

ЖЁСТКИЕ ЗАПРЕТЫ:
- "Как ты думаешь..." — запрещено
- Гипотетические вопросы ("если бы", "представь что") — запрещены
- Задания на которые можно ответить одним словом или одной строкой — запрещены
- Задания "перечисли три..." без требования к глубине каждого пункта — запрещены
- Примеры ответов в тексте инструкции ("например: X", "например: Y") — запрещены. Пользователь формулирует сам, без подсказок.

КАЖДОЕ УПРАЖНЕНИЕ ДОЛЖНО:
- Требовать написать развёрнутый текст: формулировку, описание, конкретный сценарий с деталями
- Быть напрямую связано с болью и контекстом пользователя из анкеты

ТРЕБОВАНИЯ К ТЕКСТУ:
- Пиши на «ты», живым языком.
- Короткие предложения. Максимум 15 слов.
- Instruction: максимум 60 слов. Один-два абзаца. Никаких нумерованных списков внутри instruction.
- Никакого markdown: ни **, ни *, ни ---, ни #. Чистый текст.
- Ответ пользователя должен требовать развёрнутого письма: не «назови», «перечисли» — а «опиши», «сформулируй», «напиши текст».

ФОРМАТ КАЖДОГО УПРАЖНЕНИЯ (всё в поле instruction):
Один абзац: чем конкретно это упражнение про его ситуацию (1-2 предложения). Затем: точно что написать — с форматом ответа (1-2 предложения).

ЗАПРЕТЫ ДЛЯ УПРАЖНЕНИЙ:
- Не инвертируй боль пользователя. Если его боль — что услуга устарела, не делай упражнение «сформулируй оффер этой услуги». Работай с болью, а не против неё.
- Не уходи от концепции модуля — каждое упражнение строго про инструмент этого модуля

ПОЛЕ intro (только для упражнения 1):
- Два коротких предложения. Первое: оптика этого модуля применительно к его ситуации — живо, без терминов. Второе: намёк что диагноз — его задача, не моя. Без готового диагноза. Без названия концепции в первом слове.
${scenarioBlock}${roleBlock}${painLayersText}${threadStateText}
${prevAnswersText ? 'Предыдущие ответы пользователя — учитывай их, углубляй:\n' + prevAnswersText : ''}
${dialogRepliesText ? dialogRepliesText + '\n(Уточнения содержат дополнительный контекст.)' : ''}
${currentModuleAnswersText}
${targetInstruction}

Верни строго JSON без markdown, с \\n для переносов строк внутри instruction:
${targetFormat}`;

  const userMsg = `Контекст пользователя:
Роль: ${context.role || 'не указана'}
Команда: ${context.size || 'не указан размер'}
Бизнес: ${context.biz || 'не описан'}
Главная боль: ${context.pain || 'не описана'}
${correction ? `\nУточнение от пользователя: ${correction}` : ''}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
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
