export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { findMatchingAiAutomation, findMatchingSendMessageAutomation, buildAutomationSystemPrompt } from '@/lib/automation/runtime';
import { resolveKnowledgeBlocks, formatKnowledgeContext } from '@/lib/knowledge/retrieval';
import { classifyAndUpdateLead } from '@/lib/leads/classifier';
import { buildScheduleContext } from '@/lib/appointments/context';
import { normalizeMessengerMessage, normalizeWhatsAppMessage } from '@/lib/meta/normalizer';
import { MetaGraphClient } from '@/lib/meta/graph';
import { sendTextViaMeta, persistOutboundMessage } from '@/lib/meta/outbound';
import {
  verifyWebhookSignature,
  verifyWebhookChallenge,
  parseWebhookPayload,
  getChannelFromObject,
  extractMessagingEvents,
  extractWhatsAppMessages,
  extractWhatsAppStatuses,
} from '@/lib/meta/webhook';
import { generateChatCompletion } from '@/lib/openai/client';
import { transcribeAudio } from '@/lib/openai/client';
import { buildMessageHistory } from '@/lib/openai/prompts';
import { getContactDisplayName, isPlaceholderContactName, normalizeContactUsername } from '@/lib/conversations/display';
import { decryptIfNeeded } from '@/lib/utils/encryption';
import type { Conversation, ConversationParticipant } from '@/types/conversation';
import type { Message } from '@/types/message';
import type { MetaConnectedChannel, MetaMessagingEvent, MetaWhatsAppMessage } from '@/types/meta';

type Db = ReturnType<typeof getAdminFirestore>;
type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'security' | 'processing' | 'automation' | 'ai';

type StoredChannel = MetaConnectedChannel & {
  instagramAccountId?: string;
  instagramAccountIdApi?: string;
  tokenType?: string;
};

interface SaveLogInput {
  level: LogLevel;
  category?: LogCategory;
  event: string;
  details?: Record<string, unknown>;
  requestId?: string;
  workspaceId?: string;
  conversationId?: string;
  automationId?: string;
  channelId?: string;
}

interface EnsureConversationParams {
  db: Db;
  workspaceId: string;
  channel: Conversation['channel'];
  connectedChannel: StoredChannel;
  contact: ConversationParticipant;
}

function resolveChannelAccessToken(channel: StoredChannel) {
  return decryptIfNeeded(channel.accessToken);
}

function createRequestId(rawBody: string) {
  return crypto.createHash('sha1').update(rawBody).digest('hex').slice(0, 16);
}

function buildInstagramProfileUrl(username?: string | null) {
  const normalized = normalizeContactUsername(username);
  return normalized ? `https://instagram.com/${normalized}` : undefined;
}

function getMessagePreview(text?: string | null) {
  return text?.slice(0, 120) ?? null;
}

function pickContactName(contactId: string, name?: string | null, username?: string | null) {
  return getContactDisplayName({
    id: contactId,
    name: name ?? undefined,
    username: username ?? undefined,
  });
}

function mergeConversationContact(
  existing: ConversationParticipant | undefined,
  incoming: ConversationParticipant
) {
  const existingUsername = normalizeContactUsername(existing?.username);
  const incomingUsername = normalizeContactUsername(incoming.username);
  const hasExistingRealName = !!existing?.name && !isPlaceholderContactName(existing.name);
  const hasIncomingRealName = !!incoming.name && !isPlaceholderContactName(incoming.name);

  const merged: ConversationParticipant = {
    id: incoming.id || existing?.id || '',
    name: incoming.name,
    username: incomingUsername ?? existingUsername,
    avatarURL: incoming.avatarURL ?? existing?.avatarURL,
    profileURL: incoming.profileURL ?? existing?.profileURL,
    phone: incoming.phone ?? existing?.phone,
    email: incoming.email ?? existing?.email,
  };

  if (hasIncomingRealName) {
    merged.name = incoming.name.trim();
  } else if (hasExistingRealName && existing?.name) {
    merged.name = existing.name.trim();
  } else {
    merged.name = pickContactName(merged.id, incoming.name ?? existing?.name, merged.username);
  }

  if (!merged.profileURL && merged.username) {
    merged.profileURL = buildInstagramProfileUrl(merged.username);
  }

  return merged;
}

async function saveLog(db: Db, input: SaveLogInput) {
  try {
    await db.collection('webhookLogs').add({
      level: input.level,
      category: input.category ?? 'processing',
      event: input.event,
      details: input.details ?? {},
      requestId: input.requestId ?? null,
      workspaceId: input.workspaceId ?? null,
      conversationId: input.conversationId ?? null,
      automationId: input.automationId ?? null,
      channelId: input.channelId ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // non-critical
  }
}

async function findConnectedChannelForEntry(db: Db, entryId: string) {
  const queries = [
    db.collection('channels').where('instagramAccountId', '==', entryId).where('connected', '==', true).limit(1),
    db.collection('channels').where('instagramAccountIdApi', '==', entryId).where('connected', '==', true).limit(1),
    db.collection('channels').where('pageId', '==', entryId).where('connected', '==', true).limit(1),
  ];

  for (const query of queries) {
    const snap = await query.get();
    if (!snap.empty) {
      return {
        id: snap.docs[0].id,
        ...snap.docs[0].data(),
      } as StoredChannel;
    }
  }

  return null;
}

async function resolveWorkspaceContextForPayload(db: Db, rawBody: string) {
  try {
    const body = JSON.parse(rawBody) as { entry?: Array<{ id?: string }> };
    const entryId = body.entry?.[0]?.id;
    if (!entryId) {
      return {};
    }

    const channel = await findConnectedChannelForEntry(db, entryId);
    if (!channel) {
      return {};
    }

    return {
      channelId: channel.id,
      workspaceId: channel.workspaceId,
    };
  } catch {
    return {};
  }
}

async function findMessageByExternalId(db: Db, externalId?: string | null) {
  if (!externalId) {
    return null;
  }

  const snap = await db.collection('messages').where('externalId', '==', externalId).limit(1).get();
  if (snap.empty) {
    return null;
  }

  return {
    messageId: snap.docs[0].id,
    data: snap.docs[0].data(),
  };
}

async function resolveInstagramContactProfile(channel: StoredChannel, contactId: string) {
  if (channel.channel !== 'instagram') {
    return {};
  }

  try {
    const accessToken = resolveChannelAccessToken(channel);
    // IGAA tokens belong to the Instagram Graph API; older EAA tokens use Facebook Graph API
    const isIgaaToken = accessToken.startsWith('IGAA') || channel.tokenType === 'instagram_igaa';
    const apiBase = isIgaaToken ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';

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
      username: data.username,
      avatarURL: data.profile_pic,
      profileURL: buildInstagramProfileUrl(data.username),
    };
  } catch {
    return {};
  }
}

async function ensureConversationForContact(params: EnsureConversationParams) {
  const { db, workspaceId, channel, connectedChannel, contact } = params;
  const now = new Date().toISOString();
  const conversationSnap = await db
    .collection('conversations')
    .where('workspaceId', '==', workspaceId)
    .where('contact.id', '==', contact.id)
    .where('channel', '==', channel)
    .limit(20)
    .get();

  const conversations = conversationSnap.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }) as Conversation)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const existingConversation = conversations[0];

  if (!existingConversation) {
    const ref = db.collection('conversations').doc();
    const conversation: Conversation = {
      id: ref.id,
      workspaceId,
      channel,
      channelAccountId: connectedChannel.pageId,
      channelAccountName: connectedChannel.pageName ?? 'Instagram',
      contact: mergeConversationContact(undefined, contact),
      status: 'open',
      priority: 'medium',
      assignedTo: undefined,
      assignedToName: undefined,
      tags: [],
      unreadCount: 0,
      aiEnabled: false,
      aiHandoffRequested: false,
      source: 'dm',
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(conversation);

    // Increment conversation usage counter
    await db.collection('workspaces').doc(workspaceId).update({
      'usage.conversationsThisMonth': FieldValue.increment(1),
      updatedAt: now,
    });

    // Auto-create lead for every new conversation
    const leadRef = db.collection('leads').doc();
    await leadRef.set({
      id: leadRef.id,
      workspaceId,
      name: contact.name ?? contact.username ?? 'Novo Lead',
      status: 'new',
      source: channel,
      conversationIds: [ref.id],
      // Preserve contact identifiers and avatar for display
      avatarURL: contact.avatarURL ?? null,
      instagramId: channel === 'instagram' ? contact.id : undefined,
      instagramUsername: channel === 'instagram' ? (contact.username ?? undefined) : undefined,
      facebookId: channel === 'facebook' ? contact.id : undefined,
      whatsappPhone: channel === 'whatsapp' ? (contact.phone ?? undefined) : undefined,
      tags: [],
      customFields: [],
      activities: [],
      createdAt: now,
      updatedAt: now,
    });
    await db.collection('conversations').doc(ref.id).update({
      leadId: leadRef.id,
      updatedAt: now,
    });

    return { conversation, ref, wasCreated: true };
  }

  const mergedContact = mergeConversationContact(existingConversation.contact, contact);
  const needsContactUpdate =
    mergedContact.name !== existingConversation.contact.name ||
    mergedContact.username !== existingConversation.contact.username ||
    mergedContact.avatarURL !== existingConversation.contact.avatarURL ||
    mergedContact.profileURL !== existingConversation.contact.profileURL;

  if (needsContactUpdate) {
    await db.collection('conversations').doc(existingConversation.id).update({
      contact: mergedContact,
      updatedAt: now,
    });
  }

  // Create lead retroactively if this conversation doesn't have one yet
  if (!existingConversation.leadId) {
    const leadRef = db.collection('leads').doc();
    await leadRef.set({
      id: leadRef.id,
      workspaceId,
      name: mergedContact.name ?? mergedContact.username ?? 'Novo Lead',
      status: 'new',
      source: channel,
      conversationIds: [existingConversation.id],
      tags: [],
      customFields: [],
      activities: [],
      createdAt: now,
      updatedAt: now,
    });
    await db.collection('conversations').doc(existingConversation.id).update({
      leadId: leadRef.id,
      updatedAt: now,
    });
  }

  return {
    conversation: {
      ...existingConversation,
      contact: mergedContact,
      updatedAt: needsContactUpdate ? now : existingConversation.updatedAt,
    },
    ref: db.collection('conversations').doc(existingConversation.id),
    wasCreated: false,
  };
}

async function persistInboundMessage(params: {
  db: Db;
  conversation: Conversation;
  conversationRef: DocumentReference;
  message: Partial<Message>;
  unreadCount: number;
}) {
  const now = new Date().toISOString();
  const msgRef = params.db.collection('messages').doc();
  const record: Message = {
    id: msgRef.id,
    ...params.message,
    workspaceId: params.conversation.workspaceId,
    conversationId: params.conversation.id,
    channel: params.conversation.channel,
    senderId: params.message.senderId ?? params.conversation.contact.id,
    senderName: params.message.senderName ?? getContactDisplayName(params.conversation.contact),
    senderType: params.message.senderType ?? 'contact',
    generatedByAI: params.message.generatedByAI ?? false,
    status: params.message.status ?? 'delivered',
    createdAt: params.message.createdAt ?? now,
  } as Message;

  await Promise.all([
    msgRef.set(record),
    params.conversationRef.update({
      unreadCount: params.unreadCount,
      lastMessage: {
        id: msgRef.id,
        text: params.message.text ?? 'Mídia',
        timestamp: now,
        fromAgent: params.message.direction === 'outbound',
        read: params.message.direction === 'outbound',
      },
      updatedAt: now,
    }),
  ]);

  return record;
}

async function transcribeInboundAudioMessage(params: {
  connectedChannel: StoredChannel;
  conversationId: string;
  db: Db;
  message: Partial<Message>;
  requestId: string;
  whatsappMessage?: MetaWhatsAppMessage;
  workspaceId: string;
}) {
  const { connectedChannel, conversationId, db, message, requestId, whatsappMessage, workspaceId } = params;

  if (message.type !== 'audio') {
    return message;
  }

  const nextMedia = (mimeType?: string, fileSize?: number) => (
    message.media
      ? {
          ...message.media,
          ...(mimeType ? { mimeType } : {}),
          ...(typeof fileSize === 'number' ? { fileSize } : {}),
        }
      : undefined
  );

  try {
    const accessToken = resolveChannelAccessToken(connectedChannel);
    const client = new MetaGraphClient(accessToken);
    let audioBuffer: Buffer | null = null;
    let mimeType = message.media?.mimeType;
    let fileSize = message.media?.fileSize;

    if (whatsappMessage?.audio?.id) {
      const mediaInfo = await client.getWhatsAppMediaUrl(whatsappMessage.audio.id);
      const download = await client.downloadMedia(mediaInfo.url);
      audioBuffer = download.buffer;
      mimeType = download.mimeType ?? mediaInfo.mime_type ?? mimeType;
      fileSize = mediaInfo.file_size ?? download.fileSize ?? fileSize;
    } else if (message.media?.url) {
      const download = await client.downloadMedia(message.media.url);
      audioBuffer = download.buffer;
      mimeType = download.mimeType ?? mimeType;
      fileSize = download.fileSize ?? fileSize;
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        ...message,
        media: nextMedia(mimeType, fileSize),
      };
    }

    const transcription = await transcribeAudio({
      audio: audioBuffer,
      fileName: `message-${message.externalId ?? conversationId}.audio`,
      mimeType,
    });

    const transcript = transcription.text.trim();
    if (!transcript) {
      return {
        ...message,
        media: nextMedia(mimeType, fileSize),
      };
    }

    await saveLog(db, {
      level: 'info',
      category: 'ai',
      event: 'audio_transcribed',
      requestId,
      workspaceId,
      conversationId,
      channelId: connectedChannel.id,
      details: {
        externalId: message.externalId ?? null,
        language: transcription.language ?? null,
        preview: getMessagePreview(transcript),
      },
    });

    return {
      ...message,
      text: transcript,
      media: nextMedia(mimeType, fileSize),
    };
  } catch (error) {
    await saveLog(db, {
      level: 'error',
      category: 'ai',
      event: 'audio_transcription_error',
      requestId,
      workspaceId,
      conversationId,
      channelId: connectedChannel.id,
      details: {
        externalId: message.externalId ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return message;
  }
}

/**
 * Resolve the image URL for AI vision input.
 * - Instagram: CDN URL is publicly accessible, return as-is.
 * - WhatsApp: media URL requires auth; download and return as base64 data URL.
 */
async function resolveInboundImageForAI(params: {
  connectedChannel: StoredChannel;
  message: Partial<Message>;
  whatsappMessage?: MetaWhatsAppMessage;
}): Promise<string | undefined> {
  const { connectedChannel, message, whatsappMessage } = params;
  if (message.type !== 'image' && message.type !== 'sticker') return undefined;

  try {
    // Instagram / Facebook: CDN URL is directly usable by OpenAI
    if (connectedChannel.channel !== 'whatsapp') {
      return message.media?.url || undefined;
    }

    // WhatsApp: must resolve media ID → URL → download → base64
    const imageId = whatsappMessage?.image?.id ?? whatsappMessage?.sticker?.id;
    if (!imageId) return undefined;

    const client = new MetaGraphClient(resolveChannelAccessToken(connectedChannel));
    const mediaInfo = await client.getWhatsAppMediaUrl(imageId);
    const download = await client.downloadMedia(mediaInfo.url);
    if (!download.buffer || download.buffer.length === 0) return undefined;

    const mimeType = download.mimeType ?? mediaInfo.mime_type ?? 'image/jpeg';
    const b64 = download.buffer.toString('base64');
    return `data:${mimeType};base64,${b64}`;
  } catch {
    return undefined;
  }
}

async function runSendMessageAutomation(params: {
  db: Db;
  workspaceId: string;
  channel: Conversation['channel'];
  connectedChannel: StoredChannel;
  conversation: Conversation;
  incomingText: string;
  incomingImageUrl?: string;
  requestId: string;
}) {
  const { db, workspaceId, channel, connectedChannel, conversation, incomingText, requestId } = params;

  let automationMatch: Awaited<ReturnType<typeof findMatchingSendMessageAutomation>> = null;

  try {
    automationMatch = await findMatchingSendMessageAutomation({
      db,
      workspaceId,
      channel,
      conversation,
      incomingText,
    });

    if (!automationMatch) {
      return;
    }

    const rawMessage = automationMatch.action.message ?? '';
    const messageText = rawMessage.replace(/\{\{contact\.name\}\}/g, conversation.contact.name ?? '');

    if (!messageText.trim()) {
      throw new Error('empty_send_message_template');
    }

    await saveLog(db, {
      level: 'info',
      category: 'automation',
      event: 'automation_matched',
      requestId,
      workspaceId,
      conversationId: conversation.id,
      automationId: automationMatch.automation.id,
      channelId: connectedChannel.id,
      details: {
        automationName: automationMatch.automation.name,
        actionId: automationMatch.action.id,
        actionType: 'send_message',
      },
    });

    const sendResult = await sendTextViaMeta({
      channel: connectedChannel,
      conversation,
      text: messageText,
    });

    await Promise.all([
      persistOutboundMessage({
        db,
        workspaceId,
        conversationId: conversation.id,
        channel,
        text: messageText,
        senderId: 'automation',
        senderName: automationMatch.automation.name,
        senderType: 'bot',
        generatedByAI: false,
        externalId: sendResult.externalMessageId,
      }),
      db.collection('automations').doc(automationMatch.automation.id).update({
        'stats.totalTriggered': FieldValue.increment(1),
        'stats.totalActionsExecuted': FieldValue.increment(1),
        'stats.lastTriggeredAt': new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      db.collection('automationLogs').add({
        automationId: automationMatch.automation.id,
        workspaceId,
        conversationId: conversation.id,
        triggeredAt: new Date().toISOString(),
        actionsExecuted: [
          {
            actionId: automationMatch.action.id,
            actionType: automationMatch.action.type,
            success: true,
            executedAt: new Date().toISOString(),
          },
        ],
        status: 'success',
      }),
    ]);

    await saveLog(db, {
      level: 'info',
      category: 'automation',
      event: 'send_message_sent',
      requestId,
      workspaceId,
      conversationId: conversation.id,
      automationId: automationMatch.automation.id,
      channelId: connectedChannel.id,
      details: {
        preview: getMessagePreview(messageText),
      },
    });
  } catch (error) {
    if (automationMatch) {
      await Promise.all([
        db.collection('automations').doc(automationMatch.automation.id).update({
          'stats.totalTriggered': FieldValue.increment(1),
          'stats.lastTriggeredAt': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        db.collection('automationLogs').add({
          automationId: automationMatch.automation.id,
          workspaceId,
          conversationId: conversation.id,
          triggeredAt: new Date().toISOString(),
          actionsExecuted: [
            {
              actionId: automationMatch.action.id,
              actionType: automationMatch.action.type,
              success: false,
              errorMessage: error instanceof Error ? error.message : String(error),
              executedAt: new Date().toISOString(),
            },
          ],
          status: 'failed',
        }),
      ]);
    }

    await saveLog(db, {
      level: 'error',
      category: 'automation',
      event: 'send_message_error',
      requestId,
      workspaceId,
      conversationId: conversation.id,
      automationId: automationMatch?.automation.id,
      channelId: connectedChannel.id,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function runAiAutomationReply(params: {
  db: Db;
  workspaceId: string;
  channel: Conversation['channel'];
  connectedChannel: StoredChannel;
  conversation: Conversation;
  conversationRef: DocumentReference;
  incomingText: string;
  incomingImageUrl?: string;
  requestId: string;
}) {
  const { db, workspaceId, channel, connectedChannel, conversation, conversationRef, incomingText, incomingImageUrl, requestId } = params;
  let automationMatch: Awaited<ReturnType<typeof findMatchingAiAutomation>> = null;
  // Declared outside try so the catch block can read them for rollback
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const isNewInteraction = (conversation as { aiInteractionMonth?: string | null }).aiInteractionMonth !== currentMonth;
  let slotReserved = false;

  try {
    const [workspaceSnap, matchedAutomation] = await Promise.all([
      db.collection('workspaces').doc(workspaceId).get(),
      findMatchingAiAutomation({
        db,
        workspaceId,
        channel,
        conversation,
        incomingText,
      }),
    ]);

    automationMatch = matchedAutomation;

    if (!automationMatch) {
      await conversationRef.update({
        aiEnabled: false,
        updatedAt: new Date().toISOString(),
      });
      await saveLog(db, {
        level: 'info',
        category: 'automation',
        event: 'automation_not_matched',
        requestId,
        workspaceId,
        conversationId: conversation.id,
        channelId: connectedChannel.id,
        details: {
          channel,
          incomingPreview: getMessagePreview(incomingText),
        },
      });
      return;
    }

    const wsData = workspaceSnap.data() as Record<string, unknown> | undefined;

    // Guard: AI limits — atomic pre-increment to prevent race conditions between concurrent webhooks

    try {
      await db.runTransaction(async (tx) => {
        const wsRef = db.collection('workspaces').doc(workspaceId);
        const freshWs = await tx.get(wsRef);
        const freshUsage = freshWs.data()?.usage as Record<string, number> | undefined ?? {};
        const freshLimits = freshWs.data()?.limits as Record<string, number> | undefined ?? {};

        const msgLimit = freshLimits.aiMessagesPerMonth ?? -1;
        if (msgLimit !== -1 && (freshUsage.aiMessagesThisMonth ?? 0) >= msgLimit) {
          throw new Error('ai_message_limit_reached');
        }

        if (isNewInteraction) {
          const interactLimit = freshLimits.aiInteractionsPerMonth ?? -1;
          if (interactLimit !== -1 && (freshUsage.aiInteractionsThisMonth ?? 0) >= interactLimit) {
            throw new Error('ai_interaction_limit_reached');
          }
        }

        // Reserve the slot atomically — counts are pre-incremented before the AI call
        const slotUpdate: Record<string, unknown> = {
          'usage.aiMessagesThisMonth': FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        };
        if (isNewInteraction) {
          slotUpdate['usage.aiInteractionsThisMonth'] = FieldValue.increment(1);
        }
        tx.update(wsRef, slotUpdate);
      });
      slotReserved = true;
    } catch (err) {
      if (err instanceof Error && (err.message === 'ai_message_limit_reached' || err.message === 'ai_interaction_limit_reached')) {
        return; // Limit reached — skip AI silently
      }
      throw err;
    }

    const workspace = wsData as {
      name?: string;
      settings?: { aiModel?: string; aiPersonality?: string; language?: string };
    } | undefined;
    const model = automationMatch.action.aiModel || workspace?.settings?.aiModel || 'gpt-4o-mini';
    const maxTokens = automationMatch.action.aiMaxTokens ?? 300;

    await saveLog(db, {
      level: 'info',
      category: 'automation',
      event: 'automation_matched',
      requestId,
      workspaceId,
      conversationId: conversation.id,
      automationId: automationMatch.automation.id,
      channelId: connectedChannel.id,
      details: {
        automationName: automationMatch.automation.name,
        actionId: automationMatch.action.id,
        model,
      },
    });

    const messagesSnap = await db
      .collection('messages')
      .where('conversationId', '==', conversation.id)
      .get();

    const history = buildMessageHistory(
      messagesSnap.docs
        .map((doc) => doc.data() as { text?: string; senderType: string; direction: string; createdAt?: string; type?: string; media?: { url?: string; mimeType?: string } })
        .sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
        .slice(-20)
    );

    const knowledgeBlocks = await resolveKnowledgeBlocks({
      db,
      workspaceId,
      messageText: incomingText,
    }).catch(() => []);

    const scheduleContext = await buildScheduleContext({
      db,
      workspaceId,
      messageText: incomingText,
      workspace: workspace as import('@/types/workspace').Workspace | null | undefined,
    }).catch(() => '');

    const knowledgeContext = [
      formatKnowledgeContext(knowledgeBlocks),
      scheduleContext,
    ].filter(Boolean).join('\n\n');

    const systemPrompt = buildAutomationSystemPrompt({
      action: automationMatch.action,
      fallbackPrompt: workspace?.settings?.aiPersonality,
      workspaceLanguage: workspace?.settings?.language,
      workspaceName: workspace?.name,
      contactName: conversation.contact.name,
      channel,
      knowledgeContext,
    });

    // Fallback message when there's no history yet:
    // - text only → plain string
    // - image (+ optional caption) → multimodal content block
    const fallbackMessage: { role: 'user'; content: import('@/lib/openai/client').MessageContent } =
      incomingImageUrl
        ? {
            role: 'user',
            content: [
              ...(incomingText ? [{ type: 'text' as const, text: incomingText }] : []),
              { type: 'image_url' as const, image_url: { url: incomingImageUrl, detail: 'low' as const } },
            ],
          }
        : { role: 'user', content: incomingText || '...' };

    const aiResult = await generateChatCompletion({
      systemPrompt,
      model,
      maxTokens,
      temperature: 0.4,
      messages: history.length > 0 ? history : [fallbackMessage],
    });

    const aiText = aiResult.content.trim();
    if (!aiText) {
      throw new Error('empty_ai_response');
    }

    const sendResult = await sendTextViaMeta({
      channel: connectedChannel,
      conversation,
      text: aiText,
    });

    await Promise.all([
      persistOutboundMessage({
        db,
        workspaceId,
        conversationId: conversation.id,
        channel,
        text: aiText,
        senderId: 'hanna-ai',
        senderName: 'HannaAI',
        senderType: 'bot',
        generatedByAI: true,
        externalId: sendResult.externalMessageId,
        aiModelUsed: aiResult.model,
        aiPromptTokens: aiResult.promptTokens,
        aiCompletionTokens: aiResult.completionTokens,
      }),
      conversationRef.update({
        aiEnabled: true,
        customFields: {
          ...(conversation.customFields ?? {}),
          lastAutomationId: automationMatch.automation.id,
        },
        updatedAt: new Date().toISOString(),
      }),
      // Counts already pre-incremented atomically in the transaction above
      db.collection('workspaces').doc(workspaceId).update({
        updatedAt: new Date().toISOString(),
      }),
      ...(isNewInteraction ? [
        conversationRef.update({ aiInteractionMonth: currentMonth }),
      ] : []),
      db.collection('automations').doc(automationMatch.automation.id).update({
        'stats.totalTriggered': FieldValue.increment(1),
        'stats.totalActionsExecuted': FieldValue.increment(1),
        'stats.lastTriggeredAt': new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      db.collection('automationLogs').add({
        automationId: automationMatch.automation.id,
        workspaceId,
        conversationId: conversation.id,
        triggeredAt: new Date().toISOString(),
        actionsExecuted: [
          {
            actionId: automationMatch.action.id,
            actionType: automationMatch.action.type,
            success: true,
            executedAt: new Date().toISOString(),
          },
        ],
        status: 'success',
      }),
    ]);

    await saveLog(db, {
      level: 'info',
      category: 'ai',
      event: 'ai_sent',
      requestId,
      workspaceId,
      conversationId: conversation.id,
      automationId: automationMatch.automation.id,
      channelId: connectedChannel.id,
      details: {
        model: aiResult.model,
        preview: getMessagePreview(aiText),
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
      },
    });
  } catch (error) {
    // Roll back pre-incremented usage slots if AI failed after reservation
    if (slotReserved) {
      await db.collection('workspaces').doc(workspaceId).update({
        'usage.aiMessagesThisMonth': FieldValue.increment(-1),
        ...(isNewInteraction ? { 'usage.aiInteractionsThisMonth': FieldValue.increment(-1) } : {}),
        updatedAt: new Date().toISOString(),
      }).catch(() => {}); // non-fatal — prefer a slightly off counter over throwing
    }

    if (automationMatch) {
      await Promise.all([
        db.collection('automations').doc(automationMatch.automation.id).update({
          'stats.totalTriggered': FieldValue.increment(1),
          'stats.lastTriggeredAt': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        db.collection('automationLogs').add({
          automationId: automationMatch.automation.id,
          workspaceId,
          conversationId: conversation.id,
          triggeredAt: new Date().toISOString(),
          actionsExecuted: [
            {
              actionId: automationMatch.action.id,
              actionType: automationMatch.action.type,
              success: false,
              errorMessage: error instanceof Error ? error.message : String(error),
              executedAt: new Date().toISOString(),
            },
          ],
          status: 'failed',
        }),
      ]);
    }

    await saveLog(db, {
      level: 'error',
      category: 'ai',
      event: 'ai_error',
      requestId,
      workspaceId,
      conversationId: conversation.id,
      automationId: automationMatch?.automation.id,
      channelId: connectedChannel.id,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function processFetchedInstagramTextMessage(params: {
  db: Db;
  workspaceId: string;
  connectedChannel: StoredChannel;
  senderId: string;
  senderName?: string;
  senderUsername?: string;
  messageText: string;
  externalId: string;
  requestId: string;
}) {
  const { db, workspaceId, connectedChannel, senderId, senderName, senderUsername, messageText, externalId, requestId } = params;
  const duplicate = await findMessageByExternalId(db, externalId);
  if (duplicate) {
    await saveLog(db, {
      level: 'warn',
      category: 'processing',
      event: 'duplicate_message',
      requestId,
      workspaceId,
      channelId: connectedChannel.id,
      details: {
        externalId,
        messageId: duplicate.messageId,
      },
    });
    return;
  }

  const profile = await resolveInstagramContactProfile(connectedChannel, senderId);
  const contact: ConversationParticipant = {
    id: senderId,
    name: pickContactName(senderId, senderName ?? profile.name, senderUsername ?? profile.username),
    username: normalizeContactUsername(senderUsername ?? profile.username),
    avatarURL: profile.avatarURL,
    profileURL: buildInstagramProfileUrl(senderUsername ?? profile.username),
  };

  const { conversation, ref, wasCreated } = await ensureConversationForContact({
    db,
    workspaceId,
    channel: 'instagram',
    connectedChannel,
    contact,
  });

  const message = await persistInboundMessage({
    db,
    conversation,
    conversationRef: ref,
    unreadCount: wasCreated ? 1 : (conversation.unreadCount ?? 0) + 1,
    message: {
      externalId,
      direction: 'inbound',
      type: 'text',
      text: messageText,
      senderId,
      senderName: getContactDisplayName(contact),
      senderType: 'contact',
      status: 'delivered',
      generatedByAI: false,
    },
  });

  await saveLog(db, {
    level: 'info',
    category: 'processing',
    event: 'message_saved',
    requestId,
    workspaceId,
    conversationId: conversation.id,
    channelId: connectedChannel.id,
    details: {
      externalId,
      messageId: message.id,
      preview: getMessagePreview(messageText),
      source: 'igaa_fetch',
    },
  });

  // Fire-and-forget lead classification (non-blocking)
  if (conversation.leadId) {
    void classifyAndUpdateLead({
      db,
      workspaceId,
      leadId: conversation.leadId,
      messageText,
    }).catch(() => null);
  }

  await runSendMessageAutomation({
    db,
    workspaceId,
    channel: 'instagram',
    connectedChannel,
    conversation,
    incomingText: messageText,
    requestId,
  });

  await runAiAutomationReply({
    db,
    workspaceId,
    channel: 'instagram',
    connectedChannel,
    conversation,
    conversationRef: ref,
    incomingText: messageText,
    requestId,
  });
}

async function processMessagingEvent(params: {
  db: Db;
  workspaceId: string;
  channel: 'instagram' | 'facebook';
  connectedChannel: StoredChannel;
  event: MetaMessagingEvent;
  requestId: string;
}) {
  const { db, workspaceId, channel, connectedChannel, event, requestId } = params;

  await saveLog(db, {
    level: 'info',
    category: 'processing',
    event: 'event_received',
    requestId,
    workspaceId,
    channelId: connectedChannel.id,
    details: {
      hasMessage: !!event.message,
      isEcho: event.message?.is_echo ?? false,
      senderId: event.sender?.id,
      recipientId: event.recipient?.id,
      preview: getMessagePreview(event.message?.text),
    },
  });

  const rawEvent = event as unknown as Record<string, unknown>;
  const messageEdit = rawEvent.message_edit as { mid: string; num_edit: number } | undefined;

  if (!event.message && messageEdit && messageEdit.num_edit === 0) {
    const accessToken = resolveChannelAccessToken(connectedChannel);
    const isIgaaToken = accessToken.startsWith('IGAA') || connectedChannel.tokenType === 'instagram_igaa';
    const apiBase = isIgaaToken ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';

    try {
      const response = await fetch(
        `${apiBase}/${messageEdit.mid}?fields=id,message,from,to`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json() as {
        from?: { id: string; username?: string; name?: string };
        message?: string;
      };

      if (!response.ok || !data.from?.id || !data.message) {
        throw new Error(`fetch_message_failed_${response.status}`);
      }

      const businessIds = [
        connectedChannel.instagramAccountId,
        connectedChannel.instagramAccountIdApi,
        connectedChannel.pageId,
      ].filter(Boolean);

      if (!businessIds.includes(data.from.id)) {
        await processFetchedInstagramTextMessage({
          db,
          workspaceId,
          connectedChannel,
          senderId: data.from.id,
          senderName: data.from.name,
          senderUsername: data.from.username,
          messageText: data.message,
          externalId: messageEdit.mid,
          requestId,
        });
      }
    } catch (error) {
      await saveLog(db, {
        level: 'error',
        category: 'processing',
        event: 'fetch_message_error',
        requestId,
        workspaceId,
        channelId: connectedChannel.id,
        details: {
          error: error instanceof Error ? error.message : String(error),
          externalId: messageEdit.mid,
        },
      });
    }

    return;
  }

  if (!event.message) {
    return;
  }

  const normalized = normalizeMessengerMessage(event, workspaceId, 'pending', channel);
  const externalId = normalized.externalId;
  const duplicate = await findMessageByExternalId(db, externalId);

  if (duplicate) {
    await saveLog(db, {
      level: 'warn',
      category: 'processing',
      event: 'duplicate_message',
      requestId,
      workspaceId,
      channelId: connectedChannel.id,
      details: {
        externalId,
        messageId: duplicate.messageId,
      },
    });
    return;
  }

  const isEcho = event.message.is_echo ?? false;
  const contactId = isEcho ? event.recipient.id : event.sender.id;
  const profile = !isEcho && channel === 'instagram'
    ? await resolveInstagramContactProfile(connectedChannel, contactId)
    : {};

  const contact: ConversationParticipant = {
    id: contactId,
    name: pickContactName(contactId, profile.name, profile.username),
    username: normalizeContactUsername(profile.username),
    avatarURL: profile.avatarURL,
    profileURL: buildInstagramProfileUrl(profile.username),
  };

  const { conversation, ref, wasCreated } = await ensureConversationForContact({
    db,
    workspaceId,
    channel,
    connectedChannel,
    contact,
  });

  const messageForStorage = !isEcho && normalized.direction === 'inbound' && normalized.type === 'audio'
    ? await transcribeInboundAudioMessage({
        db,
        workspaceId,
        connectedChannel,
        conversationId: conversation.id,
        requestId,
        message: normalized,
      })
    : normalized;

  const savedMessage = await persistInboundMessage({
    db,
    conversation,
    conversationRef: ref,
    unreadCount: isEcho ? conversation.unreadCount ?? 0 : (wasCreated ? 1 : (conversation.unreadCount ?? 0) + 1),
    message: {
      ...messageForStorage,
      conversationId: conversation.id,
      senderName: isEcho ? connectedChannel.pageName ?? 'Equipe' : getContactDisplayName(contact),
      senderType: isEcho ? 'agent' : 'contact',
    },
  });

  await saveLog(db, {
    level: 'info',
    category: 'processing',
    event: 'message_saved',
    requestId,
    workspaceId,
    conversationId: conversation.id,
    channelId: connectedChannel.id,
    details: {
      messageId: savedMessage.id,
      externalId,
      direction: savedMessage.direction,
      preview: getMessagePreview(savedMessage.text),
    },
  });

  const inboundText = messageForStorage.direction === 'inbound'
    ? messageForStorage.text?.trim()
    : undefined;

  // Resolve image URL for AI vision (Instagram CDN URL is publicly accessible)
  const inboundImageUrl = !isEcho && messageForStorage.direction === 'inbound'
    ? await resolveInboundImageForAI({ connectedChannel, message: messageForStorage })
    : undefined;

  if (!isEcho && (inboundText || inboundImageUrl)) {
    const mergedConversation = {
      ...conversation,
      contact: mergeConversationContact(conversation.contact, contact),
      unreadCount: wasCreated ? 1 : (conversation.unreadCount ?? 0) + 1,
    };

    // Fire-and-forget lead classification (text only)
    if (mergedConversation.leadId && inboundText) {
      void classifyAndUpdateLead({
        db,
        workspaceId,
        leadId: mergedConversation.leadId,
        messageText: inboundText,
      }).catch(() => null);
    }

    await runSendMessageAutomation({
      db,
      workspaceId,
      channel,
      connectedChannel,
      conversation: mergedConversation,
      incomingText: inboundText ?? '',
      incomingImageUrl: inboundImageUrl,
      requestId,
    });

    await runAiAutomationReply({
      db,
      workspaceId,
      channel,
      connectedChannel,
      conversation: mergedConversation,
      conversationRef: ref,
      incomingText: inboundText ?? '',
      incomingImageUrl: inboundImageUrl,
      requestId,
    });
  }
}

async function processWhatsAppMessage(params: {
  db: Db;
  workspaceId: string;
  connectedChannel: StoredChannel;
  item: {
    message: import('@/types/meta').MetaWhatsAppMessage;
    contacts: Array<{ profile: { name: string }; wa_id: string }>;
    metadata: { display_phone_number: string; phone_number_id: string };
    pageId: string;
  };
  requestId: string;
}) {
  const { db, workspaceId, connectedChannel, item, requestId } = params;
  const { message, contacts } = item;
  const duplicate = await findMessageByExternalId(db, message.id);
  if (duplicate) {
    return;
  }

  const contactName = contacts[0]?.profile.name ?? `+${message.from}`;
  const contact: ConversationParticipant = {
    id: message.from,
    name: contactName,
    phone: `+${message.from}`,
  };

  const { conversation, ref, wasCreated } = await ensureConversationForContact({
    db,
    workspaceId,
    channel: 'whatsapp',
    connectedChannel,
    contact,
  });

  const normalized = normalizeWhatsAppMessage(message, contactName, workspaceId, conversation.id);
  const messageForStorage = normalized.type === 'audio'
    ? await transcribeInboundAudioMessage({
        db,
        workspaceId,
        connectedChannel,
        conversationId: conversation.id,
        requestId,
        message: normalized,
        whatsappMessage: message,
      })
    : normalized;

  await persistInboundMessage({
    db,
    conversation,
    conversationRef: ref,
    unreadCount: wasCreated ? 1 : (conversation.unreadCount ?? 0) + 1,
    message: {
      ...messageForStorage,
      conversationId: conversation.id,
    },
  });

  await saveLog(db, {
    level: 'info',
    category: 'processing',
    event: 'message_saved',
    requestId,
    workspaceId,
    conversationId: conversation.id,
    channelId: connectedChannel.id,
    details: {
      externalId: message.id,
      preview: getMessagePreview(messageForStorage.text),
      channel: 'whatsapp',
    },
  });

  const incomingText = messageForStorage.direction === 'inbound'
    ? messageForStorage.text?.trim()
    : undefined;

  // Resolve image for AI: WhatsApp media requires download → base64
  const incomingImageUrl = messageForStorage.direction === 'inbound'
    ? await resolveInboundImageForAI({ connectedChannel, message: messageForStorage, whatsappMessage: message })
    : undefined;

  if (incomingText || incomingImageUrl) {
    const mergedConversation = {
      ...conversation,
      contact: mergeConversationContact(conversation.contact, contact),
      unreadCount: wasCreated ? 1 : (conversation.unreadCount ?? 0) + 1,
    };

    // Fire-and-forget lead classification (text only)
    if (mergedConversation.leadId && incomingText) {
      void classifyAndUpdateLead({
        db,
        workspaceId,
        leadId: mergedConversation.leadId,
        messageText: incomingText,
      }).catch(() => null);
    }

    await runSendMessageAutomation({
      db,
      workspaceId,
      channel: 'whatsapp',
      connectedChannel,
      conversation: mergedConversation,
      incomingText: incomingText ?? '',
      incomingImageUrl,
      requestId,
    });

    await runAiAutomationReply({
      db,
      workspaceId,
      channel: 'whatsapp',
      connectedChannel,
      conversation: mergedConversation,
      conversationRef: ref,
      incomingText: incomingText ?? '',
      incomingImageUrl,
      requestId,
    });
  }
}

async function processWhatsAppStatus(
  db: Db,
  status: import('@/types/meta').MetaWhatsAppStatus
) {
  const msgSnap = await db
    .collection('messages')
    .where('externalId', '==', status.id)
    .limit(1)
    .get();

  if (msgSnap.empty) {
    return;
  }

  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  };

  const now = new Date().toISOString();
  await msgSnap.docs[0].ref.update({
    status: statusMap[status.status] ?? 'sent',
    statusUpdatedAt: now,
    ...(status.status === 'delivered' ? { deliveredAt: now } : {}),
    ...(status.status === 'read' ? { readAt: now } : {}),
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode') ?? '';
  const token = searchParams.get('hub.verify_token') ?? '';
  const challenge = searchParams.get('hub.challenge') ?? '';

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? '';
  const result = verifyWebhookChallenge(mode, token, challenge, verifyToken);

  if (result) {
    return new Response(result, { status: 200 });
  }

  return new Response('Verification failed', { status: 403 });
}

export async function POST(request: NextRequest) {
  const db = getAdminFirestore();
  const rawBody = await request.text();
  const requestId = createRequestId(rawBody);

  try {
    const signature = request.headers.get('x-hub-signature-256') ?? '';
    const appSecret = process.env.META_APP_SECRET ?? '';
    const sigValid = !appSecret || verifyWebhookSignature(rawBody, signature, appSecret);

    if (!sigValid) {
      const context = await resolveWorkspaceContextForPayload(db, rawBody);
      await saveLog(db, {
        level: 'error',
        category: 'security',
        event: 'signature_invalid',
        requestId,
        workspaceId: context.workspaceId,
        channelId: context.channelId,
        details: {
          received: signature.slice(0, 24),
          bodyLength: rawBody.length,
        },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const payload = parseWebhookPayload(body);

    if (!payload) {
      await saveLog(db, {
        level: 'error',
        category: 'processing',
        event: 'invalid_payload',
        requestId,
        details: {
          preview: rawBody.slice(0, 400),
        },
      });
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await saveLog(db, {
      level: 'info',
      category: 'processing',
      event: 'webhook_received',
      requestId,
      details: {
        object: body.object,
        entryCount: Array.isArray(body.entry) ? body.entry.length : 0,
      },
    });

    const resolvedChannel = getChannelFromObject(payload.object);

    // Diagnostic log — always log the raw payload structure to aid debugging
    await saveLog(db, {
      level: 'info',
      category: 'processing',
      event: 'webhook_received',
      requestId,
      details: {
        object: payload.object,
        resolvedChannel: resolvedChannel ?? 'unrecognized',
        entryCount: payload.entry.length,
        entryIds: payload.entry.map((e) => e.id),
        firstEntryKeys: payload.entry[0] ? Object.keys(payload.entry[0]) : [],
        firstChangeField: (payload.entry[0]?.changes?.[0] as Record<string, unknown> | undefined)?.field,
      },
    });

    if (!resolvedChannel) {
      await saveLog(db, {
        level: 'warn',
        category: 'processing',
        event: 'unknown_object_type',
        requestId,
        details: {
          object: payload.object,
          rawPreview: rawBody.slice(0, 500),
        },
      });
      return NextResponse.json({ received: true });
    }

    for (const entry of payload.entry) {
      try {
        const connectedChannel = await findConnectedChannelForEntry(db, entry.id);
        if (!connectedChannel) {
          await saveLog(db, {
            level: 'warn',
            category: 'processing',
            event: 'channel_not_found',
            requestId,
            details: {
              entryId: entry.id,
              channel: resolvedChannel,
            },
          });
          continue;
        }

        const effectiveChannel =
          resolvedChannel === 'whatsapp'
            ? 'whatsapp'
            : connectedChannel.channel;

        await saveLog(db, {
          level: 'info',
          category: 'processing',
          event: 'channel_found',
          requestId,
          workspaceId: connectedChannel.workspaceId,
          channelId: connectedChannel.id,
          details: {
            entryId: entry.id,
            channel: effectiveChannel,
          },
        });

        if (effectiveChannel === 'whatsapp') {
          const messages = extractWhatsAppMessages(entry);
          const statuses = extractWhatsAppStatuses(entry);

          for (const item of messages) {
            await processWhatsAppMessage({
              db,
              workspaceId: connectedChannel.workspaceId,
              connectedChannel,
              item,
              requestId,
            });
          }

          for (const item of statuses) {
            await processWhatsAppStatus(db, item.status);
          }

          continue;
        }

        const events = extractMessagingEvents(entry);
        await saveLog(db, {
          level: 'info',
          category: 'processing',
          event: 'processing_events',
          requestId,
          workspaceId: connectedChannel.workspaceId,
          channelId: connectedChannel.id,
          details: {
            count: events.length,
            channel: effectiveChannel,
          },
        });

        for (const event of events) {
          await processMessagingEvent({
            db,
            workspaceId: connectedChannel.workspaceId,
            channel: effectiveChannel as 'instagram' | 'facebook',
            connectedChannel,
            event,
            requestId,
          });
        }
      } catch (error) {
        await saveLog(db, {
          level: 'error',
          category: 'processing',
          event: 'entry_processing_error',
          requestId,
          details: {
            entryId: entry.id,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    await saveLog(db, {
      level: 'error',
      category: 'processing',
      event: 'webhook_fatal_error',
      requestId,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
