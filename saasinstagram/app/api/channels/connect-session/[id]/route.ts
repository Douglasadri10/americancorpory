export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import {
  buildConnectedChannelFromCandidate,
  mapMetaErrorMessage,
  META_CONNECT_SESSION_COLLECTION,
  normalizeConnectedChannel,
  sanitizeConnectSession,
  subscribeInstagramWebhook,
} from '@/lib/meta/connection';
import { decryptIfNeeded } from '@/lib/utils/encryption';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import type { MetaChannelConnectSession, MetaConnectedChannel, MetaConnectionCandidate } from '@/types/meta';

interface ConnectSessionBody {
  candidateId?: string;
}

function isSessionExpired(expiresAt?: string) {
  return !expiresAt || new Date(expiresAt).getTime() <= Date.now();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminFirestore();
  const sessionSnap = await db.collection(META_CONNECT_SESSION_COLLECTION).doc(params.id).get();

  if (!sessionSnap.exists) {
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
  }

  const session = sessionSnap.data() as MetaChannelConnectSession;

  if (session.ownerUid !== decoded.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (isSessionExpired(session.expiresAt)) {
    await sessionSnap.ref.set(
      {
        status: 'expired',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ error: 'Sessão expirada' }, { status: 410 });
  }

  return NextResponse.json({
    session: sanitizeConnectSession(session),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ConnectSessionBody;
  try {
    body = await request.json() as ConnectSessionBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.candidateId) {
    return NextResponse.json({ error: 'candidateId é obrigatório' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const sessionRef = db.collection(META_CONNECT_SESSION_COLLECTION).doc(params.id);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    const session = sessionSnap.data() as MetaChannelConnectSession & {
      encryptedUserAccessToken?: string;
      tokenExpiresAt?: string;
    };

    if (session.ownerUid !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (isSessionExpired(session.expiresAt)) {
      await sessionRef.set(
        {
          status: 'expired',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return NextResponse.json({ error: 'Sessão expirada' }, { status: 410 });
    }

    await getOwnedWorkspace(db, session.workspaceId, decoded.uid);

    const candidate = session.candidates.find((item) => item.id === body.candidateId) as MetaConnectionCandidate | undefined;
    if (!candidate) {
      return NextResponse.json({ error: 'Conta selecionada não encontrada' }, { status: 404 });
    }

    if (!candidate.pageAccessToken) {
      return NextResponse.json({ error: 'Token de página ausente para esta conta' }, { status: 400 });
    }

    if (candidate.missingScopes.length > 0) {
      return NextResponse.json(
        { error: `Permissões faltando: ${candidate.missingScopes.join(', ')}` },
        { status: 400 }
      );
    }

    if (candidate.channel === 'instagram' && candidate.igConnectionStatus !== 'connected') {
      return NextResponse.json(
        { error: 'Conta IG não vinculada à Página.' },
        { status: 400 }
      );
    }

    if (candidate.channel === 'whatsapp' && !candidate.phoneNumberId) {
      return NextResponse.json({ error: 'Phone Number ID não encontrado para o canal selecionado.' }, { status: 400 });
    }

    if (candidate.channel !== 'whatsapp') {
      const pageAccessToken = decryptIfNeeded(candidate.pageAccessToken);
      await subscribeInstagramWebhook({
        accessToken: pageAccessToken,
        instagramAccountId: candidate.instagramAccountIdApi ?? candidate.instagramAccountId,
        pageId: candidate.pageId,
      });
    }

    // ── Global channel registry: prevent same channel across multiple workspaces ──
    const globalUniqueId = candidate.channel === 'whatsapp' ? candidate.phoneNumberId : candidate.pageId;
    const registryKey = `${candidate.channel}_${globalUniqueId}`;
    const registryRef = db.collection('channelRegistry').doc(registryKey);
    const registrySnap = await registryRef.get();

    if (registrySnap.exists) {
      const reg = registrySnap.data()!;
      // Locked to a different workspace
      if (reg.workspaceId && reg.workspaceId !== session.workspaceId) {
        return NextResponse.json(
          { error: 'Este canal já está conectado a outra conta HannaAI.' },
          { status: 409 }
        );
      }
      // In cooldown — recently disconnected from another workspace
      if (!reg.workspaceId && reg.cooldownUntil && new Date(reg.cooldownUntil as string) > new Date()) {
        const msLeft = new Date(reg.cooldownUntil as string).getTime() - Date.now();
        const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
        return NextResponse.json(
          {
            error: `Este canal foi desconectado recentemente. Aguarde ${hoursLeft}h para conectá-lo novamente.`,
            cooldownUntil: reg.cooldownUntil,
          },
          { status: 429 }
        );
      }
    }

    const existingField = candidate.channel === 'whatsapp' ? 'phoneNumberId' : 'pageId';
    const existingValue = candidate.channel === 'whatsapp' ? candidate.phoneNumberId : candidate.pageId;
    const existingSnap = await db
      .collection('channels')
      .where('workspaceId', '==', session.workspaceId)
      .where('channel', '==', session.channel)
      .where(existingField, '==', existingValue)
      .limit(1)
      .get();

    const existingDoc = existingSnap.empty ? undefined : existingSnap.docs[0];

    // Enforce maxChannels limit — only check for NEW channel connections
    if (!existingDoc) {
      const [channelCountSnap, wsSnap] = await Promise.all([
        db.collection('channels').where('workspaceId', '==', session.workspaceId).count().get(),
        db.collection('workspaces').doc(session.workspaceId).get(),
      ]);
      const maxChannels: number = (wsSnap.data()?.limits as Record<string, number> | undefined)?.maxChannels ?? 2;
      if (channelCountSnap.data().count >= maxChannels) {
        return NextResponse.json({ error: 'channel_limit_reached' }, { status: 429 });
      }
    }

    const existingChannel = existingDoc
      ? ({ id: existingDoc.id, ...existingDoc.data() } as MetaConnectedChannel)
      : undefined;
    const channelId = existingDoc?.id ?? db.collection('channels').doc().id;
    const connectedChannel = buildConnectedChannelFromCandidate({
      authMethod: session.authMethod,
      candidate,
      channelId,
      encryptedAccessToken: candidate.pageAccessToken,
      encryptedUserAccessToken: session.encryptedUserAccessToken,
      existing: existingChannel,
      tokenExpiresAt: session.tokenExpiresAt,
      webhookStatus: candidate.channel === 'whatsapp' ? 'subscribed' : 'subscribed',
      workspaceId: session.workspaceId,
    });

    await db.collection('channels').doc(channelId).set(connectedChannel, { merge: true });

    // Update global registry — mark channel as owned by this workspace
    await registryRef.set({
      channel: candidate.channel,
      uniqueId: globalUniqueId,
      workspaceId: session.workspaceId,
      connectedAt: new Date().toISOString(),
      disconnectedAt: null,
      cooldownUntil: null,
    });

    await sessionRef.set(
      {
        selectedCandidateId: candidate.id,
        status: 'connected',
        connectedChannelId: channelId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      channel: normalizeConnectedChannel(connectedChannel),
      success: true,
    });
  } catch (error) {
    const message = mapMetaErrorMessage(error);
    await getAdminFirestore().collection(META_CONNECT_SESSION_COLLECTION).doc(params.id).set(
      {
        lastError: message,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
