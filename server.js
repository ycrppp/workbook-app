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

Упражнения этого модуля должны помочь пользователю: (1) увидеть, какой из трёх разрывов главный в его ситуации, (2) распознать, какую "неправильную реакцию" он использует прямо сейчас, (3) почувствовать, как это создаёт трение вместо движения.`,
      },
      {
        id: 'intent',
        title: 'Направленный оппортунизм',
        quote: 'Стратегия — это не жёсткий план, а развитие центральной идеи в меняющихся условиях.',
        concept: `Бангей вводит понятие "directed opportunism" — направленный оппортунизм. Это не хаос и не жёсткий план. Это третий путь: у каждого есть ясное понимание замысла (зачем и чего достичь) — и свобода выбирать способ действий под текущую ситуацию.

ЧТО ТАКОЕ ЗАМЫСЕЛ (intent): Замысел — это не задача ("сделай X"), а намерение ("добейся Y, потому что нам нужно Z"). Он отвечает на вопросы: что мы хотим достичь? почему это важно? как это вписывается в цели уровня выше? Замысел остаётся стабильным, когда меняются обстоятельства.

ПОЧЕМУ ИНСТРУКЦИИ НЕ РАБОТАЮТ: Инструкция описывает конкретные шаги в конкретных условиях. Как только условия меняются — инструкция устаревает. Человек с инструкцией в изменившейся ситуации либо делает по инструкции (неверно), либо стоит и ждёт новой (паралич). Человек с замыслом — адаптируется сам.

СТРУКТУРА ЗАМЫСЛА ПО БАНГЕЮ: (1) Высший замысел — зачем это вообще нужно организации. (2) Собственная задача — что конкретно нужно сделать мне. (3) Ключевые задачи — главные действия для её выполнения. (4) Ограничения — чего делать нельзя. (5) Свобода действий — в каких рамках я могу принимать решения сам.

КЛЮЧЕВАЯ ИДЕЯ: Чем понятнее замысел — тем меньше нужен контроль. Люди принимают правильные решения не потому что им сказали, что делать, а потому что они понимают, зачем.

ФОКУС УПРАЖНЕНИЙ ЭТОГО МОДУЛЯ: формулировка замысла — как его записать, чем он отличается от задачи, есть ли он вообще. НЕ про то, как передать его вниз по иерархии (это модуль 3). НЕ про то, доверяют ли люди (это модуль 4).`,
      },
      {
        id: 'cascade',
        title: 'Каскад целей',
        quote: 'На каждый уровень передаётся ситуация, цель, задача, ресурсы. Как действовать — решает сам.',
        concept: `Бангей показывает, как замысел передаётся вниз по организации — через каскад. Каждый уровень получает не инструкцию, а контекст. И сам формулирует свой замысел для следующего уровня.

КАК РАБОТАЕТ КАСКАД: Руководитель передаёт подчинённому: (1) Ситуацию — почему это важно прямо сейчас. (2) Общий замысел — чего мы хотим достичь и зачем. (3) Конкретную задачу — твоя роль в этом замысле. (4) Ресурсы — что у тебя есть. (5) Ограничения — чего делать нельзя. Подчинённый сам решает, как именно это делать.

ТЕСТ BRIEFING BACK: Бангей предлагает простую проверку: попроси подчинённого пересказать своими словами, что он будет делать и зачем. Не "повтори мои слова", а "объясни мне". Если он не может объяснить зачем — замысел не передан, только задача. Это значит, при первом же отклонении от плана он остановится и будет ждать.

ОШИБКА УРОВНЕЙ: Распространённая проблема — менеджер среднего уровня получает замысел, но вниз передаёт только задачи. Цепочка рвётся. Люди на нижнем уровне не знают "зачем" — они знают только "что". При изменении ситуации они не могут адаптироваться.

КЛЮЧЕВАЯ ИДЕЯ: Каскад работает, только если каждый уровень понимает замысел уровня выше и умеет сформулировать свой замысел для уровня ниже — не просто передать задачу дальше.

ФОКУС УПРАЖНЕНИЙ ЭТОГО МОДУЛЯ: передача замысла — как он проходит (или не проходит) через уровни, briefing back, разрыв между тем что передал и что дошло. НЕ про то, что такое замысел и как его сформулировать (это модуль 2). НЕ про культуру доверия (это модуль 4).`,
      },
      {
        id: 'independence',
        title: 'Независимое мышление',
        quote: 'Верх доверия — не наказывать за нарушение распоряжений, если это помогло реализовать замысел.',
        concept: `Последний модуль книги — о культуре. Замысел и каскад работают только если люди готовы действовать самостоятельно. А это требует двух вещей: доверия снизу вверх (я могу принять решение без согласования) и доверия сверху вниз (мне позволят это сделать).

ПОДЧИНЕНИЕ ЧЕРЕЗ НЕЗАВИСИМОЕ МЫШЛЕНИЕ: Бангей вводит парадоксальное понятие — "obedient autonomy". Исполнитель следует не букве приказа, а его духу. Когда ситуация меняется — не ждёт новых инструкций, а спрашивает себя: "Что хотел бы мой руководитель, если бы видел то, что вижу я?" И действует исходя из замысла.

КУЛЬТУРА ИНИЦИАТИВЫ: Это невозможно построить декларацией. Люди начнут действовать самостоятельно только когда убедятся: инициатива в рамках замысла не наказывается, даже если привела к ошибке. Бангей описывает прусскую военную культуру, где офицер, нарушивший приказ ради замысла, мог быть повышен — а не разжалован.

ТИПИЧНАЯ ЛОВУШКА: Руководитель говорит "действуй самостоятельно", но при первой ошибке — наказывает. Или требует согласования на каждый шаг. Люди быстро учатся: самостоятельность опасна, лучше ждать инструкций. Разрыв в согласованности возвращается.

КЛЮЧЕВАЯ ИДЕЯ: Независимое мышление — это не черта характера, а результат того, что человек понимает замысел достаточно хорошо, чтобы принимать решения без руководителя. И живёт в культуре, где это безопасно.`,
      },
    ],
  },
};

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
  const EX_LABELS = { ex1: 'Упражнение 1', ex2: 'Упражнение 2', ex3: 'Упражнение 3' };
  const prevAnswersText = previousAnswers && Object.keys(previousAnswers).length > 0
    ? `\nЧто пользователь уже написал в предыдущих модулях (используй как контекст, не повторяй те же вопросы):\n` +
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

ГЛАВНОЕ ТРЕБОВАНИЕ: каждое упражнение должно обучать конкретной идее из книги. Не просто "подумай о своей команде" — а "примень вот этот инструмент/концепцию Бангея к своей ситуации". Читатель должен чувствовать, что работает с книгой, а не с общим тренингом по менеджменту.

УНИКАЛЬНОСТЬ МОДУЛЯ: упражнения строго про тему этого модуля — не про результаты бизнеса в общем, не про клиентов, не про команду абстрактно. Если пользователь уже проходил предыдущие модули — не повторяй их темы. Каждый модуль должен давать принципиально новый угол зрения.

СТРУКТУРА ТРЁХ УПРАЖНЕНИЙ:
- ex1: диагностика — пользователь письменно формулирует, как именно проблема из книги проявляется у него. Не "подумай", а "напиши список / перечисли / сформулируй".
- ex2: инструмент — пользователь применяет конкретный инструмент из книги прямо сейчас. Например: "составь Intent для этой задачи", "сформулируй три разрыва", "напиши брифинг по формату книги". Результат — конкретный текст, а не мысль.
- ex3: перенос — пользователь берёт инструмент из ex2 и применяет его к другой ситуации или следующему шагу. Закрепление навыка через второе применение, не рефлексия.

ЖЁСТКИЕ ЗАПРЕТЫ — эти форматы недопустимы:
- "Как ты думаешь..." — запрещено
- "Что бы ты сделал если бы..." — запрещено
- Гипотетические вопросы ("если бы", "представь что") — запрещены
- Вопросы на оценку прошлого ("почему", "что пошло не так") — запрещены
- Вопросы с односложным ответом — запрещены
- Любая рефлексия без конкретного письменного действия — запрещена

КАЖДОЕ УПРАЖНЕНИЕ ДОЛЖНО:
- Требовать написать что-то конкретное: список, формулировку, план, текст
- Иметь чёткий критерий выполнения (минимум 3 пункта / 2-3 предложения / конкретная структура)
- Тренировать навык, а не проверять знание

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

// ─── USER LOAD (после auth — грузим данные из БД) ─────────────────────────────
app.post('/api/user/load', async (req, res) => {
  if (!pool) return res.json({ projects: { projects: [], currentProjectId: null } });
  const { telegram_id } = req.body;
  if (!telegram_id) return res.status(400).json({ error: 'telegram_id required' });
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
app.post('/api/user/sync', async (req, res) => {
  if (!pool) return res.json({ success: true });
  const { telegram_id, first_name, last_name, username, photo_url, projects } = req.body;
  if (!telegram_id) return res.status(400).json({ error: 'telegram_id required' });
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
