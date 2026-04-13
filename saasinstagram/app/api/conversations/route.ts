export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedConversation, getOwnedWorkspace } from '@/lib/workspaces/access';
import { FieldValue } from 'firebase-admin/firestore';
import type { Conversation } from '@/types/conversation';

function getErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal error';
  const status =
    message === 'workspace_not_found' || message === 'conversation_not_found' ? 404 :
    message === 'workspace_forbidden' ? 403 :
    500;

  return NextResponse.json(
    { error: status === 500 ? 'Internal error' : message.replaceAll('_', ' ') },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const decodedToken = await authenticateRequest(request);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversationId');
  const workspaceId = searchParams.get('workspaceId');
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');
  const assignedTo = searchParams.get('assignedTo');
  const includeStats = searchParams.get('includeStats') === '1';
  const limit = parseInt(searchParams.get('limit') ?? '25', 10);

  try {
    const db = getAdminFirestore();

    if (conversationId) {
      const { conversationSnap, conversationData } = await getOwnedConversation(db, conversationId, decodedToken.uid);
      const conversation = { id: conversationSnap.id, ...conversationData } as Conversation;
      return NextResponse.json({ conversation });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    await getOwnedWorkspace(db, workspaceId, decodedToken.uid);

    const snap = await db
      .collection('conversations')
      .where('workspaceId', '==', workspaceId)
      .get();

    // Single fetch — used for both filtering and stats
    const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Conversation);

    const conversations = all
      .filter((conversation) => {
        if (status && status !== 'all' && conversation.status !== status) return false;
        if (channel && channel !== 'all' && conversation.channel !== channel) return false;
        if (assignedTo === 'me' && conversation.assignedTo !== decodedToken.uid) return false;
        if (assignedTo === 'unassigned' && !!conversation.assignedTo) return false;
        if (assignedTo && assignedTo !== 'me' && assignedTo !== 'unassigned' && conversation.assignedTo !== assignedTo) return false;
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);

    if (!includeStats) {
      return NextResponse.json({ conversations });
    }

    return NextResponse.json({
      conversations,
      stats: {
        total: all.length,
        open: all.filter((c) => c.status === 'open').length,
        pending: all.filter((c) => c.status === 'pending').length,
        resolved: all.filter((c) => c.status === 'resolved').length,
        unassigned: all.filter((c) => !c.assignedTo).length,
      },
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return getErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const decodedToken = await authenticateRequest(request);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as Partial<Conversation>;
    const { workspaceId, contact, channel } = body;

    if (!workspaceId || !contact || !channel) {
      return NextResponse.json(
        { error: 'workspaceId, contact, and channel are required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decodedToken.uid);

    const now = new Date().toISOString();

    const docRef = db.collection('conversations').doc();
    const conversation: Conversation = {
      id: docRef.id,
      workspaceId,
      channel,
      channelAccountId: body.channelAccountId ?? '',
      channelAccountName: body.channelAccountName,
      contact,
      status: 'open',
      priority: 'medium',
      assignedTo: decodedToken.uid,
      assignedToName: decodedToken.name ?? decodedToken.email ?? undefined,
      tags: [],
      unreadCount: 0,
      aiEnabled: false,
      aiHandoffRequested: false,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(conversation);
    await db.collection('workspaces').doc(workspaceId).update({
      'usage.conversationsThisMonth': FieldValue.increment(1),
      updatedAt: now,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Create conversation error:', error);
    return getErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const decodedToken = await authenticateRequest(request);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as { id: string } & Partial<Conversation>;
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    await getOwnedConversation(db, id, decodedToken.uid);
    const now = new Date().toISOString();

    // Whitelist fields — never spread untrusted body into Firestore
    const allowed: Record<string, unknown> = { updatedAt: now };
    if (typeof updates.status === 'string') {
      allowed.status = updates.status;
      if (updates.status === 'resolved') allowed.resolvedAt = now;
      else allowed.resolvedAt = null;
    }
    if (typeof updates.assignedTo === 'string' || updates.assignedTo === null) allowed.assignedTo = updates.assignedTo;
    if (typeof updates.assignedToName === 'string' || updates.assignedToName === null) allowed.assignedToName = updates.assignedToName;
    if (typeof updates.priority === 'string') allowed.priority = updates.priority;
    if (Array.isArray(updates.tags)) allowed.tags = updates.tags.slice(0, 30);
    if (typeof updates.aiEnabled === 'boolean') allowed.aiEnabled = updates.aiEnabled;
    if (typeof updates.aiHandoffRequested === 'boolean') allowed.aiHandoffRequested = updates.aiHandoffRequested;
    if (typeof updates.unreadCount === 'number') allowed.unreadCount = Math.max(0, updates.unreadCount);
    if (updates.customFields && typeof updates.customFields === 'object' && !Array.isArray(updates.customFields)) {
      allowed.customFields = updates.customFields;
    }

    await db.collection('conversations').doc(id).update(allowed);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update conversation error:', error);
    return getErrorResponse(error);
  }
}
