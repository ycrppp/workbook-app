require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ type: ['application/json', 'text/plain'] })); // text/plain for sendBeacon
app.use(express.static(path.join(__dirname, 'public')));

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDb() {
  if (!pool) { console.log('[db] DATABASE_URL not set, skipping DB init'); return; }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        first_name  TEXT,
        last_name   TEXT,
        username    TEXT,
        photo_url   TEXT,
        projects    JSONB NOT NULL DEFAULT '{"projects":[],"currentProjectId":null}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Добавляем login_count если ещё нет (безопасно для существующей БД)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0
    `);
    console.log('[db] table ready');
  } catch (e) {
    console.error('[db] init error:', e.message);
  }
}
initDb();

// ─── BOOK KNOWLEDGE BASE ─────────────────────────────────────────────────────
const BOOKS = {
  bangey: {
    title: 'Искусство действия',
    author: 'Стивен Бангей',
    modules: [
      {
        id: 'gaps',
        title: 'Три разрыва',
        quote: 'У многих есть прекрасные стратегии, но войска не маршируют в ногу.',
        concept: `Бангей утверждает: между стратегией и результатом всегда есть три разрыва. Это не исключение — это норма. Проблема не в людях и не в плане, а в том, что руководители реагируют на разрывы неправильными инструментами — и усугубляют их.

РАЗРЫВ В ЗНАНИЯХ (knowledge gap): Реальность всегда сложнее, чем кажется сверху. Типичная реакция — собрать больше данных, провести ещё один анализ, дождаться полной картины. Бангей называет это ловушкой: полной картины не будет никогда. Правильная реакция — принять неопределённость и действовать с тем, что есть.

РАЗРЫВ В СОГЛАСОВАННОСТИ (alignment gap): Люди делают не то, что хочет руководитель. Типичная реакция — написать подробные инструкции, добавить процессы, усилить контроль. Бангей: инструкции устаревают раньше, чем их выполнят. Они описывают мир, которого уже нет. Правильная реакция — передавать намерение, а не задачи.

РАЗРЫВ В РЕЗУЛЬТАТАХ (effects gap): Действия не дают ожидаемого эффекта. Типичная реакция — больше давления, KPI, мотивация. Бангей: люди стараются изо всех сил, но в неправильном направлении, потому что не понимают замысла. Правильная реакция — закрыть разрыв в знаниях и согласованности, тогда результаты появятся сами.

КЛЮЧЕВАЯ ИДЕЯ: Три стандартных реакции (больше данных, больше инструкций, больше давления) создают "трение" — они не закрывают разрывы, а создают новые. Бангей берёт эту идею из военной доктрины Мольтке: чем детальнее план, тем быстрее он разваливается при контакте с реальностью.

ИНСТРУМЕНТ ДИАГНОСТИКИ: Для каждого из трёх разрывов пользователь определяет (1) как именно разрыв проявляется в его конкретной ситуации и (2) какую неправильную реакцию он использует прямо сейчас. Это не абстрактный анализ — это личный диагноз его текущей реальности.

АДАПТАЦИЯ ПОД КОНТЕКСТ: Если пользователь — руководитель с командой: разрывы проявляются между его решениями и тем что делает команда. Если соло-предприниматель или фрилансер: разрывы между его планом и реальностью клиентов, рынка, подрядчиков. Если наёмный менеджер: разрывы между тем что требует руководство и тем что реально происходит. Упражнения адаптируй к его роли и размеру команды — не используй примеры про "войска" и большие корпорации если контекст другой.

Упражнения этого модуля: (1) пользователь видит какой из трёх разрывов главный именно у него, (2) называет конкретную неправильную реакцию которую использует, (3) формулирует что происходит когда он её применяет — какое трение создаётся.`,
      },
      {
        id: 'intent',
        title: 'Направленный оппортунизм',
        quote: 'Стратегия — это не жёсткий план, а развитие центральной идеи в меняющихся условиях.',
        concept: `Бангей вводит понятие "directed opportunism" — направленный оппортунизм. Это не хаос и не жёсткий план. Это третий путь: у каждого есть ясное понимание замысла (зачем и чего достичь) — и свобода выбирать способ действий под текущую ситуацию.

ЧТО ТАКОЕ ЗАМЫСЕЛ (intent): Замысел — это не задача ("сделай X"), а намерение ("добейся Y, потому что нам нужно Z"). Он отвечает на вопросы: что мы хотим достичь? почему это важно? как это вписывается в цели уровня выше? Замысел остаётся стабильным, когда меняются обстоятельства.

ПОЧЕМУ ИНСТРУКЦИИ НЕ РАБОТАЮТ: Инструкция описывает конкретные шаги в конкретных условиях. Как только условия меняются — инструкция устаревает. Человек с инструкцией в изменившейся ситуации либо делает по инструкции (неверно), либо стоит и ждёт новой (паралич). Человек с замыслом — адаптируется сам.

СТРУКТУРА ЗАМЫСЛА ПО БАНГЕЮ: (1) Высший замысел — зачем это вообще нужно организации или проекту. (2) Собственная задача — что конкретно нужно сделать мне. (3) Ключевые задачи — главные действия для её выполнения. (4) Ограничения — чего делать нельзя. (5) Свобода действий — в каких рамках я могу принимать решения сам.

КЛЮЧЕВАЯ ИДЕЯ: Чем понятнее замысел — тем меньше нужен контроль. Люди принимают правильные решения не потому что им сказали что делать, а потому что понимают зачем.

ИНСТРУМЕНТ ЭТОГО МОДУЛЯ: пользователь берёт реальную текущую задачу и записывает для неё замысел по структуре Бангея. Не описывает замысел в общем — составляет его прямо сейчас для конкретной ситуации из своей жизни.

АДАПТАЦИЯ ПОД КОНТЕКСТ: Если пользователь — руководитель: замысел для задачи которую он ставит команде. Если соло/фрилансер: замысел для своего проекта или договорённости с клиентом — те же 5 элементов работают. Если наёмный менеджер: замысел для своей зоны ответственности в рамках целей компании. Пункты структуры адаптируй к его реальности — "организация" может быть проектом, командой из двух человек или договором с заказчиком.

ФОКУС УПРАЖНЕНИЙ: формулировка замысла — как его записать, чем он отличается от задачи, есть ли он вообще. НЕ про передачу вниз по иерархии (это модуль 3). НЕ про культуру доверия (это модуль 4).`,
      },
      {
        id: 'cascade',
        title: 'Каскад целей',
        quote: 'Лидеры должны определять "Что" и "Зачем", а подчинённые — "Как". Если вы говорите людям, как именно выполнять работу, вы лишаете их возможности адаптироваться к трению.',
        concept: `Бангей показывает, как замысел передаётся вниз по организации — через каскад. Каждый уровень получает не инструкцию, а контекст. И сам формулирует свой замысел для следующего уровня.

КЛЮЧЕВОЕ РАЗДЕЛЕНИЕ: Лидер отвечает за ЧТО и ЗАЧЕМ. Исполнитель сам решает КАК. Когда руководитель говорит КАК — он забирает у человека возможность адаптироваться. При первом отклонении от плана тот остановится и будет ждать инструкций вместо того чтобы решить самостоятельно.

КАК РАБОТАЕТ КАСКАД: Руководитель передаёт: (1) Ситуацию — почему это важно прямо сейчас. (2) Общий замысел — чего хотим достичь и зачем. (3) Конкретную задачу — роль этого человека в замысле. (4) Ресурсы — что есть. (5) Ограничения — чего нельзя. Всё остальное — решение исполнителя.

ТЕСТ BRIEFING BACK: Попроси человека пересказать своими словами что он будет делать и зачем. Не "повтори" — а "объясни мне". Если не может объяснить зачем — передана задача, не замысел. При первом отклонении он остановится и будет ждать.

ОШИБКА УРОВНЕЙ: Менеджер получает замысел, но вниз передаёт только задачи. Цепочка рвётся. Люди знают "что" но не знают "зачем" — и не могут адаптироваться когда ситуация меняется.

ИНСТРУМЕНТЫ ЭТОГО МОДУЛЯ: (1) Пользователь находит где сам говорит КАК вместо ЗАЧЕМ — конкретный список из своей практики. (2) Переформулирует одну такую задачу в замысел — только ЧТО и ЗАЧЕМ. (3) Определяет 3 решения которые обычно принимал сам, но теперь готов передать команде — с формулировкой замысла для каждого.

АДАПТАЦИЯ ПОД КОНТЕКСТ: Если у пользователя нет подчинённых: каскад работает с подрядчиками, партнёрами, коллегами — везде где он ставит задачи другим людям. Если он сам исполнитель: упражнение разворачивается — он смотрит получает ли сам замысел или только инструкции от своего руководителя. Briefing back адаптируй к его реальным отношениям — команда, подрядчик, клиент, партнёр.

ФОКУС: передача замысла и разделение ЧТО/ЗАЧЕМ vs КАК. НЕ про то что такое замысел (модуль 2). НЕ про культуру доверия (модуль 4).`,
      },
      {
        id: 'independence',
        title: 'Независимое мышление',
        quote: 'Верх доверия — не наказывать за нарушение распоряжений, если это помогло реализовать замысел.',
        concept: `Последний модуль книги — о культуре. Замысел и каскад работают только если люди готовы действовать самостоятельно. А это требует двух вещей: доверия снизу вверх (я могу принять решение без согласования) и доверия сверху вниз (мне позволят это сделать).

ПОДЧИНЕНИЕ ЧЕРЕЗ НЕЗАВИСИМОЕ МЫШЛЕНИЕ: Бангей вводит парадоксальное понятие — "obedient autonomy". Исполнитель следует не букве приказа, а его духу. Когда ситуация меняется — не ждёт новых инструкций, а спрашивает себя: "Что хотел бы мой руководитель, если бы видел то, что вижу я?" И действует исходя из замысла.

КУЛЬТУРА ИНИЦИАТИВЫ: Это невозможно построить декларацией. Люди начнут действовать самостоятельно только когда убедятся: инициатива в рамках замысла не наказывается, даже если привела к ошибке. Бангей описывает прусскую военную культуру, где офицер, нарушивший приказ ради замысла, мог быть повышен — а не разжалован.

ТИПИЧНАЯ ЛОВУШКА: Руководитель говорит "действуй самостоятельно", но при первой ошибке — наказывает. Или требует согласования на каждый шаг. Люди быстро учатся: самостоятельность опасна, лучше ждать инструкций. Разрыв в согласованности возвращается.

КЛЮЧЕВАЯ ИДЕЯ: Независимое мышление — это не черта характера, а результат того, что человек понимает замысел достаточно хорошо, чтобы принимать решения без руководителя. И живёт в культуре, где это безопасно.

ИНСТРУМЕНТ ЭТОГО МОДУЛЯ — поведенческий аудит: пользователь вспоминает 3 конкретных недавних случая когда подчинённый (или он сам) пришёл за решением вместо того чтобы принять его самостоятельно. Для каждого случая анализирует: был ли передан замысел? Что именно помешало действовать без согласования — отсутствие замысла или страх последствий? Это переводит абстрактное "доверие" в конкретные ситуации из его практики.

АДАПТАЦИЯ ПОД КОНТЕКСТ: Если пользователь — руководитель: аудит направлен на его команду — где люди приходят за решениями вместо того чтобы действовать. Если он сам исполнитель или соло: аудит разворачивается — он смотрит на себя, когда сам шёл за согласованием вместо того чтобы действовать в рамках замысла. Если работает с подрядчиками: те же вопросы про отношения с ними. Никогда не используй примеры про "войска" и армию — переводи в реальность его бизнеса или роли.`,
      },
    ],
  },
};

// ─── AUTH TOKENS ──────────────────────────────────────────────────────────────
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 дней

function signToken(telegram_id) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  const payload = Buffer.from(JSON.stringify({ tid: telegram_id, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const eBuf = Buffer.from(expected);
  const sBuf = Buffer.from(sig);
  if (eBuf.length !== sBuf.length) return null;
  if (!crypto.timingSafeEqual(eBuf, sBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() - data.iat > TOKEN_TTL) return null;
    return data;
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  let token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && req.body?.auth_token) token = req.body.auth_token; // sendBeacon fallback
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Unauthorized' });
  req.telegram_id = data.tid;
  next();
}

// ─── DEV AUTH (только при DEV_MODE=true) ─────────────────────────────────────
if (process.env.DEV_MODE === 'true') {
  app.post('/api/dev-auth', (req, res) => {
    try {
      const token = signToken(req.body?.telegram_id || 1);
      res.json({ token });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  console.log('[dev] /api/dev-auth enabled');
}

// ─── API KEY (для вызова с клиента) ───────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
});

// ─── GENERATE EXERCISES ───────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { context, moduleId, bookId, previousAnswers, correction } = req.body;

  const book = BOOKS[bookId] || BOOKS.bangey;
  const module = book.modules.find(m => m.id === moduleId) || book.modules[0];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log(`[generate] moduleId=${moduleId}, apiKey=${apiKey ? 'OK (' + apiKey.slice(0,15) + '...)' : 'MISSING'}`);
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const MODULE_TITLES = { gaps: 'Три разрыва', intent: 'Направленный оппортунизм', cascade: 'Каскад целей', independence: 'Независимое мышление' };
  const EX_LABELS = { ex1: 'Диагностика', ex2: 'Инструмент', ex3: 'Следующий шаг (запланированное действие)' };
  const prevAnswersText = previousAnswers && Object.keys(previousAnswers).length > 0
    ? `\nОтветы пользователя из предыдущих модулей:\n` +
      Object.entries(previousAnswers)
        .filter(([,v]) => v && v.trim())
        .map(([k, v]) => {
          const [modId, exId] = k.split('_');
          return `[${MODULE_TITLES[modId] || modId} / ${EX_LABELS[exId] || exId}]: ${v}`;
        }).join('\n')
    : '';

  const systemPrompt = `Ты создаёшь упражнения для воркбука по книге «${book.title}» (${book.author}).

МОДУЛЬ: «${module.title}»
ЦИТАТА МОДУЛЯ: «${module.quote}»

СОДЕРЖАНИЕ МОДУЛЯ — используй эти концепции как основу упражнений:
${module.concept}

ГЛАВНАЯ ЦЕЛЬ ВОРКБУКА: помочь человеку решить его реальную бизнес-проблему. Книга — это линза, через которую он смотрит на свою ситуацию, а не теория для изучения. Упражнения должны вести его к собственным решениям — мы не предлагаем ответы, мы создаём структуру в которой он сам их находит. По итогу каждого модуля у пользователя должен быть конкретный результат: действие, решение или элемент плана — применимый к его бизнесу прямо сейчас.

ПРИНЦИП ПЕРСОНАЛИЗАЦИИ: все три упражнения строятся вокруг конкретной боли и контекста пользователя из анкеты. Не абстрактный навык из книги — а инструмент книги, приложенный к его реальной проблеме. Пользователь должен узнавать свою ситуацию в каждом упражнении.

УНИКАЛЬНОСТЬ МОДУЛЯ: упражнения строго про тему этого модуля — не про результаты бизнеса в общем, не про клиентов, не про команду абстрактно. Если пользователь уже проходил предыдущие модули — не повторяй их темы. Каждый модуль должен давать принципиально новый угол зрения на ту же проблему.

ПРЕЕМСТВЕННОСТЬ (только если есть предыдущие ответы):
- ex1 и ex2: используй предыдущие ответы как контекст — углубляй начатое, не повторяй пройденное.
- ex3: посмотри на "Следующий шаг" из предыдущего модуля. Если то действие которое пользователь планировал логически связано с инструментом текущего модуля — строй ex3 на нём явно. Например: в модуле 1 пользователь собирался остановить поток микрозадач → в модуле 2 ex3: "Возьми то действие и запиши для него замысел по структуре Бангея". Если реальной связи нет — не упоминай предыдущий модуль.

СТРУКТУРА ТРЁХ УПРАЖНЕНИЙ:
- ex1: диагностика — пользователь письменно формулирует, как именно проблема из книги проявляется в его конкретном бизнесе и боли. Не "подумай", а "напиши список / перечисли / сформулируй". Результат — он видит свою ситуацию через концепцию книги.
- ex2: инструмент — пользователь применяет конкретный инструмент из книги к своей реальной проблеме прямо сейчас. Результат — конкретный текст, решение или формулировка которую можно использовать. Не упражнение ради упражнения — а реальный рабочий артефакт.
- ex3: следующий шаг — пользователь формулирует конкретное действие или решение которое сделает после этого модуля. Опирается на то что сделал в ex1 и ex2. Результат — он уходит с планом, а не просто с пониманием.

ЖЁСТКИЕ ЗАПРЕТЫ — эти форматы недопустимы:
- "Как ты думаешь..." — запрещено
- "Что бы ты сделал если бы..." — запрещено
- Гипотетические вопросы ("если бы", "представь что") — запрещены
- Вопросы на оценку прошлого ("почему", "что пошло не так") — запрещены
- Вопросы с односложным ответом — запрещены
- Любая рефлексия без конкретного письменного действия — запрещена
- Упражнения ради отработки навыка без связи с реальной проблемой пользователя — запрещены

КАЖДОЕ УПРАЖНЕНИЕ ДОЛЖНО:
- Требовать написать что-то конкретное: список, формулировку, план, текст
- Иметь чёткий критерий выполнения (минимум 3 пункта / 2-3 предложения / конкретная структура)
- Быть напрямую связано с болью и контекстом пользователя из анкеты
- Давать осязаемый результат — что-то что он может использовать за пределами воркбука

ТРЕБОВАНИЯ К ТЕКСТУ:
- Короткие предложения. Максимум 15 слов. Одна мысль — одно предложение.
- Используй только то, что пользователь написал сам. Не придумывай детали — никаких дат, цифр, названий, платформ, которых нет в его описании. Если чего-то не знаешь — используй обобщение.
- Используй термины из книги: называй вещи так, как называет их Бангей.
- Пиши на «ты», живым языком. Проверяй грамматику и орфографию — особенно глагольные формы.

КОНТЕКСТ: пользователь работает в цифровом воркбуке — он пишет ответы прямо в поле под каждым упражнением. Никаких "возьми лист бумаги", "запиши в блокнот" — он уже здесь.

СТРУКТУРА КАЖДОГО УПРАЖНЕНИЯ (всё в поле instruction):
1. Одно предложение — какой навык из книги тренирует это упражнение
2. Конкретный сценарий из жизни пользователя (1-2 предложения)
3. Точная инструкция что написать — с форматом ответа (например: "Напиши 3 пункта в формате: [ситуация] → [разрыв] → [что нужно]"). Инструкция заканчивается заданием, не вопросом на размышление.

ПОЛЕ intro:
- Одно предложение. Назови, какой из разрывов/проблем книги главный в его ситуации — и как именно он проявляется у него конкретно.
- Используй термин из книги. Не обобщай.

${prevAnswersText ? 'Предыдущие ответы пользователя — учитывай их, углубляй:\n' + prevAnswersText : ''}

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
${correction ? `\nУточнение от пользователя (учти это — предыдущая версия упражнений была неверной): ${correction}` : ''}
Создай три упражнения по книге для этого человека.`;

  try {
    console.log(`[generate] → calling Anthropic API...`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    clearTimeout(timeout);
    console.log(`[generate] ← Anthropic status: ${response.status}`);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.json({ success: true, quote: module.quote, ...parsed });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CONTEXT CHECK ────────────────────────────────────────────────────────────
app.post('/api/context-check', async (req, res) => {
  const { context } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
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
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CHECK SUBSCRIPTION ───────────────────────────────────────────────────────
app.post('/api/check-subscription', async (req, res) => {
  const { telegramUser } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL;

  if (!botToken || !channel) {
    return res.status(500).json({ error: 'Telegram not configured' });
  }

  console.log(`[subscription] received user_id=${telegramUser?.id} hash=${telegramUser?.hash?.slice(0,8)}...`);

  // Верификация подписи от Telegram Login Widget
  const { hash, ...fields } = telegramUser;
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n');
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (expectedHash !== hash) {
    console.log(`[subscription] hash mismatch — expected=${expectedHash.slice(0,8)} got=${hash?.slice(0,8)}`);
    return res.status(403).json({ error: 'Invalid Telegram auth data' });
  }

  // Проверяем, не устарели ли данные (>24 часов)
  if (Date.now() / 1000 - fields.auth_date > 86400) {
    console.log(`[subscription] auth_date expired`);
    return res.status(403).json({ error: 'Auth data expired' });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${telegramUser.id}`
    );
    const data = await response.json();
    const status = data.result?.status;
    console.log(`[subscription] user_id=${telegramUser.id} status=${status} ok=${data.ok} desc=${data.description || ''}`);
    const subscribed = ['creator', 'administrator', 'member', 'restricted'].includes(status);
    res.json({ subscribed, status: status || 'unknown' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AUTH (верификация Telegram + подписка + выдача токена) ───────────────────
app.post('/api/auth', async (req, res) => {
  const { telegramUser } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channel  = process.env.TELEGRAM_CHANNEL;

  if (!botToken || !channel) return res.status(500).json({ error: 'Telegram not configured' });
  if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'JWT_SECRET not configured' });

  // Верификация подписи от Telegram
  const { hash, ...fields } = telegramUser;
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n');
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (expectedHash !== hash) {
    console.log(`[auth] hash mismatch`);
    return res.status(403).json({ error: 'Invalid Telegram auth data' });
  }
  if (Date.now() / 1000 - fields.auth_date > 86400) {
    return res.status(403).json({ error: 'Auth data expired' });
  }

  try {
    // Проверяем подписку на канал
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${telegramUser.id}`
    );
    const data = await response.json();
    const status = data.result?.status;
    console.log(`[auth] user_id=${telegramUser.id} status=${status}`);
    const subscribed = ['creator', 'administrator', 'member', 'restricted'].includes(status);

    if (!subscribed) return res.json({ subscribed: false });

    // Выдаём подписанный токен
    const token = signToken(telegramUser.id);
    res.json({ subscribed: true, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USER LOAD (после auth — грузим данные из БД) ─────────────────────────────
app.post('/api/user/load', requireAuth, async (req, res) => {
  if (!pool) return res.json({ projects: { projects: [], currentProjectId: null } });
  const telegram_id = req.telegram_id; // берём из токена, не из тела
  try {
    const result = await pool.query(
      `UPDATE users SET login_count = login_count + 1 WHERE telegram_id = $1
       RETURNING projects, login_count`,
      [telegram_id]
    );
    if (result.rows.length === 0) {
      res.json({ projects: { projects: [], currentProjectId: null }, isNew: true });
    } else {
      res.json({ projects: result.rows[0].projects });
    }
  } catch (e) {
    console.error('[db] load error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── USER SYNC (сохраняем воркбуки в БД) ─────────────────────────────────────
app.post('/api/user/sync', requireAuth, async (req, res) => {
  if (!pool) return res.json({ success: true });
  const telegram_id = req.telegram_id; // берём из токена, не из тела
  const { first_name, last_name, username, photo_url, projects } = req.body;
  try {
    await pool.query(`
      INSERT INTO users (telegram_id, first_name, last_name, username, photo_url, projects, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (telegram_id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name,
        username   = EXCLUDED.username,
        photo_url  = EXCLUDED.photo_url,
        projects   = EXCLUDED.projects,
        updated_at = NOW()
    `, [telegram_id, first_name || '', last_name || '', username || '', photo_url || '', JSON.stringify(projects)]);
    res.json({ success: true });
  } catch (e) {
    console.error('[db] sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── BACKUP ENDPOINT ──────────────────────────────────────────────────────────
app.get('/api/admin/backup', async (req, res) => {
  const secret = process.env.BACKUP_SECRET;
  if (!secret || req.headers['x-backup-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!pool) return res.status(503).json({ error: 'No database' });
  try {
    const result = await pool.query(
      'SELECT telegram_id, first_name, last_name, username, projects, created_at, updated_at FROM users'
    );
    res.setHeader('Content-Disposition', `attachment; filename="backup_${Date.now()}.json"`);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ADMIN STATS ──────────────────────────────────────────────────────────────
app.get('/api/admin/stats', async (req, res) => {
  const secret = process.env.BACKUP_SECRET;
  if (!secret || req.headers['x-backup-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!pool) return res.status(503).json({ error: 'No database' });
  try {
    // Опциональный диапазон дат из query params (YYYY-MM-DD)
    const from = req.query.from ? new Date(req.query.from) : null;
    const to   = req.query.to   ? new Date(req.query.to + 'T23:59:59Z') : null;

    // Условие WHERE для диапазона
    const rangeWhere = from && to
      ? `AND created_at BETWEEN $1 AND $2`
      : from ? `AND created_at >= $1`
      : to   ? `AND created_at <= $1`
      : '';
    const rangeParams = from && to ? [from, to] : from ? [from] : to ? [to] : [];

    const [byDay, byWeek, byMonth, avgModules, avgProjects, total, inRange, avgLogins] = await Promise.all([
      // По дням
      pool.query(
        `SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS label, COUNT(*)::int AS count
         FROM users WHERE 1=1 ${rangeWhere} GROUP BY label ORDER BY label`,
        rangeParams
      ),
      // По неделям
      pool.query(
        `SELECT TO_CHAR(DATE_TRUNC('week', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS label, COUNT(*)::int AS count
         FROM users WHERE 1=1 ${rangeWhere} GROUP BY label ORDER BY label`,
        rangeParams
      ),
      // По месяцам
      pool.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS label, COUNT(*)::int AS count
         FROM users WHERE 1=1 ${rangeWhere} GROUP BY label ORDER BY label`,
        rangeParams
      ),
      // Среднее модулей (по всем пользователям, без фильтра периода)
      pool.query(`
        SELECT ROUND(AVG(modules_count)::numeric, 1)::float AS avg
        FROM (
          SELECT telegram_id,
            COALESCE(SUM(COALESCE(jsonb_array_length(p->'completedModules'), 0)), 0) AS modules_count
          FROM users, jsonb_array_elements(projects->'projects') p
          GROUP BY telegram_id
        ) t
      `),
      // Среднее воркбуков (по всем пользователям)
      pool.query(`
        SELECT ROUND(AVG(jsonb_array_length(projects->'projects'))::numeric, 1)::float AS avg
        FROM users WHERE jsonb_array_length(projects->'projects') > 0
      `),
      // Всего пользователей (всего)
      pool.query(`SELECT COUNT(*)::int AS count FROM users`),
      // Пользователей за выбранный период
      pool.query(
        `SELECT COUNT(*)::int AS count FROM users WHERE 1=1 ${rangeWhere}`,
        rangeParams
      ),
      // Среднее кол-во заходов на пользователя
      pool.query(`
        SELECT ROUND(AVG(login_count)::numeric, 1)::float AS avg FROM users WHERE login_count > 0
      `),
    ]);

    res.json({
      total:       total.rows[0].count,
      inRange:     inRange.rows[0].count,
      byDay:       byDay.rows,
      byWeek:      byWeek.rows,
      byMonth:     byMonth.rows,
      avgModules:  avgModules.rows[0].avg  ?? 0,
      avgProjects: avgProjects.rows[0].avg ?? 0,
      avgLogins:   avgLogins.rows[0].avg   ?? 0,
      from: req.query.from || null,
      to:   req.query.to   || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FINAL SYNTHESIS ──────────────────────────────────────────────────────────
app.post('/api/final', async (req, res) => {
  const { context, answers } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const MODULE_TITLES = {
    gaps: 'Три разрыва',
    intent: 'Направленный оппортунизм',
    cascade: 'Каскад целей',
    independence: 'Независимое мышление',
  };
  const EX_LABELS = {
    ex1: 'Диагностика',
    ex2: 'Инструмент',
    ex3: 'Следующий шаг',
  };

  const answersText = ['gaps', 'intent', 'cascade', 'independence']
    .map(modId => {
      const items = ['ex1', 'ex2', 'ex3']
        .map(exId => {
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

Пользователь прошёл 4 модуля и ответил на упражнения. Твоя задача — дать персонализированное заключение в двух частях.

ЧАСТЬ 1 — СИНТЕЗ (2–3 предложения):
Покажи человеку, что именно он сделал за этот воркбук. Какие разрывы выявил, какие инструменты применил, к каким выводам пришёл. Используй его собственные слова и формулировки из ответов — он должен узнать себя. Не оценивай ("хорошо", "молодец") — только отражение того что было. Пиши про него, а не к нему.

ЧАСТЬ 2 — ФИНАЛЬНОЕ ЗАДАНИЕ:
Сформулируй одно конкретное действие на эту неделю. Не список — одно главное действие. Оно должно:
- Вытекать прежде всего из его ответов в "Следующий шаг" по модулям
- Быть конкретным: не "улучшить коммуникацию" — а "в среду провести разговор с X и передать замысел по формуле из модуля 2"
- Применять конкретный инструмент из книги который он уже освоил в упражнениях
- Начинаться с глагола действия

Пиши на «ты». Короткие предложения. Живой язык. Без вводных фраз типа "Итак" или "Поздравляем".

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
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
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
    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('[final] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const status = { status: 'ok', db: pool ? 'checking' : 'disabled', ts: new Date().toISOString() };
  if (pool) {
    try {
      await pool.query('SELECT 1');
      status.db = 'ok';
    } catch (e) {
      status.db = 'error';
      status.dbError = e.message;
      return res.status(503).json(status);
    }
  }
  res.json(status);
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
