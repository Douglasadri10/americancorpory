import type { NextRequest } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifyIdToken, verifySessionCookie } from '@/lib/firebase/admin';

export async function authenticateRequest(request: NextRequest): Promise<DecodedIdToken | null> {
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    const decoded = await verifyIdToken(bearerToken);
    if (decoded) return decoded;
  }

  const sessionCookie = request.cookies.get('session')?.value;
  if (!sessionCookie) return null;

  return verifySessionCookie(sessionCookie);
}

