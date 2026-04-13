export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getOrCreateCustomer, createCheckoutSession } from '@/lib/stripe/client';
import { PLANS } from '@/lib/stripe/plans';
import type { PlanId } from '@/types/workspace';

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { planId: PlanId; billingCycle: 'monthly' | 'annual' };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { planId, billingCycle } = body;
  if (!planId || !billingCycle) {
    return NextResponse.json({ error: 'planId and billingCycle are required' }, { status: 400 });
  }

  const plan = PLANS[planId];
  if (!plan) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Guard: Stripe not configured in this environment
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments not configured. Contact support.' }, { status: 503 });
  }

  const priceId = plan.stripePriceId[billingCycle];
  // Placeholder price IDs (env vars not set) → reject early instead of letting Stripe throw
  if (!priceId || priceId.startsWith('price_starter_') || priceId.startsWith('price_pro_') || priceId.startsWith('price_business_')) {
    return NextResponse.json({ error: 'Payments not configured. Contact support.' }, { status: 503 });
  }

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

    const workspaceId = snap.docs[0].id;
    const email = decoded.email ?? '';
    const name = decoded.name ?? email;

    const customerId = await getOrCreateCustomer(workspaceId, email, name);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await createCheckoutSession({
      customerId,
      priceId,
      workspaceId,
      successUrl: `${appUrl}/billing?success=1`,
      cancelUrl: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const stripeMsg = (err as { message?: string })?.message ?? String(err);
    const stripeCode = (err as { code?: string })?.code ?? '';
    const stripeType = (err as { type?: string })?.type ?? '';
    console.error('stripe/checkout error:', stripeType, stripeCode, stripeMsg);
    // Expose readable message in non-auth errors so UI can display it
    const userMsg = stripeType === 'StripeInvalidRequestError'
      ? stripeMsg
      : 'Internal error';
    return NextResponse.json({ error: userMsg }, { status: 500 });
  }
}
