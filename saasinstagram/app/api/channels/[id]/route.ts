export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase/admin';
import { normalizeConnectedChannel } from '@/lib/meta/connection';
import { decryptIfNeeded } from '@/lib/utils/encryption';
import { getOwnedChannel } from '@/lib/workspaces/access';
import type { MetaConnectedChannel } from '@/types/meta';

// PATCH: Refresh Instagram account ID from Meta API
export async function PATCH(
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

    const { accessToken: storedAccessToken, pageId } = channel ?? {};
    if (!storedAccessToken || !pageId) {
      return NextResponse.json({ error: 'Missing token or pageId' }, { status: 400 });
    }
    const accessToken = decryptIfNeeded(storedAccessToken);

    // Try to fetch Instagram Business Account ID from Meta
    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,connected_instagram_account{id,username},instagram_business_account{id,username}&access_token=${accessToken}`
    );
    const metaData = await metaRes.json() as Record<string, unknown>;

    type IgAccount = { id: string; username?: string };
    const igAccount = (metaData.instagram_business_account as IgAccount) ?? (metaData.connected_instagram_account as IgAccount) ?? null;

    if (!igAccount?.id) {
      return NextResponse.json({
        error: 'Conta Instagram não encontrada. Vincule sua conta Instagram à Página do Facebook primeiro.',
        metaResponse: metaData,
      }, { status: 404 });
    }

    const nextChannel = normalizeConnectedChannel({
      ...channel,
      instagramAccountId: igAccount.id,
      instagramAccountIdApi: igAccount.id,
      instagramUsername: igAccount.username ?? undefined,
      igConnectionStatus: 'connected',
      lastRefreshError: undefined,
      updatedAt: new Date().toISOString(),
    });

    await db.collection('channels').doc(params.id).set(nextChannel, { merge: true });

    return NextResponse.json({ success: true, instagramAccountId: igAccount.id, username: igAccount.username });
  } catch (err) {
    console.error('channel PATCH error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    const status =
      message === 'channel_not_found' ? 404 :
      message === 'workspace_forbidden' ? 403 :
      500;

    return NextResponse.json({ error: 'Internal error' }, { status });
  }
}

export async function DELETE(
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
    const { channelSnap } = await getOwnedChannel(db, params.id, decoded.uid);
    const channelData = { id: channelSnap.id, ...channelSnap.data() } as MetaConnectedChannel;

    // Release channel in global registry with 24h cooldown
    const globalUniqueId = channelData.channel === 'whatsapp' ? channelData.phoneNumberId : channelData.pageId;
    if (globalUniqueId) {
      const now = new Date();
      const cooldownUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      await db.collection('channelRegistry').doc(`${channelData.channel}_${globalUniqueId}`).set({
        channel: channelData.channel,
        uniqueId: globalUniqueId,
        workspaceId: null,
        connectedAt: null,
        disconnectedAt: now.toISOString(),
        cooldownUntil,
      });
    }

    await db.collection('channels').doc(params.id).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('channel DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    const status =
      message === 'channel_not_found' ? 404 :
      message === 'workspace_forbidden' ? 403 :
      500;

    return NextResponse.json({ error: 'Internal error' }, { status });
  }
}
