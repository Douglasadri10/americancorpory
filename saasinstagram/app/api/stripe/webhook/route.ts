export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe/client';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getPlanLimits } from '@/lib/stripe/plans';
import type { PlanId } from '@/types/workspace';
import type Stripe from 'stripe';

// Disable body parsing for raw body access
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(db, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(db, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(db, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(db, invoice);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(db, session);
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function findWorkspaceByCustomer(
  db: ReturnType<typeof getAdminFirestore>,
  customerId: string
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const snap = await db
    .collection('workspaces')
    .where('plan.stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return { id: snap.docs[0].id, data: snap.docs[0].data() };
}

async function getPlanFromPriceId(priceId: string): Promise<PlanId> {
  const starterMonthly = process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '';
  const starterAnnual = process.env.STRIPE_PRICE_STARTER_ANNUAL ?? '';
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY ?? '';
  const proAnnual = process.env.STRIPE_PRICE_PRO_ANNUAL ?? '';
  const businessMonthly = process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '';
  const businessAnnual = process.env.STRIPE_PRICE_BUSINESS_ANNUAL ?? '';

  if ([starterMonthly, starterAnnual].filter(Boolean).includes(priceId)) return 'starter';
  if ([proMonthly, proAnnual].filter(Boolean).includes(priceId)) return 'pro';
  if ([businessMonthly, businessAnnual].filter(Boolean).includes(priceId)) return 'business';
  return 'free'; // fallback for unknown price IDs — never grant elevated plan
}

async function handleSubscriptionChange(
  db: ReturnType<typeof getAdminFirestore>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const workspace = await findWorkspaceByCustomer(db, customerId);
  if (!workspace) {
    console.warn('Workspace not found for customer:', customerId);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? '';
  const planId = await getPlanFromPriceId(priceId);
  const limits = getPlanLimits(planId);

  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
    unpaid: 'past_due',
    paused: 'past_due',
  };

  await db.collection('workspaces').doc(workspace.id).update({
    'plan.id': planId,
    'plan.stripeSubscriptionId': subscription.id,
    'plan.stripePriceId': priceId,
    'plan.status': statusMap[subscription.status] ?? subscription.status,
    'plan.currentPeriodStart': new Date(subscription.current_period_start * 1000).toISOString(),
    'plan.currentPeriodEnd': new Date(subscription.current_period_end * 1000).toISOString(),
    'plan.cancelAtPeriodEnd': subscription.cancel_at_period_end,
    limits,
    updatedAt: new Date().toISOString(),
  });

  console.log(`Updated workspace ${workspace.id} to plan ${planId}`);
}

async function handleSubscriptionCanceled(
  db: ReturnType<typeof getAdminFirestore>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const workspace = await findWorkspaceByCustomer(db, customerId);
  if (!workspace) return;

  const freeLimits = getPlanLimits('free');

  await db.collection('workspaces').doc(workspace.id).update({
    'plan.id': 'free',
    'plan.status': 'active',
    'plan.stripeSubscriptionId': null,
    'plan.stripePriceId': null,
    'plan.cancelAtPeriodEnd': false,
    'plan.currentPeriodEnd': null,
    limits: freeLimits,
    updatedAt: new Date().toISOString(),
  });
}

async function handlePaymentSucceeded(
  db: ReturnType<typeof getAdminFirestore>,
  invoice: Stripe.Invoice
) {
  if (!invoice.customer) return;
  const customerId = invoice.customer as string;
  const workspace = await findWorkspaceByCustomer(db, customerId);
  if (!workspace) return;

  // Log payment success (optional: create invoice record)
  console.log(`Payment succeeded for workspace ${workspace.id}: ${invoice.amount_paid / 100}`);
}

async function handlePaymentFailed(
  db: ReturnType<typeof getAdminFirestore>,
  invoice: Stripe.Invoice
) {
  if (!invoice.customer) return;
  const customerId = invoice.customer as string;
  const workspace = await findWorkspaceByCustomer(db, customerId);
  if (!workspace) return;

  await db.collection('workspaces').doc(workspace.id).update({
    'plan.status': 'past_due',
    updatedAt: new Date().toISOString(),
  });

  console.log(`Payment failed for workspace ${workspace.id}`);
}

async function handleCheckoutCompleted(
  db: ReturnType<typeof getAdminFirestore>,
  session: Stripe.Checkout.Session
) {
  const workspaceId = session.metadata?.workspaceId;
  const customerId = session.customer as string;

  if (!workspaceId || !customerId) return;

  // Store customer ID in workspace
  await db.collection('workspaces').doc(workspaceId).update({
    'plan.stripeCustomerId': customerId,
    updatedAt: new Date().toISOString(),
  });
}
