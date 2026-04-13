export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { exchangeForLongLivedToken } from '@/lib/meta/graph';
import {
  buildFacebookCandidate,
  buildInstagramCandidate,
  debugMetaToken,
  fetchUserPagesForConnection,
  mapMetaErrorMessage,
  META_CONNECT_SESSION_COLLECTION,
  META_CONNECT_SESSION_TTL_MS,
  parseMetaConnectionState,
  resolveMetaTokenType,
  resolveTokenStatus,
} from '@/lib/meta/connection';
import { encrypt } from '@/lib/utils/encryption';

function getAppUrl(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/channels?error=${encodeURIComponent(errorDescription ?? error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/channels?error=missing_params`);
  }

  const db = getAdminFirestore();

  try {
    const statePayload = parseMetaConnectionState(state);

    if (new Date(statePayload.expiresAt).getTime() <= Date.now()) {
      return NextResponse.redirect(`${appUrl}/channels?error=session_expired`);
    }

    const { workspaceId, ownerUid, channel } = statePayload;

    if (!workspaceId || !ownerUid || (channel !== 'instagram' && channel !== 'facebook')) {
      return NextResponse.redirect(`${appUrl}/channels?error=invalid_state`);
    }

    const appId = process.env.META_APP_ID ?? '';
    const appSecret = process.env.META_APP_SECRET ?? '';
    const redirectUri = `${appUrl}/api/meta/callback`;

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${appSecret}&code=${code}`
    );

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      error?: { message?: string };
    };

    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message ?? 'Falha ao obter access token');
    }

    const longLivedToken = await exchangeForLongLivedToken(
      tokenData.access_token,
      appId,
      appSecret
    );

    const tokenDebug = await debugMetaToken(longLivedToken.access_token);
    const tokenExpiresAt = longLivedToken.expires_in
      ? new Date(Date.now() + longLivedToken.expires_in * 1000).toISOString()
      : undefined;
    const pages = await fetchUserPagesForConnection(longLivedToken.access_token);

    const candidates = pages.map((page) =>
      channel === 'facebook'
        ? buildFacebookCandidate({
            authMethod: 'oauth',
            grantedScopes: tokenDebug.scopes ?? [],
            page,
            pageAccessToken: page.access_token ? encrypt(page.access_token) : undefined,
            tokenExpiresAt,
            tokenType: resolveMetaTokenType(tokenDebug),
            tokenValid: tokenDebug.is_valid,
          })
        : buildInstagramCandidate({
            authMethod: 'oauth',
            grantedScopes: tokenDebug.scopes ?? [],
            page,
            pageAccessToken: page.access_token ? encrypt(page.access_token) : undefined,
            tokenExpiresAt,
            tokenType: resolveMetaTokenType(tokenDebug),
            tokenValid: tokenDebug.is_valid,
          })
    );

    const now = new Date().toISOString();
    const sessionRef = db.collection(META_CONNECT_SESSION_COLLECTION).doc();

    await sessionRef.set({
      id: sessionRef.id,
      workspaceId,
      ownerUid,
      channel,
      authMethod: 'oauth',
      candidates,
      encryptedUserAccessToken: encrypt(longLivedToken.access_token),
      grantedScopes: tokenDebug.scopes ?? [],
      requiredScopes: [],
      sourceTokenType: resolveMetaTokenType(tokenDebug),
      sourceTokenStatus: resolveTokenStatus({
        expiresAt: tokenExpiresAt,
        isValid: tokenDebug.is_valid,
      }),
      tokenExpiresAt,
      expiresAt: new Date(Date.now() + META_CONNECT_SESSION_TTL_MS).toISOString(),
      status: candidates.length > 0 ? 'ready' : 'failed',
      lastError: candidates.length > 0 ? undefined : 'Nenhuma Página encontrada para este usuário Meta.',
      createdAt: now,
      updatedAt: now,
    });

    if (candidates.length === 0) {
      return NextResponse.redirect(
        `${appUrl}/channels?error=${encodeURIComponent('Nenhuma Página encontrada para este usuário Meta.')}`
      );
    }

    return NextResponse.redirect(
      `${appUrl}/channels?connectSession=${encodeURIComponent(sessionRef.id)}`
    );
  } catch (callbackError) {
    const mappedError = mapMetaErrorMessage(callbackError);

    return NextResponse.redirect(
      `${appUrl}/channels?error=${encodeURIComponent(mappedError)}`
    );
  }
}
