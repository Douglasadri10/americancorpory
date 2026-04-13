import crypto from 'crypto';
import type { MetaWebhookPayload, MetaWebhookEntry, MetaMessagingEvent } from '@/types/meta';
import { generateToken, safeCompare } from '@/lib/utils/encryption';

/**
 * Verify the X-Hub-Signature-256 header from Meta webhooks.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  appSecret: string
): boolean {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const signatureHash = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  return safeCompare(expectedSignature, signatureHash);
}

/**
 * Verify the hub.verify_token for webhook verification challenges.
 */
export function verifyWebhookChallenge(
  mode: string,
  token: string,
  challenge: string,
  expectedToken: string
): string | null {
  if (mode === 'subscribe' && token === expectedToken) {
    return challenge;
  }
  return null;
}

/**
 * Parse and validate a Meta webhook payload.
 */
export function parseWebhookPayload(body: unknown): MetaWebhookPayload | null {
  if (!body || typeof body !== 'object') return null;

  const payload = body as Record<string, unknown>;
  if (!payload.object || !Array.isArray(payload.entry)) return null;

  return payload as unknown as MetaWebhookPayload;
}

/**
 * Determine the channel from a webhook entry's object type.
 */
export function getChannelFromObject(
  object: string
): 'instagram' | 'facebook' | 'whatsapp' | null {
  switch (object) {
    case 'instagram':
      return 'instagram';
    case 'page':
      return 'facebook';
    case 'whatsapp_business_account':
      return 'whatsapp';
    default:
      return null;
  }
}

/**
 * Extract all messaging events from a webhook entry (Messenger / Instagram).
 * Supports:
 * 1. Legacy Messenger format: entry.messaging[]
 * 2. New Instagram Business API via changes[].value.messaging[]
 * 3. New Instagram Business API direct: changes[].value IS the event (has sender/message)
 */
export function extractMessagingEvents(entry: MetaWebhookEntry): MetaMessagingEvent[] {
  // Collect from ALL sources — Instagram can send message_edit via entry.messaging[]
  // AND the actual message via entry.changes[] in the same entry.
  const events: MetaMessagingEvent[] = [];

  // Legacy / Messenger format
  if (entry.messaging) {
    events.push(...entry.messaging);
  }

  for (const change of entry.changes ?? []) {
    const value = change.value as Record<string, unknown>;
    if (!value) continue;

    if (Array.isArray(value.messaging)) {
      // changes[].value.messaging[] format
      events.push(...(value.messaging as MetaMessagingEvent[]));
    } else if (value.sender || value.message || value.postback) {
      // changes[].value IS the event directly (Instagram messages via changes)
      events.push(value as unknown as MetaMessagingEvent);
    }
  }
  return events;
}

/**
 * Extract WhatsApp messages from a webhook entry.
 */
export function extractWhatsAppMessages(entry: MetaWebhookEntry) {
  const messages: Array<{
    message: import('@/types/meta').MetaWhatsAppMessage;
    contacts: Array<{ profile: { name: string }; wa_id: string }>;
    metadata: { display_phone_number: string; phone_number_id: string };
    pageId: string;
  }> = [];

  for (const change of entry.changes ?? []) {
    const value = change.value as import('@/types/meta').MetaWhatsAppValue;
    if (!value?.messages) continue;

    for (const message of value.messages) {
      messages.push({
        message,
        contacts: value.contacts ?? [],
        metadata: value.metadata,
        pageId: entry.id,
      });
    }
  }

  return messages;
}

/**
 * Extract WhatsApp status updates from a webhook entry.
 */
export function extractWhatsAppStatuses(entry: MetaWebhookEntry) {
  const statuses: Array<{
    status: import('@/types/meta').MetaWhatsAppStatus;
    metadata: { display_phone_number: string; phone_number_id: string };
  }> = [];

  for (const change of entry.changes ?? []) {
    const value = change.value as import('@/types/meta').MetaWhatsAppValue;
    if (!value?.statuses) continue;

    for (const status of value.statuses) {
      statuses.push({ status, metadata: value.metadata });
    }
  }

  return statuses;
}

/**
 * Generate a random webhook verify token.
 */
export function generateVerifyToken(): string {
  return generateToken();
}
