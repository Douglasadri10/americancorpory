export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getOwnedAutomation } from '@/lib/workspaces/access';

function getErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal error';
  const status =
    message === 'automation_not_found' ? 404 :
    message === 'workspace_forbidden' ? 403 :
    message === 'workspace_not_found' ? 404 :
    500;

  return NextResponse.json(
    { error: status === 500 ? 'Internal error' : message.replaceAll('_', ' ') },
    { status }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const db = getAdminFirestore();
    await getOwnedAutomation(db, params.id, decoded.uid);

    // Whitelist fields — never spread untrusted body into Firestore
    const allowed: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.name === 'string') allowed.name = body.name.trim().slice(0, 200);
    if (typeof body.description === 'string') allowed.description = body.description.slice(0, 500);
    if (typeof body.isActive === 'boolean') allowed.isActive = body.isActive;
    if (body.trigger !== undefined) allowed.trigger = body.trigger;
    if (Array.isArray(body.conditions)) allowed.conditions = body.conditions;
    if (Array.isArray(body.actions)) allowed.actions = body.actions;
    if (typeof body.channelId === 'string') allowed.channelId = body.channelId;

    await db.collection('automations').doc(params.id).update(allowed);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('automation PATCH error:', err);
    return getErrorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  try {
    const db = getAdminFirestore();
    await getOwnedAutomation(db, params.id, decoded.uid);
    await db.collection('automations').doc(params.id).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('automation DELETE error:', err);
    return getErrorResponse(err);
  }
}
