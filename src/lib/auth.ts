import crypto from 'crypto';
import { NextRequest } from 'next/server';

const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 дней

export function signToken(telegram_id: number): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  const payload = Buffer.from(JSON.stringify({ tid: telegram_id, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | null): { tid: number } | null {
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

export function getTokenFromRequest(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function requireAuth(req: NextRequest): { tid: number } | null {
  const token = getTokenFromRequest(req);
  return verifyToken(token);
}
