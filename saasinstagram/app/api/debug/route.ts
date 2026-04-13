export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  // Debug endpoint is disabled in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const authHeader = request.headers.get('Authorization');
  const idToken = authHeader?.replace('Bearer ', '');
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const decoded = await verifyIdToken(idToken);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  try {
    const db = getAdminFirestore();

    const wsSnap = await db.collection('workspaces').where('ownerUid', '==', decoded.uid).limit(1).get();
    const workspace = wsSnap.empty ? null : { id: wsSnap.docs[0].id, ...wsSnap.docs[0].data() };
    const wsId = wsSnap.empty ? null : wsSnap.docs[0].id;

    const chSnap = wsId
      ? await db.collection('channels').where('workspaceId', '==', wsId).get()
      : { docs: [] as typeof wsSnap.docs };

    const channels = chSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        channel: data.channel,
        pageId: data.pageId,
        pageName: data.pageName,
        instagramAccountId: data.instagramAccountId,
        connected: data.connected,
        isActive: data.isActive,
        webhookVerified: data.webhookVerified,
        // Never expose token values — show only presence
        hasAccessToken: typeof data.accessToken === 'string' && data.accessToken.length > 0,
      };
    });

    const wsData = workspace as Record<string, unknown> | null;
    const settings = wsData?.settings as Record<string, unknown> | undefined;

    return NextResponse.json({
      workspaceId: wsId,
      workspaceName: wsData?.name,
      aiEnabled: settings?.aiEnabled ?? false,
      channelsCount: channels.length,
      channels,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta`,
      // verifyToken intentionally omitted
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
