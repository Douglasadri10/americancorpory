import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore as getFirebaseAdminDb } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { disconnectGoogleCalendar } from '@/services/googleCalendarService';

export async function POST(req: NextRequest) {
  const decoded = await authenticateRequest(req);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  try {
    const db = getFirebaseAdminDb();
    await disconnectGoogleCalendar(db, workspaceId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
