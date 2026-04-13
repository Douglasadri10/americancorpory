export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const idToken = authHeader?.replace('Bearer ', '');
  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyIdToken(idToken);
  if (!decoded) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const preferredWorkspaceId = request.nextUrl.searchParams.get('workspaceId');

    if (preferredWorkspaceId) {
      const preferredDoc = await db.collection('workspaces').doc(preferredWorkspaceId).get();
      if (preferredDoc.exists && preferredDoc.data()?.ownerUid === decoded.uid) {
        const data = preferredDoc.data();
        return NextResponse.json({
          workspace: {
            id: preferredDoc.id,
            name: data?.name ?? '',
            ownerUid: data?.ownerUid,
            plan: data?.plan ?? null,
            settings: data?.settings ?? null,
            integrations: data?.integrations ?? null,
          },
        });
      }
    }

    const snap = await db
      .collection('workspaces')
      .where('ownerUid', '==', decoded.uid)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ workspace: null });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    return NextResponse.json({
      workspace: {
        id: doc.id,
        name: data.name ?? '',
        ownerUid: data.ownerUid,
        plan: data.plan ?? null,
        settings: data.settings ?? null,
        integrations: data.integrations ?? null,
      },
    });
  } catch (err) {
    console.error('workspace/me error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
