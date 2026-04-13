export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { exchangeForLongLivedToken } from '@/lib/meta/graph';
import {
  buildInstagramCandidate,
  buildWhatsAppCandidate,
  debugMetaToken,
  fetchPageForConnection,
  fetchUserPagesForConnection,
  fetchWhatsAppBusinessAccountForConnection,
  fetchWhatsAppPhoneNumberForConnection,
  fetchWhatsAppPhoneNumbersForConnection,
  getRequiredScopes,
  mapMetaErrorMessage,
  META_CONNECT_SESSION_COLLECTION,
  META_CONNECT_SESSION_TTL_MS,
  resolveMetaTokenType,
  resolveTokenStatus,
  sanitizeConnectSession,
} from '@/lib/meta/connection';
import { encrypt } from '@/lib/utils/encryption';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import type { MetaChannelConnectSession, MetaConnectionCandidate } from '@/types/meta';

interface ManualInspectBody {
  accessToken?: string;
  channel?: 'instagram' | 'whatsapp';
  igAccountId?: string;
  pageId?: string;
  phoneNumberId?: string;
  wabaId?: string;
  workspaceId?: string;
}

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ManualInspectBody;
  try {
    body = await request.json() as ManualInspectBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  const channel = body.channel ?? 'instagram';
  const accessToken = body.accessToken?.trim();
  const pageId = body.pageId?.trim();
  const wabaId = body.wabaId?.trim();
  const phoneNumberId = body.phoneNumberId?.trim();

  if (!workspaceId || !accessToken) {
    return NextResponse.json({ error: 'workspaceId e accessToken são obrigatórios' }, { status: 400 });
  }

  if (channel !== 'instagram' && channel !== 'whatsapp') {
    return NextResponse.json({ error: 'Canal manual inválido' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const sessionRef = db.collection(META_CONNECT_SESSION_COLLECTION).doc();
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + META_CONNECT_SESSION_TTL_MS).toISOString();

    const baseSession: MetaChannelConnectSession = {
      id: sessionRef.id,
      workspaceId,
      ownerUid: decoded.uid,
      channel,
      authMethod: 'manual',
      status: 'pending',
      grantedScopes: [],
      requiredScopes: getRequiredScopes(channel),
      candidates: [],
      createdAt,
      updatedAt: createdAt,
      expiresAt,
    };

    await sessionRef.set(baseSession);

    const initialDebug = await debugMetaToken(accessToken);
    if (!initialDebug.is_valid) {
      throw new Error('Token inválido ou revogado.');
    }

    const initialTokenType = resolveMetaTokenType(initialDebug);
    const initialExpiresAt =
      initialDebug.expires_at && initialDebug.expires_at > 0
        ? new Date(initialDebug.expires_at * 1000).toISOString()
        : undefined;

    let finalToken = accessToken;
    let tokenDebug = initialDebug;
    let tokenType = initialTokenType;
    let tokenExpiresAt = initialExpiresAt;
    let encryptedUserAccessToken: string | undefined;
    let candidates: MetaConnectionCandidate[] = [];

    if (tokenType === 'user') {
      const appId = process.env.META_APP_ID ?? '';
      const appSecret = process.env.META_APP_SECRET ?? '';
      const exchanged = await exchangeForLongLivedToken(accessToken, appId, appSecret);
      finalToken = exchanged.access_token;
      tokenExpiresAt = exchanged.expires_in
        ? new Date(Date.now() + exchanged.expires_in * 1000).toISOString()
        : tokenExpiresAt;
      tokenDebug = await debugMetaToken(finalToken);
      tokenType = resolveMetaTokenType(tokenDebug);
      encryptedUserAccessToken = encrypt(finalToken);

      if (channel === 'instagram') {
        const pages = await fetchUserPagesForConnection(finalToken);
        candidates = pages.map((page) =>
          buildInstagramCandidate({
            authMethod: 'manual',
            grantedScopes: tokenDebug.scopes ?? [],
            page,
            pageAccessToken: page.access_token ? encrypt(page.access_token) : undefined,
            tokenExpiresAt,
            tokenType,
            tokenValid: tokenDebug.is_valid,
          })
        );
      }
    } else {
      if (channel === 'instagram') {
        const resolvedPageId = pageId || initialDebug.profile_id;

        if (!resolvedPageId) {
          throw new Error('Page ID obrigatório para token de página/Instagram neste modo avançado.');
        }

        const page = await fetchPageForConnection(resolvedPageId, accessToken);
        candidates = [
          buildInstagramCandidate({
            authMethod: 'manual',
            grantedScopes: tokenDebug.scopes ?? [],
            page,
            pageAccessToken: encrypt(accessToken),
            tokenExpiresAt,
            tokenType,
            tokenValid: tokenDebug.is_valid,
            limitedUse: true,
          }),
        ];
      }
    }

    if (channel === 'whatsapp') {
      if (!wabaId) {
        throw new Error('WABA ID é obrigatório para conectar WhatsApp.');
      }

      const businessAccount = await fetchWhatsAppBusinessAccountForConnection(wabaId, finalToken);
      const phoneNumbers = phoneNumberId
        ? [await fetchWhatsAppPhoneNumberForConnection(phoneNumberId, finalToken)]
        : await fetchWhatsAppPhoneNumbersForConnection(wabaId, finalToken);

      candidates = phoneNumbers.map((phone) =>
        buildWhatsAppCandidate({
          authMethod: 'manual',
          grantedScopes: tokenDebug.scopes ?? [],
          accessToken: encrypt(finalToken),
          wabaId: businessAccount.id,
          wabaName: phone.verified_name ?? businessAccount.name ?? phone.display_phone_number ?? 'WhatsApp Business',
          phoneNumberId: phone.id,
          phoneNumber: phone.display_phone_number,
          tokenExpiresAt,
          tokenType,
          tokenValid: tokenDebug.is_valid,
        })
      );
    }

    const session: MetaChannelConnectSession & {
      encryptedUserAccessToken?: string;
      tokenExpiresAt?: string;
    } = {
      ...baseSession,
      candidates,
      grantedScopes: tokenDebug.scopes ?? [],
      sourceTokenType: tokenType,
      sourceTokenStatus: resolveTokenStatus({
        expiresAt: tokenExpiresAt,
        isValid: tokenDebug.is_valid,
        limitedUse: channel === 'instagram' ? tokenType !== 'user' : false,
      }),
      status: candidates.length > 0 ? 'ready' : 'failed',
      updatedAt: new Date().toISOString(),
      ...(encryptedUserAccessToken ? { encryptedUserAccessToken } : {}),
      ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
      ...(candidates.length === 0 ? { lastError: 'Nenhuma conta elegível encontrada para este token.' } : {}),
    };

    await sessionRef.set(session, { merge: true });

    return NextResponse.json({
      session: sanitizeConnectSession(session),
      sessionId: sessionRef.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: mapMetaErrorMessage(error) },
      { status: 400 }
    );
  }
}
