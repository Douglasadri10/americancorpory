import type { Channel } from './conversation';

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'sticker'
  | 'location'
  | 'reaction'
  | 'template'
  | 'interactive'
  | 'story_reply'
  | 'unsupported';

export interface MessageMedia {
  url: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number; // seconds for audio/video
  caption?: string;
  thumbnailURL?: string;
}

export interface MessageLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface MessageReaction {
  emoji: string;
  reactedBy: string;
}

export interface MessageQuote {
  messageId: string;
  text?: string;
  mediaURL?: string;
  fromName: string;
}

export interface Message {
  id: string;
  workspaceId: string;
  conversationId: string;
  channel?: Channel;
  // External platform message ID
  externalId?: string;
  direction: MessageDirection;
  type: MessageType;
  // Text content
  text?: string;
  // Rich media
  media?: MessageMedia;
  location?: MessageLocation;
  reaction?: MessageReaction;
  quote?: MessageQuote;
  // Template / interactive data
  templateName?: string;
  interactivePayload?: Record<string, unknown>;
  // Sender info
  senderId: string;        // uid (if agent) or external contact id
  senderName: string;
  senderType: 'agent' | 'contact' | 'bot';
  senderAvatar?: string;
  // Status
  status: MessageStatus;
  statusUpdatedAt?: string;
  // AI
  generatedByAI: boolean;
  aiModelUsed?: string;
  aiPromptTokens?: number;
  aiCompletionTokens?: number;
  // Error
  errorMessage?: string;
  // Timestamps
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface SendMessagePayload {
  conversationId: string;
  type: MessageType;
  text?: string;
  media?: {
    url: string;
    mimeType: string;
    caption?: string;
  };
  templateName?: string;
  templateParams?: string[];
}
