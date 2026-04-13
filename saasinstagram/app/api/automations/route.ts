export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getOwnedWorkspace } from '@/lib/workspaces/access';

function getErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal error';
  const status =
    message === 'workspace_not_found' ? 404 :
    message === 'workspace_forbidden' ? 403 :
    500;

  return NextResponse.json(
    { error: status === 500 ? 'Internal error' : message.replaceAll('_', ' ') },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);
    const snap = await db.collection('automations')
      .where('workspaceId', '==', workspaceId)
      .get();
    const automations = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aDate = (a as Record<string, unknown>).createdAt as string ?? '';
        const bDate = (b as Record<string, unknown>).createdAt as string ?? '';
        return bDate.localeCompare(aDate);
    });
    return NextResponse.json({ automations });
  } catch (err) {
    console.error('automations GET error:', err);
    return getErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : '';
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const wsSnap = await getOwnedWorkspace(db, workspaceId, decoded.uid);
    const wsData = wsSnap.data() ?? {};
    const maxAutomations: number = wsData.limits?.maxAutomations ?? 5;
    // -1 means unlimited (Business plan)
    if (maxAutomations !== -1) {
      const existingSnap = await db.collection('automations').where('workspaceId', '==', workspaceId).count().get();
      if (existingSnap.data().count >= maxAutomations) {
        return NextResponse.json({ error: 'automation_limit_reached' }, { status: 429 });
      }
    }

    const ref = db.collection('automations').doc();
    const now = new Date().toISOString();
    // Whitelist fields — never spread untrusted body directly into Firestore
    const data = {
      id: ref.id,
      workspaceId,
      name,
      description: typeof body.description === 'string' ? body.description.slice(0, 500) : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      trigger: body.trigger ?? null,
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      actions: Array.isArray(body.actions) ? body.actions : [],
      channelId: typeof body.channelId === 'string' ? body.channelId : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(data);
    return NextResponse.json({ automation: data });
  } catch (err) {
    console.error('automations POST error:', err);
    return getErrorResponse(err);
  }
}
