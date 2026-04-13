export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import {
  FACEBOOK_OAUTH_SCOPE,
  createMetaConnectionState,
  getRequiredScopes,
  INSTAGRAM_OAUTH_SCOPE,
  META_CONNECT_SESSION_TTL_MS,
  mapMetaErrorMessage,
} from '@/lib/meta/connection';
import { generateToken } from '@/lib/utils/encryption';
import { getOwnedWorkspace } from '@/lib/workspaces/access';

interface StartOAuthBody {
  channel?: 'instagram' | 'facebook';
  workspaceId?: string;
}

function getAppUrl(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: StartOAuthBody;
  try {
    body = await request.json() as StartOAuthBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  const channel = body.channel ?? 'instagram';

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId é obrigatório' }, { status: 400 });
  }

  if (channel !== 'instagram' && channel !== 'facebook') {
    return NextResponse.json({ error: 'Canal OAuth inválido' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const nonce = generateToken(16);
    const expiresAt = new Date(Date.now() + META_CONNECT_SESSION_TTL_MS).toISOString();

    const redirectUri = `${getAppUrl(request)}/api/meta/callback`;
    const state = createMetaConnectionState(workspaceId, decoded.uid, channel, nonce, expiresAt);
    const appId = process.env.META_APP_ID ?? process.env.NEXT_PUBLIC_META_APP_ID ?? '';

    if (!appId) {
      throw new Error('META_APP_ID não configurado');
    }

    const authUrl =
      `https://www.facebook.com/dialog/oauth?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(channel === 'facebook' ? FACEBOOK_OAUTH_SCOPE : INSTAGRAM_OAUTH_SCOPE)}` +
      `&state=${encodeURIComponent(state)}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar OAuth';
    const status = message === 'workspace_forbidden' ? 403 : message === 'workspace_not_found' ? 404 : 500;

    return NextResponse.json(
      { error: mapMetaErrorMessage(message) },
      { status }
    );
  }
}
