export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import { decryptIfNeeded } from '@/lib/utils/encryption';
import { normalizeContactUsername } from '@/lib/conversations/display';
import type { Conversation } from '@/types/conversation';
import type { MetaConnectedChannel } from '@/types/meta';

type StoredChannel = MetaConnectedChannel & { tokenType?: string };

function buildInstagramProfileUrl(username?: string | null) {
  if (!username) return undefined;
  const clean = username.replace(/^@+/, '');
  return clean ? `https://instagram.com/${clean}` : undefined;
}

async function fetchMetaContactProfile(
  accessToken: string,
  tokenType: string | undefined,
  contactId: string
): Promise<{ name?: string; username?: string; avatarURL?: string; profileURL?: string }> {
  const isIgaaToken = accessToken.startsWith('IGAA') || tokenType === 'instagram_igaa';
  const apiBase = isIgaaToken
    ? 'https://graph.instagram.com/v21.0'
    : 'https://graph.facebook.com/v21.0';

  const res = await fetch(
    `${apiBase}/${contactId}?fields=id,name,username,profile_pic&access_token=${encodeURIComponent(accessToken)}`
  );
  const data = await res.json() as {
    id?: string;
    name?: string;
    username?: string;
    profile_pic?: string;
    error?: { message: string; code: number };
  };

  if (!res.ok || data.error || !data.id) {
    return {};
  }

  return {
    name: data.name,
    username: normalizeContactUsername(data.username),
    avatarURL: data.profile_pic,
    profileURL: buildInstagramProfileUrl(data.username),
  };
}

/**
 * POST /api/conversations/enrich-contact
 * Body: { workspaceId, conversationId }
 *
 * Fetches the contact profile from Meta Graph API and updates the conversation document.
 * No-op if the contact already has a real name.
 */
export async function POST(request: NextRequest) {
  const decodedToken = await authenticateRequest(request);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { workspaceId?: string; conversationId?: string };
  try {
    body = await request.json() as { workspaceId?: string; conversationId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { workspaceId, conversationId } = body;
  if (!workspaceId || !conversationId) {
    return NextResponse.json({ error: 'workspaceId and conversationId required' }, { status: 400 });
  }

  const db = getAdminFirestore();

  try {
    await getOwnedWorkspace(db, workspaceId, decodedToken.uid);

    // Load conversation
    const convSnap = await db.collection('conversations').doc(conversationId).get();
    if (!convSnap.exists) {
      return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 });
    }
    const conv = { id: convSnap.id, ...convSnap.data() } as Conversation;
    if (conv.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only enrich Instagram conversations with placeholder names
    if (conv.channel !== 'instagram' || !conv.contact?.id) {
      return NextResponse.json({ enriched: false, reason: 'not_instagram' });
    }
    const contactName = conv.contact.name?.trim();
    const hasRealName = contactName && !contactName.startsWith('#') && !/^\d+$/.test(contactName) && contactName !== 'Contato';
    if (hasRealName) {
      return NextResponse.json({ enriched: false, reason: 'already_has_name' });
    }

    // Find channel with access token
    const channelSnap = await db
      .collection('channels')
      .where('workspaceId', '==', workspaceId)
      .where('channel', '==', 'instagram')
      .limit(5)
      .get();

    if (channelSnap.empty) {
      return NextResponse.json({ enriched: false, reason: 'no_channel' });
    }

    // Try each channel until one succeeds
    let profile: { name?: string; username?: string; avatarURL?: string; profileURL?: string } = {};
    for (const doc of channelSnap.docs) {
      const ch = { id: doc.id, ...doc.data() } as StoredChannel;
      if (!ch.accessToken) continue;
      const accessToken = decryptIfNeeded(ch.accessToken);
      const result = await fetchMetaContactProfile(accessToken, ch.tokenType, conv.contact.id);
      if (result.name || result.username) {
        profile = result;
        break;
      }
    }

    if (!profile.name && !profile.username) {
      return NextResponse.json({ enriched: false, reason: 'api_returned_no_data' });
    }

    const updatedContact = {
      ...conv.contact,
      ...(profile.name && { name: profile.name }),
      ...(profile.username && { username: profile.username }),
      ...(profile.avatarURL && { avatarURL: profile.avatarURL }),
      ...(profile.profileURL && { profileURL: profile.profileURL }),
    };

    await convSnap.ref.update({
      contact: updatedContact,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ enriched: true, contact: updatedContact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json(
      { error: message === 'workspace_not_found' ? 'workspace_not_found' : 'Internal error' },
      { status: message === 'workspace_not_found' ? 404 : 500 }
    );
  }
}
