export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase/admin';
import { normalizeConnectedChannel } from '@/lib/meta/connection';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import type { MetaConnectedChannel } from '@/types/meta';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const idToken = authHeader?.replace('Bearer ', '');
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decoded = await verifyIdToken(idToken);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const snap = await db
      .collection('channels')
      .where('workspaceId', '==', workspaceId)
      .get();

    const channels = snap.docs
      .map((d) => normalizeConnectedChannel({ id: d.id, ...d.data() } as MetaConnectedChannel))
      .sort((a, b) => a.pageName.localeCompare(b.pageName, 'pt-BR'));

    // Backfill pageAvatarURL with the stable Graph API redirect URL.
    // Stored CDN URLs (picture.data.url) expire after ~hours; the redirect
    // endpoint /{id}/picture is permanent and always resolves to current photo.
    const batch = db.batch();
    let hasBatchUpdates = false;
    for (const channel of channels) {
      if (channel.channel === 'whatsapp') continue;
      const graphId =
        channel.channel === 'instagram'
          ? (channel.instagramAccountId ?? channel.instagramAccountIdApi ?? channel.pageId)
          : channel.pageId;
      if (!graphId) continue;
      const stableUrl = `https://graph.facebook.com/${graphId}/picture?type=square`;
      // Always refresh to stable URL (overwrites expired CDN URL)
      if (channel.pageAvatarURL !== stableUrl) {
        channel.pageAvatarURL = stableUrl;
        batch.update(db.collection('channels').doc(channel.id), { pageAvatarURL: stableUrl });
        hasBatchUpdates = true;
      }
    }
    if (hasBatchUpdates) void batch.commit().catch(() => null);

    return NextResponse.json({ channels });
  } catch (err) {
    console.error('channels GET error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    const status =
      message === 'workspace_not_found' ? 404 :
      message === 'workspace_forbidden' ? 403 :
      500;

    return NextResponse.json({ error: 'Internal error' }, { status });
  }
}
