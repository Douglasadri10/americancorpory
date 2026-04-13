import type { Channel } from '@/types/conversation';
import type {
  MetaChannelAuthMethod,
  MetaChannelConnectSession,
  MetaConnectedChannel,
  MetaConnectionCandidate,
  MetaIgConnectionStatus,
  MetaTokenStatus,
  MetaTokenType,
  MetaWebhookStatus,
} from '@/types/meta';
import { decryptObject, encryptObject } from '@/lib/utils/encryption';

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const TOKEN_EXPIRY_WARNING_MS = 7 * 24 * 60 * 60 * 1000;

export const META_CONNECT_SESSION_COLLECTION = 'channelConnectSessions';
export const META_CONNECT_SESSION_TTL_MS = 15 * 60 * 1000;
export const INSTAGRAM_REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
] as const;
export const INSTAGRAM_OAUTH_SCOPE = INSTAGRAM_REQUIRED_SCOPES.join(',');
export const FACEBOOK_OAUTH_SCOPE = getRequiredScopes('facebook').join(',');

export interface MetaTokenDebugData {
  app_id?: string;
  application?: string;
  data_access_expires_at?: number;
  expires_at?: number;
  is_valid: boolean;
  profile_id?: string;
  scopes?: string[];
  type?: string;
  user_id?: string;
}

interface MetaTokenDebugResponse {
  data?: MetaTokenDebugData;
  error?: { message?: string };
}

interface MetaGraphErrorPayload {
  error?: {
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    message?: string;
    type?: string;
  };
}

interface MetaPageLookup {
  id: string;
  name: string;
  picture?: { data?: { url?: string } };
  access_token?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
  };
  connected_instagram_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
  };
}

interface MetaPagesResponse {
  data?: MetaPageLookup[];
  error?: {
    message?: string;
  };
}

interface MetaWhatsAppBusinessAccountLookup {
  id: string;
  name?: string;
}

interface MetaWhatsAppPhoneNumberLookup {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
}

interface MetaWhatsAppPhoneNumbersResponse {
  data?: MetaWhatsAppPhoneNumberLookup[];
  error?: {
    message?: string;
  };
}

interface MetaConnectionStatePayload {
  workspaceId: string;
  ownerUid: string;
  channel: 'instagram' | 'facebook';
  nonce: string;
  expiresAt: string;
}

class MetaGraphRequestError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status: number,
    public readonly code?: number,
    public readonly type?: string,
    public readonly fbtraceId?: string
  ) {
    super(message);
    this.name = 'MetaGraphRequestError';
  }
}

const INSTAGRAM_PAGE_SUBSCRIBED_FIELDS = [
  'messages',
  'messaging_postbacks',
  'message_reads',
  'message_deliveries',
  'message_echoes',
] as const;

function getMetaAppCredentials() {
  const appId = process.env.META_APP_ID ?? '';
  const appSecret = process.env.META_APP_SECRET ?? '';

  if (!appId || !appSecret) {
    throw new Error('Credenciais do app Meta ausentes');
  }

  return {
    appId,
    appSecret,
    appAccessToken: `${appId}|${appSecret}`,
  };
}

function buildGraphUrl(path: string, searchParams?: Record<string, string | undefined>) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${GRAPH_API_BASE}${normalizedPath}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

async function graphRequest<T>(
  path: string,
  options: {
    accessToken?: string;
    accessTokenInQuery?: boolean;
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    searchParams?: Record<string, string | undefined>;
  } = {}
): Promise<T> {
  const method = options.method ?? 'GET';
  const url = buildGraphUrl(path, {
    ...options.searchParams,
    ...((method === 'GET' || options.accessTokenInQuery) && options.accessToken ? { access_token: options.accessToken } : {}),
  });

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' && options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json() as T & MetaGraphErrorPayload;

  if (data.error?.message) {
    throw new MetaGraphRequestError(
      data.error.message,
      path,
      response.status,
      data.error.code,
      data.error.type,
      data.error.fbtrace_id
    );
  }

  return data;
}

export function normalizeScopes(scopes?: string[]) {
  return Array.from(new Set((scopes ?? []).map((scope) => scope.trim()).filter(Boolean))).sort();
}

export function getRequiredScopes(channel: Channel) {
  if (channel === 'instagram') {
    return [...INSTAGRAM_REQUIRED_SCOPES];
  }

  if (channel === 'facebook') {
    return ['pages_messaging', 'pages_read_engagement', 'pages_manage_metadata'];
  }

  if (channel === 'whatsapp') {
    return ['whatsapp_business_management', 'whatsapp_business_messaging'];
  }

  return [];
}

export function getMissingScopes(grantedScopes: string[], requiredScopes: string[]) {
  const granted = new Set(normalizeScopes(grantedScopes));
  return normalizeScopes(requiredScopes).filter((scope) => !granted.has(scope));
}

export function resolveMetaTokenType(tokenDebug?: MetaTokenDebugData | null): MetaTokenType {
  const rawType = tokenDebug?.type?.toLowerCase() ?? '';

  if (rawType.includes('user')) return 'user';
  if (rawType.includes('page')) return 'page';
  if (rawType.includes('instagram')) return 'instagram_igaa';

  return 'unknown';
}

export function resolveIgConnectionStatus(
  channel: Channel,
  instagramAccountId?: string | null
): MetaIgConnectionStatus {
  if (channel !== 'instagram') return 'not_required';
  return instagramAccountId ? 'connected' : 'missing_link';
}

export function resolveWebhookStatus(webhookVerified?: boolean, lastRefreshError?: string): MetaWebhookStatus {
  if (webhookVerified) return 'subscribed';
  if (lastRefreshError) return 'failed';
  return 'pending';
}

export function resolveTokenStatus(params: {
  missingScopes?: string[];
  expiresAt?: string;
  isValid?: boolean;
  limitedUse?: boolean;
}): MetaTokenStatus {
  const missingScopes = params.missingScopes ?? [];

  if (missingScopes.length > 0) {
    return 'missing_scopes';
  }

  if (params.isValid === false) {
    return 'invalid';
  }

  if (params.limitedUse) {
    return 'limited';
  }

  if (!params.expiresAt) {
    return 'active';
  }

  const expiresAtMs = new Date(params.expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return 'unknown';
  }

  if (expiresAtMs <= Date.now()) {
    return 'invalid';
  }

  if (expiresAtMs - Date.now() <= TOKEN_EXPIRY_WARNING_MS) {
    return 'expiring_soon';
  }

  return 'active';
}

export function isChannelDemoReady(
  channel:
    | Pick<MetaConnectedChannel, 'channel' | 'connected' | 'isActive' | 'tokenStatus' | 'webhookStatus' | 'igConnectionStatus' | 'reauthorizationRequired'>
    | Pick<MetaConnectionCandidate, 'tokenStatus' | 'webhookStatus' | 'igConnectionStatus'>
) {
  const tokenStatus = channel.tokenStatus;
  const webhookStatus = channel.webhookStatus;
  const igConnectionStatus = channel.igConnectionStatus;

  const tokenOk = tokenStatus === 'active' || tokenStatus === 'expiring_soon' || tokenStatus === 'limited';
  const webhookOk = webhookStatus === 'subscribed';
  const igOk = igConnectionStatus === 'connected' || igConnectionStatus === 'not_required';

  if ('connected' in channel) {
    return channel.connected && channel.isActive && !channel.reauthorizationRequired && tokenOk && webhookOk && igOk;
  }

  return tokenOk && webhookOk && igOk;
}

export function resolveCandidateStatusReason(candidate: Pick<MetaConnectionCandidate, 'missingScopes' | 'igConnectionStatus' | 'tokenStatus' | 'limitedUse'>) {
  if (candidate.missingScopes.length > 0) {
    return `Permissões faltando: ${candidate.missingScopes.join(', ')}`;
  }

  if (candidate.igConnectionStatus === 'missing_link') {
    return 'Conta IG não vinculada à Página';
  }

  if (candidate.tokenStatus === 'limited' || candidate.limitedUse) {
    return 'Conexão limitada a este token manual';
  }

  return 'Pronto para conectar';
}

export async function debugMetaToken(inputToken: string) {
  const { appAccessToken } = getMetaAppCredentials();
  const response = await graphRequest<MetaTokenDebugResponse>('/debug_token', {
    searchParams: {
      input_token: inputToken,
      access_token: appAccessToken,
    },
  });

  if (!response.data) {
    throw new Error(response.error?.message ?? 'Falha ao inspecionar token');
  }

  return response.data;
}

export async function fetchUserPagesForConnection(userToken: string) {
  const response = await graphRequest<MetaPagesResponse>('/me/accounts', {
    accessToken: userToken,
    searchParams: {
      fields:
        'id,name,picture,access_token,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}',
    },
  });

  return response.data ?? [];
}

export async function fetchPageForConnection(pageId: string, accessToken: string) {
  return graphRequest<MetaPageLookup>(`/${pageId}`, {
    accessToken,
    searchParams: {
      fields:
        'id,name,picture,access_token,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}',
    },
  });
}

export async function fetchWhatsAppBusinessAccountForConnection(wabaId: string, accessToken: string) {
  return graphRequest<MetaWhatsAppBusinessAccountLookup>(`/${wabaId}`, {
    accessToken,
    searchParams: {
      fields: 'id,name',
    },
  });
}

export async function fetchWhatsAppPhoneNumbersForConnection(wabaId: string, accessToken: string) {
  const response = await graphRequest<MetaWhatsAppPhoneNumbersResponse>(`/${wabaId}/phone_numbers`, {
    accessToken,
    searchParams: {
      fields: 'id,display_phone_number,verified_name',
    },
  });

  return response.data ?? [];
}

export async function fetchWhatsAppPhoneNumberForConnection(phoneNumberId: string, accessToken: string) {
  return graphRequest<MetaWhatsAppPhoneNumberLookup>(`/${phoneNumberId}`, {
    accessToken,
    searchParams: {
      fields: 'id,display_phone_number,verified_name',
    },
  });
}

export function resolveInstagramAccount(page: MetaPageLookup) {
  return page.instagram_business_account ?? page.connected_instagram_account;
}

export function buildInstagramCandidate(params: {
  authMethod: MetaChannelAuthMethod;
  grantedScopes: string[];
  page: MetaPageLookup;
  pageAccessToken?: string;
  requiredScopes?: string[];
  tokenExpiresAt?: string;
  tokenType: MetaTokenType;
  tokenValid?: boolean;
  limitedUse?: boolean;
}): MetaConnectionCandidate {
  const requiredScopes = normalizeScopes(params.requiredScopes ?? getRequiredScopes('instagram'));
  const grantedScopes = normalizeScopes(params.grantedScopes);
  const missingScopes = getMissingScopes(grantedScopes, requiredScopes);
  const instagramAccount = resolveInstagramAccount(params.page);
  const igConnectionStatus = resolveIgConnectionStatus('instagram', instagramAccount?.id);
  const tokenStatus = resolveTokenStatus({
    missingScopes,
    expiresAt: params.tokenExpiresAt,
    isValid: params.tokenValid,
    limitedUse: params.limitedUse,
  });

  const candidate: MetaConnectionCandidate = {
    channel: 'instagram',
    id: params.page.id,
    pageId: params.page.id,
    pageName: params.page.name,
    pageAvatarURL: params.page.picture?.data?.url,
    pageAccessToken: params.pageAccessToken,
    instagramAccountId: instagramAccount?.id,
    instagramAccountIdApi: instagramAccount?.id,
    instagramUsername: instagramAccount?.username,
    authMethod: params.authMethod,
    tokenType: params.tokenType,
    tokenStatus,
    webhookStatus: 'pending',
    igConnectionStatus,
    grantedScopes,
    requiredScopes,
    missingScopes,
    isEligible: missingScopes.length === 0 && igConnectionStatus === 'connected',
    limitedUse: Boolean(params.limitedUse),
  };

  candidate.statusReason = resolveCandidateStatusReason(candidate);

  return candidate;
}

export function buildFacebookCandidate(params: {
  authMethod: MetaChannelAuthMethod;
  grantedScopes: string[];
  page: MetaPageLookup;
  pageAccessToken?: string;
  requiredScopes?: string[];
  tokenExpiresAt?: string;
  tokenType: MetaTokenType;
  tokenValid?: boolean;
  limitedUse?: boolean;
}): MetaConnectionCandidate {
  const requiredScopes = normalizeScopes(params.requiredScopes ?? getRequiredScopes('facebook'));
  const grantedScopes = normalizeScopes(params.grantedScopes);
  const missingScopes = getMissingScopes(grantedScopes, requiredScopes);
  const tokenStatus = resolveTokenStatus({
    missingScopes,
    expiresAt: params.tokenExpiresAt,
    isValid: params.tokenValid,
    limitedUse: params.limitedUse,
  });

  const candidate: MetaConnectionCandidate = {
    channel: 'facebook',
    id: params.page.id,
    pageId: params.page.id,
    pageName: params.page.name,
    pageAvatarURL: params.page.picture?.data?.url,
    pageAccessToken: params.pageAccessToken,
    authMethod: params.authMethod,
    tokenType: params.tokenType,
    tokenStatus,
    webhookStatus: 'pending',
    igConnectionStatus: 'not_required',
    grantedScopes,
    requiredScopes,
    missingScopes,
    isEligible: missingScopes.length === 0,
    limitedUse: Boolean(params.limitedUse),
  };

  candidate.statusReason = resolveCandidateStatusReason(candidate);

  return candidate;
}

export function buildWhatsAppCandidate(params: {
  authMethod: MetaChannelAuthMethod;
  grantedScopes: string[];
  accessToken: string;
  wabaId: string;
  wabaName?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  requiredScopes?: string[];
  tokenExpiresAt?: string;
  tokenType: MetaTokenType;
  tokenValid?: boolean;
  limitedUse?: boolean;
}): MetaConnectionCandidate {
  const requiredScopes = normalizeScopes(params.requiredScopes ?? getRequiredScopes('whatsapp'));
  const grantedScopes = normalizeScopes(params.grantedScopes);
  const missingScopes = getMissingScopes(grantedScopes, requiredScopes);
  const tokenStatus = resolveTokenStatus({
    missingScopes,
    expiresAt: params.tokenExpiresAt,
    isValid: params.tokenValid,
    limitedUse: params.limitedUse,
  });
  const isEligible = missingScopes.length === 0 && Boolean(params.phoneNumberId);

  const candidate: MetaConnectionCandidate = {
    channel: 'whatsapp',
    id: params.phoneNumberId ?? params.wabaId,
    pageId: params.wabaId,
    pageName: params.wabaName ?? params.phoneNumber ?? 'WhatsApp Business',
    pageAccessToken: params.accessToken,
    wabaId: params.wabaId,
    phoneNumberId: params.phoneNumberId,
    phoneNumber: params.phoneNumber,
    authMethod: params.authMethod,
    tokenType: params.tokenType,
    tokenStatus,
    webhookStatus: 'subscribed',
    igConnectionStatus: 'not_required',
    grantedScopes,
    requiredScopes,
    missingScopes,
    isEligible,
    limitedUse: Boolean(params.limitedUse),
    statusReason:
      missingScopes.length > 0
        ? `Permissões faltando: ${missingScopes.join(', ')}`
        : params.phoneNumberId
          ? 'Pronto para conectar'
          : 'Phone Number ID não encontrado para este WABA.',
  };

  return candidate;
}

export async function subscribeInstagramWebhook(params: {
  accessToken: string;
  instagramAccountId?: string;
  pageId: string;
}) {
  await graphRequest<{ success: boolean }>(`/${params.pageId}/subscribed_apps`, {
    method: 'POST',
    accessToken: params.accessToken,
    accessTokenInQuery: true,
    searchParams: {
      subscribed_fields: INSTAGRAM_PAGE_SUBSCRIBED_FIELDS.join(','),
    },
  });

  return { success: true as const, endpoint: 'page' as const };
}

export function createMetaConnectionState(
  workspaceId: string,
  ownerUid: string,
  channel: 'instagram' | 'facebook',
  nonce: string,
  expiresAt: string
) {
  return encryptObject<MetaConnectionStatePayload>({ workspaceId, ownerUid, channel, nonce, expiresAt });
}

export function parseMetaConnectionState(state: string) {
  return decryptObject<MetaConnectionStatePayload>(state);
}

export function sanitizeConnectSession(session: MetaChannelConnectSession): MetaChannelConnectSession {
  return {
    ...session,
    candidates: session.candidates.map((candidate) => ({
      ...candidate,
      pageAccessToken: undefined,
    })),
  };
}

export function normalizeConnectedChannel(channel: MetaConnectedChannel): MetaConnectedChannel {
  const requiredScopes = normalizeScopes(channel.requiredScopes ?? getRequiredScopes(channel.channel));
  const grantedScopes = normalizeScopes(channel.grantedScopes ?? []);
  const missingScopes = getMissingScopes(grantedScopes, requiredScopes);
  const tokenType = channel.tokenType ?? 'unknown';
  const igConnectionStatus =
    channel.igConnectionStatus ??
    resolveIgConnectionStatus(channel.channel, channel.instagramAccountId ?? channel.instagramAccountIdApi);
  const tokenStatus =
    channel.tokenStatus ??
    resolveTokenStatus({
      missingScopes,
      expiresAt: channel.tokenExpiresAt,
      limitedUse:
        channel.authMethod === 'manual' &&
        !channel.userAccessToken &&
        (tokenType === 'page' || tokenType === 'instagram_igaa'),
    });
  const webhookStatus =
    channel.webhookStatus ??
    resolveWebhookStatus(channel.webhookVerified, channel.lastRefreshError);

  return {
    ...channel,
    authMethod: channel.authMethod ?? 'oauth',
    tokenType,
    tokenStatus,
    webhookStatus,
    igConnectionStatus,
    grantedScopes,
    requiredScopes,
    reauthorizationRequired: Boolean(
      channel.reauthorizationRequired ||
      tokenStatus === 'invalid' ||
      tokenStatus === 'missing_scopes'
    ),
  };
}

export function buildConnectedChannelFromCandidate(params: {
  authMethod: MetaChannelAuthMethod;
  candidate: MetaConnectionCandidate;
  channelId: string;
  encryptedAccessToken: string;
  encryptedUserAccessToken?: string;
  existing?: Partial<MetaConnectedChannel>;
  tokenExpiresAt?: string;
  webhookStatus?: MetaWebhookStatus;
  workspaceId: string;
}): MetaConnectedChannel {
  const now = new Date().toISOString();
  const channelType = params.candidate.channel ?? 'instagram';
  const lastRefreshError = params.existing?.lastRefreshError;
  const resolvedWebhookStatus = channelType === 'whatsapp' ? 'subscribed' : (params.webhookStatus ?? 'subscribed');
  const webhookVerified = resolvedWebhookStatus === 'subscribed';

  return normalizeConnectedChannel({
    id: params.channelId,
    workspaceId: params.workspaceId,
    channel: channelType,
    authMethod: params.authMethod,
    pageId: params.candidate.pageId,
    pageName: params.candidate.pageName,
    pageAvatarURL: params.candidate.pageAvatarURL,
    accessToken: params.encryptedAccessToken,
    userAccessToken: params.encryptedUserAccessToken,
    tokenExpiresAt: params.tokenExpiresAt,
    tokenType: params.candidate.tokenType,
    tokenStatus: params.candidate.tokenStatus,
    grantedScopes: params.candidate.grantedScopes,
    requiredScopes: params.candidate.requiredScopes,
    lastValidatedAt: now,
    lastTokenRefreshAt: now,
    lastRefreshError: webhookVerified ? undefined : lastRefreshError,
    reauthorizationRequired: params.candidate.tokenStatus === 'invalid' || params.candidate.tokenStatus === 'missing_scopes',
    connected: true,
    webhookVerified,
    webhookSubscribedAt: webhookVerified ? now : params.existing?.webhookSubscribedAt,
    webhookStatus: resolvedWebhookStatus,
    instagramAccountId: channelType === 'instagram' ? params.candidate.instagramAccountId : undefined,
    instagramAccountIdApi: channelType === 'instagram' ? params.candidate.instagramAccountIdApi : undefined,
    instagramUsername: channelType === 'instagram' ? params.candidate.instagramUsername : undefined,
    igConnectionStatus: params.candidate.igConnectionStatus,
    wabaId: channelType === 'whatsapp' ? (params.candidate.wabaId ?? params.candidate.pageId) : undefined,
    phoneNumberId: channelType === 'whatsapp' ? params.candidate.phoneNumberId : undefined,
    phoneNumber: channelType === 'whatsapp' ? params.candidate.phoneNumber : undefined,
    isActive: params.existing?.isActive ?? true,
    errorMessage: undefined,
    createdAt: params.existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export function mapMetaErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('sufficient administrative permission') ||
    normalized.includes('two factor authentication')
  ) {
    return 'Permissão administrativa insuficiente na Página. Use um usuário com Controle total da Página e ative o 2FA se o Business exigir.';
  }

  if (normalized.includes('validating client secret')) {
    return 'Segredo do app inválido. Confira META_APP_SECRET no Vercel e o App Secret configurado no app Meta.';
  }

  if (
    normalized.includes('invalid oauth access token') ||
    normalized.includes('session has expired') ||
    normalized.includes('user has not authorized')
  ) {
    return 'Token expirado, revogado ou sem autorização suficiente.';
  }

  if (
    normalized.includes('permission') ||
    normalized.includes('permissions error') ||
    normalized.includes('does not have the capability')
  ) {
    return 'Permissões faltando ou app sem acesso a esta capacidade no Meta.';
  }

  if (normalized.includes('subscribed_fields')) {
    return 'Falha ao assinar webhook da Página. Os campos de assinatura retornados pelo Meta são inválidos para esta integração.';
  }

  if (
    normalized.includes('not installed') ||
    normalized.includes('app must be installed') ||
    normalized.includes('live mode')
  ) {
    return 'App em Development ou usuário ainda não aceitou convite de tester/developer.';
  }

  if (
    normalized.includes('unsupported get request') ||
    normalized.includes('object with id') ||
    normalized.includes('does not exist')
  ) {
    return 'Conta IG não vinculada à Página ou recurso não encontrado no app Meta.';
  }

  return message;
}
