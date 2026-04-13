export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { PLANS } from '@/lib/stripe/plans';

export async function POST(request: NextRequest) {
  const decodedToken = await authenticateRequest(request);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: string; ownerEmail?: string; ownerDisplayName?: string };
  try {
    body = await request.json() as { name?: string; ownerEmail?: string; ownerDisplayName?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { name, ownerEmail, ownerDisplayName } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const db = getAdminFirestore();

  // One workspace per user — prevent duplicates
  const existing = await db
    .collection('workspaces')
    .where('ownerUid', '==', decodedToken.uid)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    return NextResponse.json({ workspace: { id: doc.id, ...doc.data() } });
  }

  const ref = db.collection('workspaces').doc();
  const id = ref.id;
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const now = new Date().toISOString();
  const freePlan = PLANS.free;

  const workspace = {
    id,
    name: name.trim(),
    slug: `${slug}-${id.slice(0, 6)}`,
    ownerUid: decodedToken.uid,
    members: [
      {
        uid: decodedToken.uid,
        email: ownerEmail ?? decodedToken.email ?? '',
        displayName: ownerDisplayName ?? decodedToken.name ?? '',
        role: 'owner',
        joinedAt: now,
        isActive: true,
      },
    ],
    plan: {
      id: 'free',
      status: 'active',
    },
    limits: freePlan.limits,
    settings: {
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      businessHours: {
        enabled: false,
        schedule: {
          monday: { open: '09:00', close: '18:00', enabled: true },
          tuesday: { open: '09:00', close: '18:00', enabled: true },
          wednesday: { open: '09:00', close: '18:00', enabled: true },
          thursday: { open: '09:00', close: '18:00', enabled: true },
          friday: { open: '09:00', close: '18:00', enabled: true },
          saturday: { open: '09:00', close: '13:00', enabled: false },
          sunday: { open: '09:00', close: '13:00', enabled: false },
        },
      },
      autoAssignment: { enabled: false, strategy: 'round_robin' },
      notifications: {
        newConversation: true,
        newMessage: true,
        assignedToMe: true,
      },
    },
    usage: {
      conversationsThisMonth: 0,
      aiMessagesThisMonth: 0,
      aiInteractionsThisMonth: 0,
      lastResetAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(workspace);

  return NextResponse.json({ workspace }, { status: 201 });
}
