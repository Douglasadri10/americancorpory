import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const db = admin.firestore();

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = functions.config().stripe?.secret_key ?? process.env.STRIPE_SECRET_KEY ?? '';
    stripeClient = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  }
  return stripeClient;
}

const planLimits: Record<string, {
  maxAgents: number;
  maxConversationsPerMonth: number;
  maxAutomations: number;
  maxChannels: number;
  aiMessagesPerMonth: number;
}> = {
  starter: {
    maxAgents: 2,
    maxConversationsPerMonth: 500,
    maxAutomations: 5,
    maxChannels: 2,
    aiMessagesPerMonth: 200,
  },
  growth: {
    maxAgents: 10,
    maxConversationsPerMonth: 3000,
    maxAutomations: 25,
    maxChannels: 6,
    aiMessagesPerMonth: 1000,
  },
  enterprise: {
    maxAgents: 50,
    maxConversationsPerMonth: 20000,
    maxAutomations: 100,
    maxChannels: 20,
    aiMessagesPerMonth: 10000,
  },
};

/**
 * Stripe webhook handler as a Cloud Function.
 * Alternative to the Next.js API route.
 */
export const stripeWebhook = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const webhookSecret = functions.config().stripe?.webhook_secret ?? process.env.STRIPE_WEBHOOK_SECRET ?? '';
    const signature = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      const stripe = getStripe();
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      functions.logger.error('Stripe webhook signature error:', error);
      res.status(400).send('Invalid signature');
      return;
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          await handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;
        }
        case 'customer.subscription.deleted': {
          await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
          break;
        }
        case 'invoice.payment_succeeded': {
          await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        }
        case 'invoice.payment_failed': {
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        }
        case 'checkout.session.completed': {
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        }
        default:
          functions.logger.log(`Unhandled event: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      functions.logger.error('Stripe webhook processing error:', error);
      res.status(500).send('Processing failed');
    }
  });

async function findWorkspaceByCustomer(customerId: string) {
  const snap = await db
    .collection('workspaces')
    .where('plan.stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id };
}

function getPlanIdFromPriceId(priceId: string): string {
  const config = functions.config();
  if (priceId === (config.stripe?.price_starter ?? process.env.STRIPE_PRICE_STARTER)) return 'starter';
  if (priceId === (config.stripe?.price_growth ?? process.env.STRIPE_PRICE_GROWTH)) return 'growth';
  if (priceId === (config.stripe?.price_enterprise ?? process.env.STRIPE_PRICE_ENTERPRISE)) return 'enterprise';
  return 'starter';
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const workspace = await findWorkspaceByCustomer(customerId);
  if (!workspace) return;

  const priceId = subscription.items.data[0]?.price?.id ?? '';
  const planId = getPlanIdFromPriceId(priceId);
  const limits = planLimits[planId] ?? planLimits.starter;

  const statusMap: Partial<Record<Stripe.Subscription.Status, string>> = {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
    incomplete: 'incomplete',
    unpaid: 'past_due',
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
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const workspace = await findWorkspaceByCustomer(subscription.customer as string);
  if (!workspace) return;

  await db.collection('workspaces').doc(workspace.id).update({
    'plan.id': 'starter',
    'plan.status': 'canceled',
    limits: planLimits.starter,
    updatedAt: new Date().toISOString(),
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.customer) return;
  functions.logger.info(`Payment succeeded: ${invoice.amount_paid / 100} for customer ${invoice.customer}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.customer) return;
  const workspace = await findWorkspaceByCustomer(invoice.customer as string);
  if (!workspace) return;

  await db.collection('workspaces').doc(workspace.id).update({
    'plan.status': 'past_due',
    updatedAt: new Date().toISOString(),
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const workspaceId = session.metadata?.workspaceId;
  const customerId = session.customer as string;
  if (!workspaceId || !customerId) return;

  await db.collection('workspaces').doc(workspaceId).update({
    'plan.stripeCustomerId': customerId,
    updatedAt: new Date().toISOString(),
  });
}
