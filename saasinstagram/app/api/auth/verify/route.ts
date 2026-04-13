export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const decodedToken = await verifySessionCookie(sessionCookie);

  if (!decodedToken) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  return NextResponse.json({
    uid: decodedToken.uid,
    email: decodedToken.email,
    name: decodedToken.name,
  });
}
