import { NextRequest, NextResponse } from 'next/server';
import { sessions } from '@/lib/sessions';
import { signToken } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  // Validate secret token set when registering webhook with Telegram
  const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
  if (process.env.WEBHOOK_SECRET && secretToken !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const update = await req.json();
  const message = update.message;

  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId: number = message.chat.id;
  const telegramId: number = message.from.id;
  const firstName: string = message.from.first_name || '';
  const lastName: string = message.from.last_name || '';
  const username: string = message.from.username || '';
  const text: string = message.text.trim();

  if (text.startsWith('/start ')) {
    const token = text.split(' ')[1];
    const session = sessions.get(token);

    if (!session || session.status !== 'pending') {
      await sendMessage(chatId, 'Ссылка устарела или уже использована. Вернитесь на сайт и нажмите кнопку входа ещё раз.');
      return NextResponse.json({ ok: true });
    }

    const authToken = signToken(telegramId);

    // Save user + chat_id to DB
    const pool = getPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO users (telegram_id, first_name, last_name, username, chat_id, login_count)
           VALUES ($1, $2, $3, $4, $5, 1)
           ON CONFLICT (telegram_id) DO UPDATE SET
             first_name   = EXCLUDED.first_name,
             last_name    = EXCLUDED.last_name,
             username     = EXCLUDED.username,
             chat_id      = EXCLUDED.chat_id,
             login_count  = users.login_count + 1,
             updated_at   = NOW()`,
          [telegramId, firstName, lastName, username, chatId]
        );
      } catch (e: any) {
        console.error('[webhook] db error:', e.message);
      }
    }

    sessions.confirm(token, { telegramId, chatId, firstName, lastName, username, authToken });

    await sendMessage(
      chatId,
      `${firstName ? `${firstName}, в` : 'В'}ы успешно авторизованы ✅\n\nВернитесь в браузер — ваш воркбук уже открывается.`
    );
  } else if (text === '/start') {
    await sendMessage(chatId, 'Для входа перейдите на сайт и нажмите кнопку «Войти через Telegram».');
  }

  return NextResponse.json({ ok: true });
}

async function sendMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
