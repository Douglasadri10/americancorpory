export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import { getTokens, getCalendarEvents } from '@/services/googleCalendarService';

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get('workspaceId');
  const dateFrom    = searchParams.get('dateFrom');
  const dateTo      = searchParams.get('dateTo');

  if (!workspaceId || !dateFrom || !dateTo) {
    return NextResponse.json({ error: 'workspaceId, dateFrom and dateTo required' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const tokens = await getTokens(db, workspaceId);
    if (!tokens) return NextResponse.json({ events: [] });

    const events = await getCalendarEvents(tokens, dateFrom, dateTo);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('[google-events]', err);
    return NextResponse.json({ events: [] });
  }
}
