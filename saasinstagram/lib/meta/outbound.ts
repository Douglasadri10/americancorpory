import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { MetaGraphClient } from '@/lib/meta/graph';
import { decryptIfNeeded } from '@/lib/utils/encryption';
import type { Conversation } from '@/types/conversation';
import type { Message, MessageType } from '@/types/message';
import type { MetaConnectedChannel } from '@/types/meta';

interface SendTextViaMetaParams {
  channel: MetaConnectedChannel;
  conversation: Conversation;
  text: string;
}

interface PersistOutboundMessageParams {
  aiCompletionTokens?: number;
  aiModelUsed?: string;
  aiPromptTokens?: number;
  channel?: Conversation['channel'];
  conversationId: string;
  db: Firestore;
  externalId?: string;
  generatedByAI: boolean;
  messageType?: MessageType;
  senderId: string;
  senderName: string;
  senderType: Message['senderType'];
  text: string;
  translatedText?: string;
  workspaceId: string;
}

export async function sendTextViaMeta(params: SendTextViaMetaParams) {
  const accessToken = decryptIfNeeded(params.channel.accessToken);
  const client = new MetaGraphClient(accessToken);
  const conversation = params.conversation;

  if (conversation.channel === 'whatsapp') {
    if (!params.channel.phoneNumberId) {
      throw new Error('Phone number ID not configured');
    }

    const result = await client.sendWhatsAppTextMessage(
      params.channel.phoneNumberId,
      conversation.contact.phone ?? conversation.contact.id,
      params.text
    );

    return { externalMessageId: result.messages?.[0]?.id };
  }

  if (conversation.channel === 'instagram') {
    const isIgaaToken =
      params.channel.tokenType === 'instagram_igaa' ||
      accessToken.startsWith('IGAA');

    const endpointId = isIgaaToken
      ? (params.channel.instagramAccountIdApi ?? params.channel.instagramAccountId ?? params.channel.pageId)
      : params.channel.pageId;

    const result = await client.sendInstagramMessage(endpointId, conversation.contact.id, {
      text: params.text,
    });

    return { externalMessageId: result.message_id };
  }

  const result = await client.sendMessengerMessage(params.channel.pageId, {
    recipient: { id: conversation.contact.id },
    message: { text: params.text },
    messaging_type: 'RESPONSE',
  });

  return { externalMessageId: result.message_id };
}

export async function persistOutboundMessage(params: PersistOutboundMessageParams) {
  const now = new Date().toISOString();
  const msgRef = params.db.collection('messages').doc();
  const message: Message = {
    id: msgRef.id,
    workspaceId: params.workspaceId,
    conversationId: params.conversationId,
    channel: params.channel,
    externalId: params.externalId,
    direction: 'outbound',
    type: params.messageType ?? 'text',
    text: params.text,
    translatedText: params.translatedText,
    senderId: params.senderId,
    senderName: params.senderName,
    senderType: params.senderType,
    status: params.externalId ? 'sent' : 'sending',
    generatedByAI: params.generatedByAI,
    aiModelUsed: params.aiModelUsed,
    aiPromptTokens: params.aiPromptTokens,
    aiCompletionTokens: params.aiCompletionTokens,
    createdAt: now,
    sentAt: params.externalId ? now : undefined,
  };

  await Promise.all([
    msgRef.set(message),
    params.db.collection('conversations').doc(params.conversationId).update({
      lastMessage: {
        id: msgRef.id,
        text: params.text,
        timestamp: now,
        fromAgent: true,
        read: true,
      },
      messageCount: FieldValue.increment(1),
      updatedAt: now,
    }),
  ]);

  return message;
}
