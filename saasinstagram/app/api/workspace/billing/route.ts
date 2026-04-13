export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase/admin';
import { getPlan } from '@/lib/stripe/plans';
import type { PlanId } from '@/types/workspace';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const idToken = authHeader?.replace('Bearer ', '');
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const decoded = await verifyIdToken(idToken);
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  try {
    const db = getAdminFirestore();

    const snap = await db
      .collection('workspaces')
      .where('ownerUid', '==', decoded.uid)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const data = snap.docs[0].data();
    const plan = data.plan ?? { id: 'free', status: 'active' };
    const planId = (plan.id ?? 'free') as PlanId;
    const planDef = getPlan(planId);
    const limits = data.limits ?? planDef.limits;
    const usage = data.usage ?? { conversationsThisMonth: 0, aiMessagesThisMonth: 0, aiInteractionsThisMonth: 0 };

    let trialDaysRemaining: number | null = null;
    if (plan.trialEndsAt) {
      const diff = new Date(plan.trialEndsAt).getTime() - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return NextResponse.json({
      plan,
      limits,
      usage: {
        conversationsThisMonth: usage.conversationsThisMonth ?? 0,
        aiMessagesThisMonth: usage.aiMessagesThisMonth ?? 0,
        aiInteractionsThisMonth: usage.aiInteractionsThisMonth ?? 0,
      },
      trialDaysRemaining,
    });
  } catch (err) {
    console.error('workspace/billing error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
