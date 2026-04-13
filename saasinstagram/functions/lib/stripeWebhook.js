"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const db = admin.firestore();
let stripeClient = null;
function getStripe() {
    if (!stripeClient) {
        const secretKey = functions.config().stripe?.secret_key ?? process.env.STRIPE_SECRET_KEY ?? '';
        stripeClient = new stripe_1.default(secretKey, { apiVersion: '2024-06-20' });
    }
    return stripeClient;
}
const planLimits = {
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
exports.stripeWebhook = functions
    .region('us-central1')
    .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    const webhookSecret = functions.config().stripe?.webhook_secret ?? process.env.STRIPE_WEBHOOK_SECRET ?? '';
    const signature = req.headers['stripe-signature'];
    let event;
    try {
        const stripe = getStripe();
        const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    }
    catch (error) {
        functions.logger.error('Stripe webhook signature error:', error);
        res.status(400).send('Invalid signature');
        return;
    }
    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                await handleSubscriptionChange(event.data.object);
                break;
            }
            case 'customer.subscription.deleted': {
                await handleSubscriptionCanceled(event.data.object);
                break;
            }
            case 'invoice.payment_succeeded': {
                await handlePaymentSucceeded(event.data.object);
                break;
            }
            case 'invoice.payment_failed': {
                await handlePaymentFailed(event.data.object);
                break;
            }
            case 'checkout.session.completed': {
                await handleCheckoutCompleted(event.data.object);
                break;
            }
            default:
                functions.logger.log(`Unhandled event: ${event.type}`);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        functions.logger.error('Stripe webhook processing error:', error);
        res.status(500).send('Processing failed');
    }
});
async function findWorkspaceByCustomer(customerId) {
    const snap = await db
        .collection('workspaces')
        .where('plan.stripeCustomerId', '==', customerId)
        .limit(1)
        .get();
    return snap.empty ? null : { id: snap.docs[0].id };
}
function getPlanIdFromPriceId(priceId) {
    const config = functions.config();
    if (priceId === (config.stripe?.price_starter ?? process.env.STRIPE_PRICE_STARTER))
        return 'starter';
    if (priceId === (config.stripe?.price_growth ?? process.env.STRIPE_PRICE_GROWTH))
        return 'growth';
    if (priceId === (config.stripe?.price_enterprise ?? process.env.STRIPE_PRICE_ENTERPRISE))
        return 'enterprise';
    return 'starter';
}
async function handleSubscriptionChange(subscription) {
    const customerId = subscription.customer;
    const workspace = await findWorkspaceByCustomer(customerId);
    if (!workspace)
        return;
    const priceId = subscription.items.data[0]?.price?.id ?? '';
    const planId = getPlanIdFromPriceId(priceId);
    const limits = planLimits[planId] ?? planLimits.starter;
    const statusMap = {
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
async function handleSubscriptionCanceled(subscription) {
    const workspace = await findWorkspaceByCustomer(subscription.customer);
    if (!workspace)
        return;
    await db.collection('workspaces').doc(workspace.id).update({
        'plan.id': 'starter',
        'plan.status': 'canceled',
        limits: planLimits.starter,
        updatedAt: new Date().toISOString(),
    });
}
async function handlePaymentSucceeded(invoice) {
    if (!invoice.customer)
        return;
    functions.logger.info(`Payment succeeded: ${invoice.amount_paid / 100} for customer ${invoice.customer}`);
}
async function handlePaymentFailed(invoice) {
    if (!invoice.customer)
        return;
    const workspace = await findWorkspaceByCustomer(invoice.customer);
    if (!workspace)
        return;
    await db.collection('workspaces').doc(workspace.id).update({
        'plan.status': 'past_due',
        updatedAt: new Date().toISOString(),
    });
}
async function handleCheckoutCompleted(session) {
    const workspaceId = session.metadata?.workspaceId;
    const customerId = session.customer;
    if (!workspaceId || !customerId)
        return;
    await db.collection('workspaces').doc(workspaceId).update({
        'plan.stripeCustomerId': customerId,
        updatedAt: new Date().toISOString(),
    });
}
//# sourceMappingURL=stripeWebhook.js.map