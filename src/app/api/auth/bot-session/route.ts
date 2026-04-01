import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sessions } from '@/lib/sessions';

export async function POST() {
  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, { status: 'pending', createdAt: Date.now() });

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'WorkbookBot';
  return NextResponse.json({ token, botUsername });
}
