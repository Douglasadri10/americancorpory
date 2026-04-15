export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { isAdminUid } from '@/lib/admin/auth';

/** Safely convert Firestore Timestamp OR ISO string OR Date to an ISO string. */
function toISO(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    if ('toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
      try { return (val as { toDate(): Date }).toDate().toISOString(); } catch { return ''; }
    }
    if (val instanceof Date) return val.toISOString();
  }
  return '';
}

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUid(decoded.uid)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getAdminFirestore();
  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search')?.toLowerCase().trim() ?? '';
  const plan = searchParams.get('plan') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 50;

  // Firestore doesn't support server-side text search; filter in memory after fetch
  const snap = await db.collection('workspaces').orderBy('createdAt', 'desc').get();

  let workspaces = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: (d.name as string) ?? '',
      ownerUid: (d.ownerUid as string) ?? '',
      planId: (d.plan?.id as string) ?? 'free',
      status: (d.plan?.status as string) ?? 'active',
      createdAt: toISO(d.createdAt),
      aiMessagesThisMonth: (d.usage?.aiMessagesThisMonth as number) ?? 0,
      aiInteractionsThisMonth: (d.usage?.aiInteractionsThisMonth as number) ?? 0,
    };
  });

  if (search) {
    workspaces = workspaces.filter((w) => w.name.toLowerCase().includes(search));
  }
  if (plan) {
    workspaces = workspaces.filter((w) => w.planId === plan);
  }

  const total = workspaces.length;
  const paged = workspaces.slice((page - 1) * limit, page * limit);

  return NextResponse.json({ workspaces: paged, total, page, limit });
}
