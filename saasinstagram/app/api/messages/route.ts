export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { MetaGraphClient } from '@/lib/meta/graph';
import { decryptIfNeeded } from '@/lib/utils/encryption';
import { persistOutboundMessage, sendTextViaMeta } from '@/lib/meta/outbound';
import { translateText } from '@/lib/openai/translation';
import { getOwnedConversation } from '@/lib/workspaces/access';
import type { Message, SendMessagePayload } from '@/types/message';
import type { MetaConnectedChannel } from '@/types/meta';
import type { Conversation } from '@/types/conversation';

function getErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal error';
  const status =
    message === 'conversation_not_found' ? 404 :
    message === 'workspace_forbidden' ? 403 :
    message === 'workspace_not_found' ? 404 :
    message === 'conversation_workspace_missing' ? 422 :
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
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await getOwnedConversation(db, conversationId, decodedToken.uid);
    const snap = await db
      .collection('messages')
      .where('conversationId', '==', conversationId)
      .orderBy('createdAt', 'asc')
      .limitToLast(limit)
      .get();

    const messages = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Message);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return getErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const decodedToken = await authenticateRequest(request);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as SendMessagePayload & { workspaceId: string };
    const { conversationId, workspaceId, type, text, media } = body;

    if (!conversationId || !workspaceId) {
      return NextResponse.json(
        { error: 'conversationId and workspaceId are required' },
        { status: 400 }
      );
    }

    if (type === 'text' && !text?.trim()) {
      return NextResponse.json({ error: 'Text is required for text messages' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const { conversationSnap, conversationData } = await getOwnedConversation(
      db,
      conversationId,
      decodedToken.uid
    );
    const conversation = { id: conversationSnap.id, ...conversationData } as Conversation;

    if (conversation.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId does not match conversation workspace' },
        { status: 422 }
      );
    }

    // Get connected channel. Instagram conversations may store either pageId or IG account ID.
    let channelSnap = await db
      .collection('channels')
      .where('workspaceId', '==', workspaceId)
      .where('pageId', '==', conversation.channelAccountId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (channelSnap.empty) {
      channelSnap = await db
        .collection('channels')
        .where('workspaceId', '==', workspaceId)
        .where('instagramAccountId', '==', conversation.channelAccountId)
        .where('isActive', '==', true)
        .limit(1)
        .get();
    }

    if (channelSnap.empty) {
      channelSnap = await db
        .collection('channels')
        .where('workspaceId', '==', workspaceId)
        .where('instagramAccountIdApi', '==', conversation.channelAccountId)
        .where('isActive', '==', true)
        .limit(1)
        .get();
    }

    if (channelSnap.empty) {
      return NextResponse.json({ error: 'Channel not connected' }, { status: 400 });
    }

    const channelData = { id: channelSnap.docs[0].id, ...channelSnap.docs[0].data() } as MetaConnectedChannel;

    try {
      // Outbound translation — runs inside try so any failure falls back gracefully
      let textToSend = text;
      let translatedTextValue: string | undefined;

      if (type === 'text' && text) {
        try {
          const wsSnap = await db.collection('workspaces').doc(workspaceId).get();
          const wsSettings = wsSnap.data()?.settings as { translationEnabled?: boolean } | undefined;
          const contactLang = conversation.contactLanguage;

          if (wsSettings?.translationEnabled && contactLang) {
            const translated = await translateText(text, contactLang);
            if (translated && translated !== text) {
              translatedTextValue = translated;
              textToSend = translated;
            }
          }
        } catch {
          // Translation failed — send original text unchanged
        }
      }

      // Send via Meta Graph API
      let externalMessageId: string | undefined;
      const accessToken = decryptIfNeeded(channelData.accessToken);
      const client = new MetaGraphClient(accessToken);

      if (type === 'text' && textToSend) {
        const result = await sendTextViaMeta({
          channel: channelData,
          conversation,
          text: textToSend,
        });
        externalMessageId = result.externalMessageId;
      } else if (conversation.channel === 'whatsapp') {
        if (!channelData.phoneNumberId) {
          throw new Error('Phone number ID not configured');
        }

        if ((type === 'image' || type === 'video' || type === 'audio' || type === 'file') && media?.url) {
          const mediaTypeMap: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
            image: 'image',
            video: 'video',
            audio: 'audio',
            file: 'document',
          };
          const result = await client.sendWhatsAppMediaMessage(
            channelData.phoneNumberId,
            conversation.contact.phone ?? conversation.contact.id,
            mediaTypeMap[type] ?? 'document',
            media.url,
            media.caption
          );
          externalMessageId = result.messages?.[0]?.id;
        }
      } else if (conversation.channel === 'facebook') {
        const result = await client.sendMessengerMessage(channelData.pageId, {
          recipient: { id: conversation.contact.id },
          message: text ? { text } : {},
          messaging_type: 'RESPONSE',
        });
        externalMessageId = result.message_id;
      }

      const now = new Date().toISOString();
      const message =
        type === 'text' && text
          ? await persistOutboundMessage({
              channel: conversation.channel,
              conversationId,
              db,
              externalId: externalMessageId,
              generatedByAI: false,
              senderId: decodedToken.uid,
              senderName: decodedToken.name ?? decodedToken.email ?? 'Agent',
              senderType: 'agent',
              text,
              translatedText: translatedTextValue,
              workspaceId,
            })
          : ({
              id: db.collection('messages').doc().id,
              workspaceId,
              conversationId,
              channel: conversation.channel,
              externalId: externalMessageId,
              direction: 'outbound',
              type,
              text,
              media,
              senderId: decodedToken.uid,
              senderName: decodedToken.name ?? decodedToken.email ?? 'Agent',
              senderType: 'agent',
              status: 'sent',
              generatedByAI: false,
              createdAt: now,
              sentAt: now,
            } as Message);

      if (type !== 'text' || !text) {
        await db.collection('messages').doc(message.id).set(message);
        await db.collection('conversations').doc(conversationId).update({
          lastMessage: {
            id: message.id,
            text: text ?? 'Mídia',
            timestamp: now,
            fromAgent: true,
            read: true,
          },
          messageCount: FieldValue.increment(1),
          updatedAt: now,
        });
      }

      return NextResponse.json(message);
    } catch (sendError) {
      console.error('Message send error:', sendError);

      return NextResponse.json(
        { error: 'Failed to send message', details: sendError instanceof Error ? sendError.message : 'Unknown' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Messages API error:', error);
    return getErrorResponse(error);
  }
}
