export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import {
  buildConnectedChannelFromCandidate,
  buildFacebookCandidate,
  buildInstagramCandidate,
  debugMetaToken,
  fetchPageForConnection,
  fetchUserPagesForConnection,
  mapMetaErrorMessage,
  normalizeConnectedChannel,
  resolveTokenStatus,
  subscribeInstagramWebhook,
} from '@/lib/meta/connection';
import { decryptIfNeeded, encrypt } from '@/lib/utils/encryption';
import { getOwnedChannel } from '@/lib/workspaces/access';
import type { MetaConnectedChannel } from '@/types/meta';

function getDebugExpiresAt(expiresAt?: number) {
  if (!expiresAt || expiresAt <= 0) {
    return undefined;
  }

  return new Date(expiresAt * 1000).toISOString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const { channelSnap, channelData } = await getOwnedChannel(db, params.id, decoded.uid);
    const channel = { id: channelSnap.id, ...channelData } as MetaConnectedChannel;

    if (channel.channel === 'whatsapp') {
      const tokenDebug = await debugMetaToken(decryptIfNeeded(channel.accessToken));
      const nextTokenStatus = resolveTokenStatus({
        expiresAt: getDebugExpiresAt(tokenDebug.expires_at) ?? channel.tokenExpiresAt,
        isValid: tokenDebug.is_valid,
      });
      const refreshedWhatsAppChannel = normalizeConnectedChannel({
        ...channel,
        tokenStatus: nextTokenStatus,
        lastValidatedAt: new Date().toISOString(),
        lastTokenRefreshAt: new Date().toISOString(),
        lastRefreshError: tokenDebug.is_valid ? undefined : 'Token expirado, revogado ou sem autorização suficiente.',
        reauthorizationRequired: !tokenDebug.is_valid,
        updatedAt: new Date().toISOString(),
      });

      await channelSnap.ref.set(refreshedWhatsAppChannel, { merge: true });

      return NextResponse.json({
        channel: refreshedWhatsAppChannel,
        success: tokenDebug.is_valid,
      }, { status: tokenDebug.is_valid ? 200 : 400 });
    }

    const now = new Date().toISOString();
    const currentPageToken = decryptIfNeeded(channel.accessToken);
    const currentUserToken = channel.userAccessToken ? decryptIfNeeded(channel.userAccessToken) : undefined;
    const authMethod = channel.authMethod ?? 'oauth';
    const buildCandidate = channel.channel === 'facebook' ? buildFacebookCandidate : buildInstagramCandidate;

    let refreshedChannel: MetaConnectedChannel | null = null;
    let lastError = '';

    if (currentUserToken) {
      try {
        const userDebug = await debugMetaToken(currentUserToken);
        if (!userDebug.is_valid) {
          throw new Error('User token inválido ou revogado.');
        }

        const pages = await fetchUserPagesForConnection(currentUserToken);
        const page = pages.find((item) => item.id === channel.pageId);

        if (!page) {
          throw new Error('Página não encontrada para o user token atual.');
        }

        const nextPageToken = page.access_token ?? currentPageToken;
        const candidate = buildCandidate({
          authMethod,
          grantedScopes: userDebug.scopes ?? [],
          page,
          pageAccessToken: encrypt(nextPageToken),
          tokenExpiresAt: getDebugExpiresAt(userDebug.expires_at) ?? channel.tokenExpiresAt,
          tokenType: 'user',
          tokenValid: true,
        });

        if (!candidate.isEligible) {
          throw new Error(candidate.statusReason ?? 'Conta não elegível para este canal.');
        }

        await subscribeInstagramWebhook({
          accessToken: nextPageToken,
          instagramAccountId: candidate.instagramAccountIdApi ?? candidate.instagramAccountId,
          pageId: candidate.pageId,
        });

        refreshedChannel = buildConnectedChannelFromCandidate({
          authMethod,
          candidate,
          channelId: channel.id,
          encryptedAccessToken: candidate.pageAccessToken!,
          encryptedUserAccessToken: channel.userAccessToken,
          existing: channel,
          tokenExpiresAt: getDebugExpiresAt(userDebug.expires_at) ?? channel.tokenExpiresAt,
          webhookStatus: 'subscribed',
          workspaceId: channel.workspaceId,
        });
      } catch (error) {
        lastError = mapMetaErrorMessage(error);
      }
    }

    if (!refreshedChannel) {
      try {
        const pageDebug = await debugMetaToken(currentPageToken);
        if (!pageDebug.is_valid) {
          throw new Error('Page token inválido ou revogado.');
        }

        const page = await fetchPageForConnection(channel.pageId, currentPageToken);
        const pageAccessToken = page.access_token ?? currentPageToken;
        const candidate = buildCandidate({
          authMethod,
          grantedScopes: pageDebug.scopes ?? channel.grantedScopes ?? [],
          page,
          pageAccessToken: encrypt(pageAccessToken),
          tokenExpiresAt: getDebugExpiresAt(pageDebug.expires_at) ?? channel.tokenExpiresAt,
          tokenType: channel.tokenType ?? 'page',
          tokenValid: true,
          limitedUse: channel.channel === 'instagram' && !channel.userAccessToken,
        });

        if (!candidate.isEligible) {
          const ineligibleChannel = normalizeConnectedChannel({
            ...channel,
            tokenStatus: candidate.tokenStatus,
            webhookStatus: 'pending',
            webhookVerified: false,
            igConnectionStatus: candidate.igConnectionStatus,
            grantedScopes: candidate.grantedScopes,
            requiredScopes: candidate.requiredScopes,
            lastValidatedAt: now,
            lastTokenRefreshAt: now,
            lastRefreshError: candidate.statusReason,
            reauthorizationRequired: candidate.tokenStatus === 'invalid' || candidate.tokenStatus === 'missing_scopes',
            updatedAt: now,
          });

          await channelSnap.ref.set(ineligibleChannel, { merge: true });

          return NextResponse.json(
            { channel: ineligibleChannel, error: candidate.statusReason },
            { status: 400 }
          );
        }

        await subscribeInstagramWebhook({
          accessToken: pageAccessToken,
          instagramAccountId: candidate.instagramAccountIdApi ?? candidate.instagramAccountId,
          pageId: candidate.pageId,
        });

        refreshedChannel = buildConnectedChannelFromCandidate({
          authMethod,
          candidate,
          channelId: channel.id,
          encryptedAccessToken: candidate.pageAccessToken!,
          encryptedUserAccessToken: channel.userAccessToken,
          existing: channel,
          tokenExpiresAt: getDebugExpiresAt(pageDebug.expires_at) ?? channel.tokenExpiresAt,
          webhookStatus: 'subscribed',
          workspaceId: channel.workspaceId,
        });
      } catch (error) {
        lastError = lastError || mapMetaErrorMessage(error);
      }
    }

    if (!refreshedChannel) {
      const failedChannel = normalizeConnectedChannel({
        ...channel,
        tokenStatus: 'invalid',
        webhookStatus: 'failed',
        webhookVerified: false,
        lastValidatedAt: now,
        lastTokenRefreshAt: now,
        lastRefreshError: lastError || 'Falha ao atualizar token.',
        reauthorizationRequired: true,
        updatedAt: now,
      });

      await channelSnap.ref.set(failedChannel, { merge: true });

      return NextResponse.json(
        { channel: failedChannel, error: failedChannel.lastRefreshError },
        { status: 400 }
      );
    }

    refreshedChannel = normalizeConnectedChannel({
      ...refreshedChannel,
      lastValidatedAt: now,
      lastTokenRefreshAt: now,
      lastRefreshError: undefined,
      reauthorizationRequired: false,
      updatedAt: now,
    });

    await channelSnap.ref.set(refreshedChannel, { merge: true });

    return NextResponse.json({
      channel: refreshedChannel,
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    const status =
      message === 'channel_not_found' ? 404 :
      message === 'workspace_forbidden' ? 403 :
      500;

    return NextResponse.json({ error: mapMetaErrorMessage(message) }, { status });
  }
}
