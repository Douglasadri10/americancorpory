export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import type { Conversation } from '@/types/conversation';
import type { Lead } from '@/types/lead';

function isSameDay(value?: string) {
  if (!value) {
    return false;
  }

  const now = new Date();
  const date = new Date(value);

  return (
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()
  );
}

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const [allConversationsSnap, leadsSnap, channelsSnap] = await Promise.all([
      db.collection('conversations').where('workspaceId', '==', workspaceId).get(),
      db.collection('leads').where('workspaceId', '==', workspaceId).get(),
      db.collection('channels').where('workspaceId', '==', workspaceId).get(),
    ]);

    const conversations = allConversationsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Conversation[];
    const recentConversations = [...conversations]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5);
    const leads = leadsSnap.docs.map((doc) => doc.data()) as Lead[];

    const channelBreakdown = conversations.reduce<Record<string, number>>((acc, conversation) => {
      acc[conversation.channel] = (acc[conversation.channel] ?? 0) + 1;
      return acc;
    }, {
      instagram: 0,
      facebook: 0,
      whatsapp: 0,
    });

    return NextResponse.json({
      stats: {
        totalConversations: conversations.length,
        open: conversations.filter((item) => item.status === 'open').length,
        pending: conversations.filter((item) => item.status === 'pending').length,
        resolvedToday: conversations.filter((item) => item.status === 'resolved' && isSameDay(item.resolvedAt)).length,
        leadsTotal: leads.length,
        connectedChannels: channelsSnap.docs.filter((doc) => {
          const data = doc.data() as { connected?: boolean; isActive?: boolean };
          return data.connected !== false && data.isActive !== false;
        }).length,
      },
      channelBreakdown,
      recentConversations,
    });
  } catch (error) {
    console.error('overview GET error:', error);
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
}
