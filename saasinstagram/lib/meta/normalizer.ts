import type { Channel } from '@/types/conversation';
import type {
  MetaMessage,
  MetaWhatsAppMessage,
  MetaMessagingEvent,
} from '@/types/meta';
import type { Message, MessageType, MessageMedia } from '@/types/message';

/**
 * Normalize a Facebook/Instagram Messenger event into our internal Message type.
 */
export function normalizeMessengerMessage(
  event: MetaMessagingEvent,
  workspaceId: string,
  conversationId: string,
  channel: Extract<Channel, 'instagram' | 'facebook'>
): Partial<Message> {
  const msg = event.message;
  if (!msg) return {};

  const isEcho = msg.is_echo ?? false;
  const direction = isEcho ? 'outbound' : 'inbound';
  const senderId = isEcho ? event.recipient.id : event.sender.id;

  let type: MessageType = 'text';
  let text: string | undefined = msg.text;
  let media: MessageMedia | undefined;

  if (msg.is_unsupported) {
    type = 'unsupported';
  } else if (msg.sticker_id) {
    type = 'sticker';
  } else if (msg.attachments && msg.attachments.length > 0) {
    const attachment = msg.attachments[0];
    switch (attachment.type) {
      case 'image':
        type = 'image';
        media = {
          url: attachment.payload.url ?? '',
          mimeType: 'image/jpeg',
          caption: text,
        };
        text = undefined;
        break;
      case 'video':
        type = 'video';
        media = {
          url: attachment.payload.url ?? '',
          mimeType: 'video/mp4',
          caption: text,
        };
        text = undefined;
        break;
      case 'audio':
        type = 'audio';
        media = {
          url: attachment.payload.url ?? '',
          mimeType: 'audio/mpeg',
        };
        break;
      case 'file':
        type = 'file';
        media = {
          url: attachment.payload.url ?? '',
          mimeType: 'application/octet-stream',
        };
        break;
      case 'location':
        type = 'location';
        break;
      case 'template':
        type = 'template';
        break;
      default:
        type = 'unsupported';
    }
  }

  const now = new Date().toISOString();

  return {
    workspaceId,
    conversationId,
    channel,
    externalId: msg.mid,
    direction,
    type,
    text,
    media,
    senderId,
    senderType: isEcho ? 'agent' : 'contact',
    senderName: isEcho ? 'Agent' : 'Contact',
    status: isEcho ? 'sent' : 'delivered',
    generatedByAI: false,
    createdAt: now,
    sentAt: isEcho ? now : undefined,
    deliveredAt: !isEcho ? now : undefined,
  };
}

/**
 * Normalize a WhatsApp Cloud API message into our internal Message type.
 */
export function normalizeWhatsAppMessage(
  waMessage: MetaWhatsAppMessage,
  contactName: string,
  workspaceId: string,
  conversationId: string
): Partial<Message> {
  let type: MessageType = 'text';
  let text: string | undefined;
  let media: MessageMedia | undefined;

  switch (waMessage.type) {
    case 'text':
      type = 'text';
      text = waMessage.text?.body;
      break;
    case 'image':
      type = 'image';
      media = {
        url: '',                    // Will be fetched via media ID
        mimeType: waMessage.image?.mime_type ?? 'image/jpeg',
        caption: waMessage.image?.caption,
      };
      break;
    case 'video':
      type = 'video';
      media = {
        url: '',
        mimeType: waMessage.video?.mime_type ?? 'video/mp4',
        caption: waMessage.video?.caption,
      };
      break;
    case 'audio':
      type = 'audio';
      media = {
        url: '',
        mimeType: waMessage.audio?.mime_type ?? 'audio/ogg',
      };
      break;
    case 'document':
      type = 'file';
      media = {
        url: '',
        mimeType: waMessage.document?.mime_type ?? 'application/pdf',
        fileName: waMessage.document?.filename,
        caption: waMessage.document?.caption,
      };
      break;
    case 'location':
      type = 'location';
      break;
    case 'sticker':
      type = 'sticker';
      media = {
        url: '',
        mimeType: waMessage.sticker?.mime_type ?? 'image/webp',
      };
      break;
    case 'reaction':
      type = 'reaction';
      break;
    default:
      type = 'unsupported';
  }

  const now = new Date().toISOString();

  return {
    workspaceId,
    conversationId,
    externalId: waMessage.id,
    direction: 'inbound',
    type,
    text,
    media,
    senderId: waMessage.from,
    senderType: 'contact',
    senderName: contactName,
    status: 'delivered',
    generatedByAI: false,
    createdAt: now,
    deliveredAt: now,
  };
}

/**
 * Get display-friendly channel label.
 */
export function getChannelLabel(channel: Channel): string {
  const labels: Record<Channel, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    whatsapp: 'WhatsApp',
  };
  return labels[channel];
}

/**
 * Get channel color class.
 */
export function getChannelColor(channel: Channel): string {
  const colors: Record<Channel, string> = {
    instagram: 'text-instagram',
    facebook: 'text-facebook',
    whatsapp: 'text-whatsapp',
  };
  return colors[channel];
}

/**
 * Get channel background color class.
 */
export function getChannelBgColor(channel: Channel): string {
  const colors: Record<Channel, string> = {
    instagram: 'bg-instagram',
    facebook: 'bg-facebook',
    whatsapp: 'bg-whatsapp',
  };
  return colors[channel];
}
