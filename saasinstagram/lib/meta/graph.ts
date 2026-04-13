import type {
  MetaSendMessageRequest,
  MetaSendMessageResponse,
  MetaUserPages,
  MetaPageInfo,
} from '@/types/meta';

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

export class MetaGraphClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = new URL(`${GRAPH_API_BASE}${endpoint}`);

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.method === 'GET' || !options.method) {
      url.searchParams.set('access_token', this.accessToken);
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    const data = await response.json() as T & { error?: { message: string; code: number } };

    if ('error' in data && data.error) {
      throw new MetaGraphError(
        data.error.message,
        data.error.code,
        endpoint
      );
    }

    return data;
  }

  // ─── Page & Account Info ───────────────────────────────────────────────────

  async getMe(fields = 'id,name,picture'): Promise<MetaPageInfo> {
    return this.request<MetaPageInfo>(`/me?fields=${fields}`);
  }

  async getUserPages(): Promise<MetaUserPages> {
    return this.request<MetaUserPages>(
      '/me/accounts?fields=id,name,picture,access_token,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}'
    );
  }

  async getPage(pageId: string, fields = 'id,name,picture'): Promise<MetaPageInfo> {
    return this.request<MetaPageInfo>(`/${pageId}?fields=${fields}`);
  }

  // ─── Messenger ─────────────────────────────────────────────────────────────

  async sendMessengerMessage(
    pageId: string,
    payload: MetaSendMessageRequest
  ): Promise<MetaSendMessageResponse> {
    return this.request<MetaSendMessageResponse>(`/${pageId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async markMessengerMessageSeen(
    pageId: string,
    senderId: string
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/${pageId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: { id: senderId },
        sender_action: 'mark_seen',
      }),
    });
  }

  async setTypingIndicator(
    pageId: string,
    senderId: string,
    on: boolean
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/${pageId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: { id: senderId },
        sender_action: on ? 'typing_on' : 'typing_off',
      }),
    });
  }

  // ─── Instagram ─────────────────────────────────────────────────────────────

  async sendInstagramMessage(
    igAccountId: string,
    recipientId: string,
    message: { text?: string; attachment?: unknown }
  ): Promise<MetaSendMessageResponse> {
    return this.request<MetaSendMessageResponse>(`/${igAccountId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        recipient: { id: recipientId },
        message,
      }),
    });
  }

  async getInstagramProfile(igUserId: string): Promise<{
    id: string;
    name: string;
    username?: string;
    profile_pic?: string;
  }> {
    return this.request(`/${igUserId}?fields=id,name,username,profile_pic`);
  }

  // ─── WhatsApp Cloud API ─────────────────────────────────────────────────────

  async sendWhatsAppTextMessage(
    phoneNumberId: string,
    to: string,
    text: string,
    previewUrl = false
  ): Promise<{ messages: Array<{ id: string }> }> {
    return this.request(`/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: previewUrl, body: text },
      }),
    });
  }

  async sendWhatsAppMediaMessage(
    phoneNumberId: string,
    to: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    caption?: string
  ): Promise<{ messages: Array<{ id: string }> }> {
    return this.request(`/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: mediaType,
        [mediaType]: { link: mediaUrl, caption },
      }),
    });
  }

  async sendWhatsAppTemplate(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components?: unknown[]
  ): Promise<{ messages: Array<{ id: string }> }> {
    return this.request(`/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });
  }

  async markWhatsAppMessageRead(
    phoneNumberId: string,
    messageId: string
  ): Promise<{ success: boolean }> {
    return this.request(`/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  }

  async getWhatsAppMediaUrl(mediaId: string): Promise<{ url: string; mime_type: string; sha256: string; file_size: number; id: string }> {
    return this.request(`/${mediaId}`);
  }

  async downloadMedia(
    url: string
  ): Promise<{ buffer: Buffer; mimeType?: string; fileSize?: number }> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`meta_media_download_failed_${response.status}${errorText ? `:${errorText.slice(0, 120)}` : ''}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentLength = response.headers.get('content-length');

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get('content-type') ?? undefined,
      fileSize: contentLength ? Number(contentLength) : undefined,
    };
  }

  // ─── Webhook Subscription ──────────────────────────────────────────────────

  async subscribePageWebhook(
    pageId: string,
    fields: string[] = ['messages', 'messaging_postbacks', 'messaging_optins', 'messaging_reads', 'messaging_deliveries']
  ): Promise<{ success: boolean }> {
    return this.request(`/${pageId}/subscribed_apps`, {
      method: 'POST',
      body: JSON.stringify({ subscribed_fields: fields }),
    });
  }

  async unsubscribePageWebhook(pageId: string): Promise<{ success: boolean }> {
    return this.request(`/${pageId}/subscribed_apps`, {
      method: 'DELETE',
    });
  }
}

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly endpoint: string
  ) {
    super(`Meta Graph API Error [${code}] on ${endpoint}: ${message}`);
    this.name = 'MetaGraphError';
  }
}

/**
 * Exchange a short-lived user token for a long-lived token.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const response = await fetch(url.toString());
  const data = await response.json() as { access_token: string; token_type: string; expires_in: number; error?: { message: string } };

  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error.message}`);
  }

  return data;
}

/**
 * Get a page access token from a user token.
 */
export async function getPageAccessToken(
  userToken: string,
  pageId: string
): Promise<string> {
  const url = `${GRAPH_API_BASE}/${pageId}?fields=access_token&access_token=${userToken}`;
  const response = await fetch(url);
  const data = await response.json() as { access_token?: string; error?: { message: string } };

  if (!data.access_token) {
    throw new Error('Failed to get page access token');
  }

  return data.access_token;
}
