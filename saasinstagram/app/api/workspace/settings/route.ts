export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase/admin';

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const idToken = authHeader?.replace('Bearer ', '');
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decoded = await verifyIdToken(idToken);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    workspaceId,
    workspaceName,
    settings,
  } = body as { workspaceId: string; workspaceName?: string; settings: Record<string, unknown> };
  if (!workspaceId || !settings) {
    return NextResponse.json({ error: 'workspaceId and settings required' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    // Verify the requester owns this workspace
    const wsSnap = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsSnap.exists || wsSnap.data()?.ownerUid !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = wsSnap.data()?.settings ?? {};
    await db.collection('workspaces').doc(workspaceId).update({
      ...(typeof workspaceName === 'string' && workspaceName.trim() ? { name: workspaceName.trim() } : {}),
      settings: { ...existing, ...settings },
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('settings PATCH error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
