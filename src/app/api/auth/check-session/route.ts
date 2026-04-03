import { NextRequest, NextResponse } from 'next/server';
import { sessions } from '@/lib/sessions';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ confirmed: false });

  const session = sessions.get(token);

  if (!session) {
    return NextResponse.json({ confirmed: false, expired: true });
  }

  if (session.status === 'confirmed') {
    sessions.delete(token);
    return NextResponse.json({
      confirmed: true,
      authToken: session.authToken,
      user: {
        id: session.telegramId,
        first_name: session.firstName,
        last_name: session.lastName,
        username: session.username,
        photo_url: session.photoUrl,
      },
    });
  }

  return NextResponse.json({ confirmed: false });
}
