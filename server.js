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

ПРИМЕНЕНИЕ К ТРЁМ УПРАЖНЕНИЯМ (все три про боль пользователя):
Диагностика: пользователь смотрит на свою конкретную боль и определяет — какой из трёх разрывов главный у него прямо сейчас и как именно он проявляется в его ситуации.
Инструмент: пользователь называет конкретную неправильную реакцию которую применяет к этому разрыву — и разбирает какое трение она создаёт именно в его бизнесе.
Следующий шаг: одно конкретное изменение в поведении на этой неделе — что именно он перестаёт делать или начинает делать иначе, чтобы уменьшить главный разрыв.`,
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

ФОКУС: формулировка замысла — как его записать, чем он отличается от задачи. НЕ про передачу вниз по иерархии (это модуль 3). НЕ про культуру доверия (это модуль 4).

ПРИМЕНЕНИЕ К ТРЁМ УПРАЖНЕНИЯМ (все три про боль пользователя):
Диагностика: пользователь смотрит на свою конкретную боль и находит где он сам сейчас ставит инструкции вместо замысла — 2-3 конкретных примера из его реальной практики.
Инструмент: берёт ту ситуацию из своей боли которая болит сильнее всего и записывает для неё замысел по структуре Бангея — это реальный артефакт который он может использовать.
Следующий шаг: формулирует как намерение одно конкретное действие на ближайшую неделю — одно предложение "я делаю X, чтобы Y" плюс 1-2 конкретных шага.`,
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

ФОКУС: передача замысла и разделение ЧТО/ЗАЧЕМ vs КАК. НЕ про то что такое замысел (модуль 2). НЕ про культуру доверия (модуль 4).

ПРИМЕНЕНИЕ К ТРЁМ УПРАЖНЕНИЯМ (все три про боль пользователя):
Диагностика: пользователь смотрит на свою боль и находит конкретные случаи где он сам говорит КАК вместо ЗАЧЕМ — минимум 3 примера из реальной практики с людьми или подрядчиками.
Инструмент: берёт один из этих случаев — самый болезненный для его ситуации — и переформулирует задачу в замысел: только ЧТО и ЗАЧЕМ, без КАК. Это готовый текст который он может использовать.
Следующий шаг: одно конкретное решение которое он передаст команде на этой неделе с замыслом вместо инструкции — кому, что, в каком формате.`,
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

АДАПТАЦИЯ ПОД КОНТЕКСТ: Если пользователь — руководитель: аудит направлен на его команду — где люди приходят за решениями вместо того чтобы действовать. Если он сам исполнитель или соло: аудит разворачивается — он смотрит на себя, когда сам шёл за согласованием вместо того чтобы действовать в рамках замысла. Если работает с подрядчиками: те же вопросы про отношения с ними. Никогда не используй примеры про "войска" и армию — переводи в реальность его бизнеса или роли.

ПРИМЕНЕНИЕ К ТРЁМ УПРАЖНЕНИЯМ (все три про боль пользователя):
Диагностика: пользователь вспоминает 3 конкретных недавних случая из своей боли — когда человек пришёл за решением вместо того чтобы действовать самостоятельно. Для каждого: был ли передан замысел? Что помешало — отсутствие замысла или страх последствий?
Инструмент: берёт один из этих случаев и пишет что именно он изменит: какой замысел даст человеку и как покажет что инициатива в рамках замысла безопасна. Это конкретный текст или договорённость.
Следующий шаг: один конкретный разговор или действие на этой неделе — с кем, о чём, чтобы сделать один шаг к культуре самостоятельности в его конкретной ситуации.`,
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
  const { context, moduleId, bookId, previousAnswers, dialogReplies, correction } = req.body;

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

  const dialogRepliesText = dialogReplies && Object.keys(dialogReplies).length > 0
    ? `\nУточнения пользователя (ответы на уточняющие вопросы после упражнений):\n` +
      Object.entries(dialogReplies)
        .filter(([,v]) => v && v.trim())
        .map(([k, v]) => {
          const [modId, exId] = k.split('_');
          return `[${MODULE_TITLES[modId] || modId} / ${EX_LABELS[exId] || exId} — уточнение]: ${v}`;
        }).join('\n')
    : '';

  const systemPrompt = `Ты создаёшь упражнения для воркбука по книге «${book.title}» (${book.author}).

МОДУЛЬ: «${module.title}»
ЦИТАТА МОДУЛЯ: «${module.quote}»

СОДЕРЖАНИЕ МОДУЛЯ — используй эти концепции как основу упражнений:
${module.concept}

СКВОЗНАЯ НИТЬ ВОРКБУКА — прочитай это первым:
Пользователь пришёл с конкретной болью (см. поле "Боль" в анкете). Это не контекст — это ПРЕДМЕТ всего воркбука. Каждый модуль — это новый инструмент из книги, приложенный к этой же боли. Каждое упражнение — шаг к её решению. Если боль не заполнена или слишком общая — строй упражнения вокруг самой типичной проблемы для его роли и бизнеса. Никогда не предлагай пользователю "взять любую ситуацию из практики" — всегда работай с его конкретной болью.

ЛОГИКА ЧЕТЫРЁХ МОДУЛЕЙ — один путь, четыре угла:
Все четыре модуля смотрят на одну и ту же боль пользователя через разные линзы книги. Не четыре разные темы — а четыре шага к решению одной проблемы. Каждый следующий модуль углубляет и продолжает предыдущий. Пример: боль "всё замыкается на мне" → модуль 1 диагностирует где именно возникают разрывы → модуль 2 учит формулировать замысел чтобы команда действовала без согласований → модуль 3 показывает как этот замысел передаётся вниз → модуль 4 строит культуру где люди действуют самостоятельно.

СТРУКТУРА ТРЁХ УПРАЖНЕНИЙ — все три про одно и то же:
- Упражнение 1 (Диагностика): покажи пользователю как его конкретная боль объясняется через концепцию этого модуля. Не "найди любой пример" — а "вот как то, с чем ты пришёл, выглядит через эту теорию". Результат — он видит свою ситуацию по-новому и называет её своими словами.
- Упражнение 2 (Инструмент): примени инструмент модуля напрямую к боли пользователя. Результат — конкретный артефакт (формулировка, список, решение) который он может использовать за пределами воркбука прямо сейчас. Не тренировка навыка в вакууме — а готовый рабочий результат.
- Упражнение 3 (Следующий шаг): одно конкретное действие которое пользователь сделает на этой неделе — прямое следствие того что он сформулировал в упражнениях 1 и 2. Не план в общем — а один шаг: кто, что, когда. В тексте задания никогда не пиши "упражнение 1" или "упражнение 2" — пиши конкретно: "замысел который ты только что написал", "разрывы которые ты перечислил выше".

ПРЕЕМСТВЕННОСТЬ МЕЖДУ МОДУЛЯМИ (если есть предыдущие ответы):
Читай ответы пользователя из предыдущих модулей как продолжение одного разговора о его боли. Упражнения 1 и 2 текущего модуля должны явно строиться на том, что он уже понял — углублять, а не повторять. Упражнение 3 должно логически продолжать действие из предыдущего модуля: если он планировал провести встречу с командой — текущий модуль даёт ему новый инструмент для этой встречи, а не новую задачу.

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
- Одно предложение. Назови какой аспект темы этого модуля напрямую объясняет боль пользователя — и как именно это проявляется в его конкретной ситуации.
- Используй термин из книги. Говори про его боль, не про теорию. Не обобщай.

${prevAnswersText ? 'Предыдущие ответы пользователя — учитывай их, углубляй:\n' + prevAnswersText : ''}
${dialogRepliesText ? dialogRepliesText + '\n(Уточнения содержат дополнительный контекст — учитывай их при персонализации упражнений.)' : ''}

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

// ─── MODULE FEEDBACK ──────────────────────────────────────────────────────────
app.post('/api/feedback', async (req, res) => {
  const { context, moduleId, answers } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const MODULE_TITLES = { gaps: 'Три разрыва', intent: 'Направленный оппортунизм', cascade: 'Каскад целей', independence: 'Независимое мышление' };

  const answersText = [
    answers?.ex1 ? `Диагностика: ${answers.ex1.trim()}` : null,
    answers?.ex2 ? `Инструмент: ${answers.ex2.trim()}` : null,
    answers?.ex3 ? `Следующий шаг: ${answers.ex3.trim()}` : null,
  ].filter(Boolean).join('\n\n');

  const systemPrompt = `Ты — куратор воркбука по книге «Искусство действия» Стивена Бангея. Пользователь только что завершил модуль и ты даёшь короткую обратную связь по его ответам.

ФОРМАТ — строго 2-3 предложения:
1. Отразить что конкретно он сделал — его словами, не своими. Не пересказывай упражнения — говори о содержании ответов.
2. Если ответ поверхностный или слишком общий — мягко обозначь это: "Следующий шаг пока звучит широко — попробуй сузить до одного конкретного действия на этой неделе". Если ответы конкретные — не комментируй это отдельно.
3. Одно предложение-мостик к следующему модулю — что он теперь сможет увидеть иначе. Без спойлеров.

ЗАПРЕТЫ:
- Никаких оценок ("хорошо", "отлично", "молодец", "глубокий анализ")
- Никаких общих фраз ("это важный шаг", "ты на верном пути")
- Не повторяй структуру упражнений
- Максимум 3 предложения

Пиши на «ты». Живым языком. Коротко.`;

  const userMsg = `Модуль: ${MODULE_TITLES[moduleId] || moduleId}

Контекст пользователя:
Роль: ${context?.role || 'не указана'}
Бизнес: ${context?.biz || 'не описан'}
Боль: ${context?.pain || 'не описана'}

Его ответы:
${answersText || 'Ответы не заполнены'}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
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
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() || '';
    res.json({ success: true, feedback: text });
  } catch (err) {
    console.error('[feedback] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DIALOG QUESTION ──────────────────────────────────────────────────────────
// ─── DIALOG CHAT (multi-turn) ─────────────────────────────────────────────────
app.post('/api/dialog-chat', async (req, res) => {
  const { context, moduleId, exId, instruction, userAnswer, messages } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const MODULE_TITLES = { gaps: 'Три разрыва', intent: 'Направленный оппортунизм', cascade: 'Каскад целей', independence: 'Независимое мышление' };
  const EX_LABELS = { ex1: 'Диагностика', ex2: 'Инструмент', ex3: 'Следующий шаг' };

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
- Задавай уточняющие вопросы или помогай конкретизировать — цель чтобы пользователь улучшил ответ.
- СТРОГО в рамках этого упражнения. Если уходит в сторону — мягко верни.
- Пиши на «ты». Живо, без официоза.`;

  // Строим историю в формате Anthropic
  const history = (messages || []).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  // Если истории нет — AI сам начинает разговор (без вступления)
  if (history.length === 0) {
    history.push({ role: 'user', content: 'Начни диалог — сразу с вопроса, без вступления и без "Хорошо" или "Вот вопрос:".' });
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 3000, 6000];
  let lastErr;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
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
      return res.json({ success: true, reply });
    } catch (err) {
      lastErr = err;
      if (!err.message?.includes('529')) break; // не ретраим другие ошибки
    }
  }

  console.error('[dialog-chat] error:', lastErr);
  res.status(500).json({ error: lastErr.message });
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
