import type { PlanId, WorkspaceLimits } from '@/types/workspace';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  price: {
    monthly: number;
    annual: number;
    currency: string;
  };
  stripePriceId: {
    monthly: string;
    annual: string;
  };
  limits: WorkspaceLimits;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

// Shared feature list — ALL plans have identical capabilities
// Only the usage limits above differ between plans.
const SHARED_FEATURES_PT = [
  'Inbox omnichannel unificado',
  'CRM de leads completo',
  'Automações de mensagens',
  'IA respondendo por você',
  'Agenda e agendamentos',
  'Canais: Instagram, Facebook e WhatsApp',
  'Análises e relatórios',
  'Suporte por email',
];

const SHARED_FEATURES_EN = [
  'Unified omnichannel inbox',
  'Full lead CRM',
  'Message automations',
  'AI replying on your behalf',
  'Calendar and scheduling',
  'Channels: Instagram, Facebook & WhatsApp',
  'Analytics and reporting',
  'Email support',
];

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Sinta a IA respondendo seu Instagram antes de pagar',
    price: {
      monthly: 0,
      annual: 0,
      currency: 'USD',
    },
    stripePriceId: {
      monthly: '',
      annual: '',
    },
    limits: {
      maxChannels: 2,
      maxAutomations: 5,
      aiMessagesPerMonth: 100,
      aiInteractionsPerMonth: 15,
    },
    features: SHARED_FEATURES_PT,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Para quem quer automatizar o atendimento com mais volume',
    price: {
      monthly: 20,
      annual: 16,
      currency: 'USD',
    },
    stripePriceId: {
      monthly: (process.env.STRIPE_PRICE_STARTER_MONTHLY ?? 'price_starter_monthly').trim(),
      annual: (process.env.STRIPE_PRICE_STARTER_ANNUAL ?? 'price_starter_annual').trim(),
    },
    limits: {
      maxChannels: 3,
      maxAutomations: 20,
      aiMessagesPerMonth: 300,
      aiInteractionsPerMonth: 30,
    },
    features: SHARED_FEATURES_PT,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Para operações em crescimento que precisam de mais IA',
    price: {
      monthly: 70,
      annual: 56,
      currency: 'USD',
    },
    stripePriceId: {
      monthly: (process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_monthly').trim(),
      annual: (process.env.STRIPE_PRICE_PRO_ANNUAL ?? 'price_pro_annual').trim(),
    },
    limits: {
      maxChannels: 3,
      maxAutomations: 20,
      aiMessagesPerMonth: 1200,
      aiInteractionsPerMonth: 120,
    },
    features: SHARED_FEATURES_PT,
    highlighted: true,
    badge: 'Mais popular',
  },
  business: {
    id: 'business',
    name: 'Business',
    description: 'Escala completa — IA sem limites de interação',
    price: {
      monthly: 99,
      annual: 79,
      currency: 'USD',
    },
    stripePriceId: {
      monthly: (process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? 'price_business_monthly').trim(),
      annual: (process.env.STRIPE_PRICE_BUSINESS_ANNUAL ?? 'price_business_annual').trim(),
    },
    limits: {
      maxChannels: 3,
      maxAutomations: -1,         // unlimited
      aiMessagesPerMonth: 3000,
      aiInteractionsPerMonth: -1, // unlimited
    },
    features: SHARED_FEATURES_PT,
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'starter', 'pro', 'business'];

// Shared features for the landing page (PT-BR and EN-US)
export { SHARED_FEATURES_PT, SHARED_FEATURES_EN };

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId] ?? PLANS.free;
}

export function getPlanLimits(planId: PlanId): WorkspaceLimits {
  return (PLANS[planId] ?? PLANS.free).limits;
}

export function isWithinLimits(
  planId: PlanId,
  usage: Partial<WorkspaceLimits>
): Record<keyof WorkspaceLimits, boolean> {
  const limits = getPlanLimits(planId);
  return {
    maxChannels: (usage.maxChannels ?? 0) < limits.maxChannels,
    maxAutomations: limits.maxAutomations === -1 || (usage.maxAutomations ?? 0) < limits.maxAutomations,
    aiMessagesPerMonth: (usage.aiMessagesPerMonth ?? 0) < limits.aiMessagesPerMonth,
    aiInteractionsPerMonth: limits.aiInteractionsPerMonth === -1 || (usage.aiInteractionsPerMonth ?? 0) < limits.aiInteractionsPerMonth,
  };
}

export function formatPrice(amount: number, currency = 'USD'): string {
  if (amount === 0) return 'Grátis';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatLimit(value: number): string {
  return value === -1 ? '∞' : value.toLocaleString('pt-BR');
}
