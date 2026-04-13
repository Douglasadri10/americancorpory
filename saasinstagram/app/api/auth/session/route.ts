export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { createSessionCookie, verifySessionCookie } from '@/lib/firebase/admin';

const SESSION_COOKIE_NAME = 'session';
const SESSION_EXPIRES_IN = 5 * 24 * 60 * 60 * 1000; // 5 days

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { idToken?: string };
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    // Create a session cookie
    const sessionCookie = await createSessionCookie(idToken, SESSION_EXPIRES_IN);

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_EXPIRES_IN / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const decodedToken = await verifySessionCookie(sessionCookie);

  if (!decodedToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    uid: decodedToken.uid,
    email: decodedToken.email,
  });
}
