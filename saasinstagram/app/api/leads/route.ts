export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import type { Lead } from '@/types/lead';

function errResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal error';
  const status =
    message === 'workspace_not_found' ? 404 :
    message === 'workspace_forbidden' ? 403 :
    500;
  return NextResponse.json({ error: status === 500 ? 'Internal error' : message.replaceAll('_', ' ') }, { status });
}

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const snap = await db
      .collection('leads')
      .where('workspaceId', '==', workspaceId)
      .get();

    const leads = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Lead)
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

    // Backfill avatarURL for leads that were created before this field was stored.
    // For each lead missing avatarURL, fetch the linked conversation and copy the
    // contact avatar — batch all conversation fetches in one round-trip.
    const needsAvatar = leads.filter((l) => !l.avatarURL && l.conversationIds?.length);
    if (needsAvatar.length > 0) {
      const convIds = [...new Set(needsAvatar.flatMap((l) => l.conversationIds.slice(0, 1)))];
      const convSnaps = await Promise.all(
        convIds.map((id) => db.collection('conversations').doc(id).get())
      );
      const avatarMap = new Map<string, string>();
      for (const snap of convSnaps) {
        if (snap.exists) {
          const d = snap.data() as { contact?: { avatarURL?: string }; id?: string };
          if (d.contact?.avatarURL) avatarMap.set(snap.id, d.contact.avatarURL);
        }
      }
      // Write missing avatarURL back to Firestore (fire-and-forget)
      const batch = db.batch();
      for (const lead of needsAvatar) {
        const convId = lead.conversationIds[0];
        const avatar = convId ? avatarMap.get(convId) : undefined;
        if (avatar) {
          lead.avatarURL = avatar;
          batch.update(db.collection('leads').doc(lead.id), { avatarURL: avatar });
        }
      }
      void batch.commit().catch(() => null);
    }

    const stats = {
      total: leads.length,
      new: leads.filter((l) => l.status === 'new').length,
      won: leads.filter((l) => l.status === 'won').length,
      lost: leads.filter((l) => l.status === 'lost').length,
      totalValue: leads.reduce((acc, l) => acc + (l.dealValue ?? 0), 0),
    };

    return NextResponse.json({ leads, stats });
  } catch (err) {
    return errResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Partial<Lead>;
  try {
    body = await request.json() as Partial<Lead>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { workspaceId } = body;
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const tags = body.tags ?? [];
  const customFields = body.customFields ?? [];
  const activities = body.activities ?? [];

  if (!Array.isArray(tags) || tags.length > 50) {
    return NextResponse.json({ error: 'tags deve ter no máximo 50 itens' }, { status: 400 });
  }
  if (!Array.isArray(customFields) || customFields.length > 100) {
    return NextResponse.json({ error: 'customFields deve ter no máximo 100 itens' }, { status: 400 });
  }
  if (!Array.isArray(activities) || activities.length > 500) {
    return NextResponse.json({ error: 'activities deve ter no máximo 500 itens' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const ref = db.collection('leads').doc();
    const now = new Date().toISOString();
    const lead: Lead = {
      id: ref.id,
      workspaceId,
      name: body.name.trim(),
      email: body.email?.trim() || undefined,
      phone: body.phone?.trim() || undefined,
      company: body.company?.trim() || undefined,
      source: body.source ?? 'manual',
      status: body.status ?? 'new',
      conversationIds: body.conversationIds ?? [],
      tags,
      customFields,
      activities,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(lead);
    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    return errResponse(err);
  }
}
