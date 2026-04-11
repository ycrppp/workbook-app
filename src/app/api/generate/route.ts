import { NextRequest, NextResponse } from 'next/server';
import { BOOKS, MODULE_TITLES, EX_LABELS } from '@/lib/books';

// Derived from onboarding: role (Фаундер/CEO, Руководитель отдела, Менеджер проекта, Фрилансер, Другое)
// and size (Только я, 2–5, 6–15, 16–50, 50+)
function detectScenario(role: string, size: string): 'leader' | 'solo' {
  if (role === 'Фрилансер') return 'solo';
  if (size === 'Только я') return 'solo';
  return 'leader';
}

// Per-module guidance specific to each scenario.
// books.ts ПРИМЕНЕНИЕ is written for the leader scenario.
// Solo overrides are injected here so the AI generates the right exercise variant.
function getScenarioBlock(scenario: 'leader' | 'solo', moduleId: string, size: string): string {
  if (scenario === 'solo') {
    const guidance: Record<string, string> = {
      gaps: `СЦЕНАРИЙ — СОЛО/ФРИЛАНСЕР:
Разрывы проявляются между планом пользователя и реальностью клиентов, рынка или подрядчиков — не в команде.
ex1: где его план расходится с реальностью — клиент изменил требования, рынок не ответил, подрядчик сделал не то.
ex2: неправильная реакция которую применяет — больше анализа перед стартом, слишком детальные ТЗ, давление на себя.
ex3: личное поведенческое изменение, конкретный человек не обязателен.`,

      intent: `СЦЕНАРИЙ — СОЛО/ФРИЛАНСЕР:
Замысел формулируется для своего проекта, клиентской работы или договорённости с партнёром — не для команды.
ex1: где берётся за работу без понимания зачем — делает что просит клиент без понимания результата, берёт проект без своего намерения.
ex2: замысел по структуре Бангея для главного текущего проекта или задачи (5 элементов адаптированы к соло — "организация" = проект или клиент).
ex3: использует замысел для одного конкретного решения по проекту на этой неделе — не "поставить задачу", а "принять решение в рамках своего зачем".`,

      cascade: `СЦЕНАРИЙ — СОЛО/ФРИЛАНСЕР:
Каскад — про то как ставит задачи клиентам или подрядчикам, не внутренней команде.
ex1: где говорит клиенту или подрядчику КАК вместо ЗАЧЕМ — отсюда бесконечные согласования, непонимание, переделки.
ex2: переформулировать одно такое ТЗ или запрос в замысел — только ЧТО и ЗАЧЕМ, без КАК.
ex3: одна коммуникация с клиентом или подрядчиком на этой неделе — передаёт замысел вместо детальных инструкций.`,

      independence: `СЦЕНАРИЙ — СОЛО/ФРИЛАНСЕР:
Аудит направлен внутрь — когда сам откладывал решение и шёл за внешним подтверждением.
ex1: случаи когда сам шёл за согласованием к клиенту или партнёру вместо того чтобы действовать — что помешало?
ex2: что именно решит самостоятельно в следующий раз и как проверит что это в рамках договорённостей с клиентом.
ex3: одно конкретное решение которое примет без запроса подтверждения — ситуация и день.`,
    };
    return guidance[moduleId] ? `\n${guidance[moduleId]}\n` : '';
  } else {
    // leader — supplement books.ts with team-size nuance
    const sizeNote = size && size !== 'Только я'
      ? `Размер команды: ${size}. ${size === '2–5' ? 'Личные примеры с конкретными людьми.' : size === '50+' ? 'Системные паттерны, не только личные ситуации.' : ''}`
      : '';
    const guidance: Record<string, string> = {
      gaps: `СЦЕНАРИЙ — РУКОВОДИТЕЛЬ С КОМАНДОЙ: Разрывы между его решениями/планами и тем что делает команда. ${sizeNote}`,
      intent: `СЦЕНАРИЙ — РУКОВОДИТЕЛЬ С КОМАНДОЙ: Замысел для задач команде или для своей зоны ответственности. ${sizeNote}`,
      cascade: `СЦЕНАРИЙ — РУКОВОДИТЕЛЬ С КОМАНДОЙ: Ставит задачи команде, подрядчикам или партнёрам. ${sizeNote}`,
      independence: `СЦЕНАРИЙ — РУКОВОДИТЕЛЬ С КОМАНДОЙ: Люди приходят за решениями вместо самостоятельных действий. ${sizeNote} ex2 — конкретное действие или слова (не декларация "начну доверять").`,
    };
    const note = guidance[moduleId] ? `\n${guidance[moduleId]}\n` : '';
    return note;
  }
}

export async function POST(req: NextRequest) {
  const { context, moduleId, bookId, previousAnswers, dialogReplies, correction, targetEx, currentModuleAnswers } = await req.json();

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

  // Detect user scenario from onboarding data
  const scenario = detectScenario(context.role || '', context.size || '');
  const scenarioBlock = getScenarioBlock(scenario, moduleId, context.size || '');

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

СТРУКТУРА ТРЁХ УПРАЖНЕНИЙ — все три про одно и то же:
- Упражнение 1 (Диагностика): интро уже назвало какой именно аспект модуля объясняет боль пользователя. Задача ex1 — не открывать заново, а углублять: попроси пользователя описать как именно этот аспект проявляется в его конкретной практике — 2-3 примера из реальной работы. Никаких списков «выбери один из трёх» — только его конкретные ситуации.
- Упражнение 2 (Инструмент): примени инструмент модуля к боли пользователя. Результат — конкретный артефакт (текст, список, формулировка) который он может использовать прямо сейчас. Это должно быть что-то реальное — не план создать, а сам текст.
- Упражнение 3 (Следующий шаг): одно конкретное действие на этой неделе — применить то, что пользователь создал в предыдущем упражнении. Требования: (1) максимально маленькое — один момент, одна ситуация, (2) конкретный день, (3) если действие требует другого человека — называй кого конкретно; если это личное поведенческое изменение — называй ситуацию, не обязательно называть человека. В тексте задания называй что именно он создал в предыдущем упражнении (например «замысел который ты написал выше», «реакцию которую ты описал» — никогда не пиши «упражнение 2»).

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

ЗАПРЕТЫ ДЛЯ УПРАЖНЕНИЙ:
- Не инвертируй боль пользователя. Если его боль — что услуга устарела, не делай упражнение «сформулируй оффер этой услуги». Работай с болью, а не против неё.
- Не уходи от концепции модуля — каждое упражнение строго про инструмент этого модуля

ПОЛЕ intro (только для упражнения 1):
- Два предложения. Первое: через какую идею этого модуля мы смотрим на ситуацию пользователя — коротко и ёмко. Второе: где именно эта идея проявляется в его конкретной боли. Не начинай с названия концепции — начинай с живой фразы.
${scenarioBlock}
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
${correction ? `\nУточнение от пользователя: ${correction}` : ''}
${targetInstruction}`;

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
