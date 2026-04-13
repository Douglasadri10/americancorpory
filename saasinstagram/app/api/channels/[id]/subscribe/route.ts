export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase/admin';
import { mapMetaErrorMessage, subscribeInstagramWebhook } from '@/lib/meta/connection';
import { decryptIfNeeded } from '@/lib/utils/encryption';
import { getOwnedChannel } from '@/lib/workspaces/access';
import type { MetaConnectedChannel } from '@/types/meta';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = request.headers.get('Authorization');
  const idToken = authHeader?.replace('Bearer ', '');
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decoded = await verifyIdToken(idToken);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  try {
    const db = getAdminFirestore();
    const { channelSnap, channelData } = await getOwnedChannel(db, params.id, decoded.uid);
    const channel = { id: channelSnap.id, ...channelData } as MetaConnectedChannel;

    if (channel.channel === 'whatsapp') {
      await db.collection('channels').doc(params.id).update({
        webhookVerified: true,
        webhookStatus: 'subscribed',
        lastRefreshError: undefined,
        webhookSubscribedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true });
    }

    const accessToken = decryptIfNeeded(channel.accessToken as string);
    const pageId = channel.pageId as string;
    const instagramAccountId = (channel.instagramAccountId ?? channel.instagramAccountIdApi ?? pageId) as string;
    await subscribeInstagramWebhook({
      accessToken,
      instagramAccountId,
      pageId,
    });

    await db.collection('channels').doc(params.id).update({
      webhookVerified: true,
      webhookStatus: 'subscribed',
      lastRefreshError: undefined,
      webhookSubscribedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('subscribe error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    const status =
      message === 'channel_not_found' ? 404 :
      message === 'workspace_forbidden' ? 403 :
      400;

    return NextResponse.json({
      error: mapMetaErrorMessage(message),
      hint: 'Verifique permissões, vínculo IG-Página e se o app está em Live ou o usuário aceitou o papel de tester.',
    }, { status });
  }
}
