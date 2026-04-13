import type { Channel } from './conversation';

// ─── Connected Channel / Page ─────────────────────────────────────────────────

export type MetaChannelAuthMethod = 'oauth' | 'manual';
export type MetaTokenType = 'user' | 'page' | 'instagram_igaa' | 'unknown';
export type MetaTokenStatus =
  | 'active'
  | 'expiring_soon'
  | 'limited'
  | 'invalid'
  | 'missing_scopes'
  | 'unknown';
export type MetaWebhookStatus = 'subscribed' | 'pending' | 'failed';
export type MetaIgConnectionStatus = 'connected' | 'missing_link' | 'not_required';
export type MetaConnectSessionStatus = 'pending' | 'ready' | 'connected' | 'failed' | 'expired';

export interface MetaConnectedChannel {
  id: string;
  workspaceId: string;
  channel: Channel;
  authMethod?: MetaChannelAuthMethod;
  // Platform IDs
  pageId: string;           // Facebook Page ID or WhatsApp Business Account ID
  pageName: string;
  pageAvatarURL?: string;
  // Access tokens (stored encrypted)
  accessToken: string;      // Page access token (encrypted)
  userAccessToken?: string; // User token used to get page token (encrypted)
  tokenExpiresAt?: string;
  tokenType?: MetaTokenType;
  tokenStatus?: MetaTokenStatus;
  grantedScopes?: string[];
  requiredScopes?: string[];
  lastValidatedAt?: string;
  lastTokenRefreshAt?: string;
  lastRefreshError?: string;
  reauthorizationRequired?: boolean;
  connected: boolean;
  // Webhook
  webhookVerified: boolean;
  webhookSubscribedAt?: string;
  webhookStatus?: MetaWebhookStatus;
  // Instagram specific
  instagramAccountId?: string;
  instagramAccountIdApi?: string;
  instagramUsername?: string;
  igConnectionStatus?: MetaIgConnectionStatus;
  // WhatsApp specific
  wabaId?: string;           // WhatsApp Business Account ID
  phoneNumberId?: string;
  phoneNumber?: string;
  // Status
  isActive: boolean;
  errorMessage?: string;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface MetaConnectionCandidate {
  channel: Channel;
  id: string;
  pageId: string;
  pageName: string;
  pageAvatarURL?: string;
  pageAccessToken?: string;
  instagramAccountId?: string;
  instagramAccountIdApi?: string;
  instagramUsername?: string;
  wabaId?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  authMethod: MetaChannelAuthMethod;
  tokenType: MetaTokenType;
  tokenStatus: MetaTokenStatus;
  webhookStatus: MetaWebhookStatus;
  igConnectionStatus: MetaIgConnectionStatus;
  grantedScopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  isEligible: boolean;
  statusReason?: string;
  limitedUse?: boolean;
}

export interface MetaChannelConnectSession {
  id: string;
  workspaceId: string;
  ownerUid: string;
  channel: Channel;
  authMethod: MetaChannelAuthMethod;
  status: MetaConnectSessionStatus;
  grantedScopes: string[];
  requiredScopes: string[];
  sourceTokenType?: MetaTokenType;
  sourceTokenStatus?: MetaTokenStatus;
  candidates: MetaConnectionCandidate[];
  selectedCandidateId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

// ─── Meta Webhook Payloads ────────────────────────────────────────────────────

export interface MetaWebhookEntry {
  id: string;           // Page ID
  time: number;
  messaging?: MetaMessagingEvent[];
  changes?: MetaChangeEvent[];
}

export interface MetaWebhookPayload {
  object: 'page' | 'instagram' | 'whatsapp_business_account';
  entry: MetaWebhookEntry[];
}

// Instagram / Messenger messaging events
export interface MetaMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: MetaMessage;
  read?: { watermark: number };
  delivery?: { watermark: number; mids: string[] };
  postback?: MetaPostback;
  referral?: MetaReferral;
  reaction?: MetaMessageReaction;
}

export interface MetaMessage {
  mid: string;
  text?: string;
  attachments?: MetaAttachment[];
  reply_to?: { mid: string };
  is_echo?: boolean;
  is_unsupported?: boolean;
  reactions?: Array<{ reaction: string; emoji: string }>;
  sticker_id?: string;
}

export interface MetaAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'template' | 'fallback' | 'location' | 'sticker';
  payload: {
    url?: string;
    title?: string;
    sticker_id?: string;
    coordinates?: { lat: number; long: number };
    // template payload
    template_type?: string;
    elements?: unknown[];
  };
}

export interface MetaPostback {
  title: string;
  payload: string;
  referral?: MetaReferral;
}

export interface MetaReferral {
  ref: string;
  source: string;
  type: string;
  ad_id?: string;
}

export interface MetaMessageReaction {
  mid: string;
  action: 'react' | 'unreact';
  reaction?: string;
  emoji?: string;
}

// WhatsApp Cloud API change events
export interface MetaChangeEvent {
  value: MetaWhatsAppValue | MetaInstagramValue;
  field: string;
}

export interface MetaWhatsAppValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages?: MetaWhatsAppMessage[];
  statuses?: MetaWhatsAppStatus[];
  errors?: MetaWhatsAppError[];
}

export interface MetaWhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker' | 'reaction' | 'button' | 'interactive' | 'unsupported';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  video?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  sticker?: { id: string; mime_type: string; sha256: string; animated: boolean };
  reaction?: { message_id: string; emoji: string };
  context?: { from: string; id: string };
  referral?: { source_url: string; source_type: string; source_id: string; headline?: string; body?: string; media_type?: string; image_url?: string; video_url?: string; thumbnail_url?: string; ctwa_clid?: string };
}

export interface MetaWhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: MetaWhatsAppError[];
}

export interface MetaWhatsAppError {
  code: number;
  title: string;
  message?: string;
  error_data?: { details: string };
}

export interface MetaInstagramValue {
  field?: string;
  // Direct messages
  messaging?: MetaMessagingEvent[];
  // Comment changes
  comments?: unknown[];
}

// ─── Graph API Response types ─────────────────────────────────────────────────

export interface MetaPageInfo {
  id: string;
  name: string;
  picture?: { data: { url: string } };
  access_token?: string;
  connected_instagram_account?: {
    id: string;
    username: string;
    profile_picture_url?: string;
  };
  instagram_business_account?: {
    id: string;
    username: string;
    profile_picture_url?: string;
  };
}

export interface MetaUserPages {
  data: MetaPageInfo[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

export interface MetaSendMessageRequest {
  recipient: { id: string };
  message: {
    text?: string;
    attachment?: MetaAttachment;
  };
  messaging_type?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
  tag?: string;
}

export interface MetaSendMessageResponse {
  recipient_id: string;
  message_id: string;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}
