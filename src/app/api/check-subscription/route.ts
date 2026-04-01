import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const { telegramUser } = await req.json();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL;

  if (!botToken || !channel) return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 });

  const { hash, ...fields } = telegramUser;
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (expectedHash !== hash) return NextResponse.json({ error: 'Invalid Telegram auth data' }, { status: 403 });
  if (Date.now() / 1000 - fields.auth_date > 86400) return NextResponse.json({ error: 'Auth data expired' }, { status: 403 });

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${telegramUser.id}`
    );
    const data = await response.json();
    const status = data.result?.status;
    const subscribed = ['creator', 'administrator', 'member', 'restricted'].includes(status);
    return NextResponse.json({ subscribed, status: status || 'unknown' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
