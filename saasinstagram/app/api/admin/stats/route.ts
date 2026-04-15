export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { isAdminUid } from '@/lib/admin/auth';
import { PLANS } from '@/lib/stripe/plans';
import type { PlanId } from '@/types/workspace';

const AI_COST_PER_MESSAGE = 0.00023; // gpt-4o-mini average cost

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

  // Full workspace scan — admin only, not a hot path
  const wsSnap = await db.collection('workspaces').get();

  const byPlan: Record<string, number> = { free: 0, starter: 0, pro: 0, business: 0 };
  const byStatus: Record<string, number> = { active: 0, trialing: 0, canceled: 0, past_due: 0, incomplete: 0 };
  let totalAiMessages = 0;
  let mrr = 0;
  let paidActiveCount = 0;

  interface WorkspaceSummary {
    id: string;
    name: string;
    planId: string;
    status: string;
    createdAt: string;
    aiMessagesThisMonth: number;
  }
  const allWorkspaces: WorkspaceSummary[] = [];

  wsSnap.docs.forEach((doc) => {
    const d = doc.data();
    const planId = (d.plan?.id ?? 'free') as PlanId;
    const status: string = d.plan?.status ?? 'active';

    byPlan[planId] = (byPlan[planId] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    totalAiMessages += (d.usage?.aiMessagesThisMonth as number) ?? 0;

    const isPaid = planId !== 'free';
    const isActive = status === 'active' || status === 'trialing';
    if (isPaid && isActive) {
      paidActiveCount++;
      mrr += PLANS[planId]?.price.monthly ?? 0;
    }

    allWorkspaces.push({
      id: doc.id,
      name: (d.name as string) ?? '',
      planId,
      status,
      createdAt: toISO(d.createdAt),
      aiMessagesThisMonth: (d.usage?.aiMessagesThisMonth as number) ?? 0,
    });
  });

  // Latest 5 workspaces by createdAt
  allWorkspaces.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestWorkspaces = allWorkspaces.slice(0, 5);

  // Support ticket counts in parallel
  const [openSnap, inProgressSnap, resolvedSnap, closedSnap] = await Promise.all([
    db.collection('support_tickets').where('status', '==', 'open').count().get(),
    db.collection('support_tickets').where('status', '==', 'in_progress').count().get(),
    db.collection('support_tickets').where('status', '==', 'resolved').count().get(),
    db.collection('support_tickets').where('status', '==', 'closed').count().get(),
  ]);

  const estimatedAiCost = totalAiMessages * AI_COST_PER_MESSAGE;
  const estimatedStripeFees = mrr > 0 ? mrr * 0.029 + paidActiveCount * 0.3 : 0;
  const estimatedProfit = mrr - estimatedAiCost - estimatedStripeFees;
  const activeTotal = (byStatus.active ?? 0) + (byStatus.trialing ?? 0);

  return NextResponse.json({
    workspaces: {
      total: wsSnap.size,
      active: activeTotal,
      byPlan,
      byStatus,
      paidActive: paidActiveCount,
    },
    revenue: {
      mrr,
      estimatedStripeFees: parseFloat(estimatedStripeFees.toFixed(2)),
      estimatedProfit: parseFloat(estimatedProfit.toFixed(2)),
    },
    costs: {
      totalAiMessages,
      estimatedAiCost: parseFloat(estimatedAiCost.toFixed(4)),
    },
    tickets: {
      open: openSnap.data().count,
      inProgress: inProgressSnap.data().count,
      resolved: resolvedSnap.data().count,
      closed: closedSnap.data().count,
    },
    latestWorkspaces,
  });
}
