import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthUrl } from '@/services/googleCalendarService';
import { getAdminAuth } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const idToken = authHeader.replace('Bearer ', '');
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    const url = buildGoogleAuthUrl(workspaceId);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
