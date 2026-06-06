'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Check, Zap, CreditCard, ExternalLink, AlertTriangle, Infinity } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PLANS, PLAN_ORDER, formatPrice, formatLimit } from '@/lib/stripe/plans';
import type { PlanId, WorkspaceLimits } from '@/types/workspace';
import { toast } from 'sonner';
import { getFirebaseAuth } from '@/lib/firebase/client';

interface BillingData {
  plan: {
    id: PlanId;
    status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
    stripeCustomerId?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
    trialEndsAt?: string;
  };
  limits: WorkspaceLimits;
  usage: {
    conversationsThisMonth: number;
    aiMessagesThisMonth: number;
    aiInteractionsThisMonth: number;
  };
  trialDaysRemaining: number | null;
}

async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.round((used / limit) * 100);
  const isWarning = !unlimited && pct > 80;
  const isDanger = !unlimited && pct > 95;

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted font-medium">{label}</span>
        <span className={clsx(
          'text-xs font-semibold',
          isDanger ? 'text-danger' : isWarning ? 'text-warning' : 'text-text-secondary'
        )}>
          {used} / {unlimited ? <Infinity size={12} className="inline" /> : limit}
        </span>
      </div>
      {unlimited ? (
        <div className="h-2 bg-accent rounded-full opacity-30" />
      ) : (
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all',
              isDanger ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-accent'
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
      <p className="text-xs text-text-muted mt-1">
        {unlimited ? 'Ilimitado' : `${pct}% utilizado`}
      </p>
      {isWarning && (
        <div className="flex items-center gap-1 mt-2">
          <AlertTriangle size={11} className={isDanger ? 'text-danger' : 'text-warning'} />
          <span className={clsx('text-xs', isDanger ? 'text-danger' : 'text-warning')}>
            {isDanger ? 'Limite quase atingido!' : 'Perto do limite'}
          </span>
        </div>
      )}
    </Card>
  );
}

export default function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch('/api/workspace/billing', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as BillingData;
          setBillingData(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingBilling(false);
      }
    }
    void fetchBilling();
  }, []);

  const currentPlanId: PlanId = billingData?.plan.id ?? 'free';

  const handleSelectPlan = async (planId: PlanId) => {
    if (planId === currentPlanId || planId === 'free') return;

    setLoadingPlan(planId);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ planId, billingCycle }),
      });

      if (!response.ok) {
        const err = await response.json() as { error?: string };
        toast.error(err.error ?? 'Erro ao processar pagamento. Tente novamente.');
        return;
      }

      const { url } = await response.json() as { url: string };
      window.location.href = url;
    } catch {
      toast.error('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const token = await getIdToken();
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!response.ok) {
        const err = await response.json() as { error?: string };
        toast.error(err.error ?? 'Erro ao abrir portal de faturamento');
        return;
      }
      const { url } = await response.json() as { url: string };
      window.location.href = url;
    } catch {
      toast.error('Erro ao abrir portal de faturamento');
    }
  };

  const planName = PLANS[currentPlanId]?.name ?? 'Free';
  const status = billingData?.plan.status ?? 'active';
  const trialDays = billingData?.trialDaysRemaining ?? null;
  const limits = billingData?.limits;
  const usage = billingData?.usage;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Faturamento" subtitle="Gerencie sua assinatura" />

      <div className="flex-1 overflow-y-auto dashboard-page-padding dashboard-page-spacing">
        {/* Current plan status */}
        <Card className="bg-gradient-to-r from-accent/10 to-transparent border-accent/20">
          <div className="flex items-start justify-between gap-4">
            {loadingBilling ? (
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-muted rounded w-40 animate-pulse" />
                <div className="h-4 bg-muted rounded w-72 animate-pulse" />
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-text-primary">Plano {planName}</h2>
                  {status === 'trialing' && (
                    <Badge variant="warning" size="sm">Período de transição</Badge>
                  )}
                  {(status === 'active' || currentPlanId === 'free') && (
                    <Badge variant="success" size="sm">Ativo</Badge>
                  )}
                  {status === 'past_due' && (
                    <Badge variant="danger" size="sm">Pagamento pendente</Badge>
                  )}
                  {status === 'canceled' && (
                    <Badge variant="default" size="sm">Cancelado</Badge>
                  )}
                </div>
                {currentPlanId === 'free' && (
                  <p className="text-sm text-text-muted">
                    Você está no plano gratuito. Faça upgrade para aumentar seus limites de IA.
                  </p>
                )}
                {status === 'trialing' && (
                  <p className="text-sm text-text-muted">
                    Sua conta está em período de transição. Em breve será atualizada automaticamente.
                  </p>
                )}
                {status === 'active' && currentPlanId !== 'free' && billingData?.plan.currentPeriodEnd && (
                  <p className="text-sm text-text-muted">
                    Próxima cobrança em{' '}
                    <span className="font-medium text-text-secondary">
                      {new Date(billingData.plan.currentPeriodEnd).toLocaleDateString('pt-BR')}
                    </span>
                    {billingData.plan.cancelAtPeriodEnd && (
                      <span className="text-warning ml-1">(cancelamento agendado)</span>
                    )}
                  </p>
                )}
                {status === 'past_due' && (
                  <p className="text-sm text-danger">
                    Pagamento falhou. Atualize seu método de pagamento para evitar interrupção.
                  </p>
                )}
              </div>
            )}
            {billingData?.plan?.stripeCustomerId && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ExternalLink size={13} />}
                onClick={handleManageBilling}
              >
                Gerenciar assinatura
              </Button>
            )}
          </div>
        </Card>

        {/* Usage */}
        <div>
          <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">Uso este mês</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loadingBilling ? (
              [1, 2, 3].map((i) => (
                <Card key={i}>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-20 animate-pulse" />
                    <div className="h-2 bg-muted rounded animate-pulse" />
                  </div>
                </Card>
              ))
            ) : (
              <>
                <UsageBar
                  label="Mensagens IA"
                  used={usage?.aiMessagesThisMonth ?? 0}
                  limit={limits?.aiMessagesPerMonth ?? 100}
                />
                <UsageBar
                  label="Interações IA"
                  used={usage?.aiInteractionsThisMonth ?? 0}
                  limit={limits?.aiInteractionsPerMonth ?? 15}
                />
                <UsageBar
                  label="Automações"
                  used={0}
                  limit={limits?.maxAutomations ?? 5}
                />
              </>
            )}
          </div>
        </div>

        {/* Plans */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Planos</h3>

            <div className="flex items-center gap-2">
              <span className={clsx('text-xs', billingCycle === 'monthly' ? 'text-text-primary' : 'text-text-muted')}>
                Mensal
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className={clsx(
                  'w-10 h-5 rounded-full transition-colors relative',
                  billingCycle === 'annual' ? 'bg-accent' : 'bg-muted'
                )}
              >
                <span className={clsx(
                  'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </button>
              <span className={clsx('text-xs', billingCycle === 'annual' ? 'text-text-primary' : 'text-text-muted')}>
                Anual
                <span className="ml-1 text-success font-medium">-20%</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId];
              const isCurrent = planId === currentPlanId;
              const isFree = planId === 'free';
              const price = billingCycle === 'annual' ? plan.price.annual : plan.price.monthly;
              const lim = plan.limits;

              return (
                <div
                  key={planId}
                  className={clsx(
                    'bg-card border rounded-xl p-5 flex flex-col relative transition-all',
                    plan.highlighted
                      ? 'border-accent shadow-[0_0_0_1px_rgba(124,58,237,0.3)]'
                      : isCurrent
                      ? 'border-success/40'
                      : 'border-border'
                  )}
                >
                  {plan.highlighted && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-success text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Plano atual
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-base font-bold text-text-primary">{plan.name}</h3>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-text-primary">
                        {isFree ? 'Grátis' : formatPrice(price)}
                      </span>
                      {!isFree && <span className="text-xs text-text-muted mb-1">/mês</span>}
                    </div>
                    {!isFree && billingCycle === 'annual' && (
                      <p className="text-xs text-success mt-0.5">
                        Economia de {formatPrice((plan.price.monthly - plan.price.annual) * 12)}/ano
                      </p>
                    )}
                  </div>

                  {/* Limits summary */}
                  <div className="mb-5 space-y-1.5 text-xs text-text-muted">
                    <div className="flex items-center justify-between">
                      <span>Mensagens IA</span>
                      <span className="font-semibold text-text-secondary">{formatLimit(lim.aiMessagesPerMonth)}/mês</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Interações IA</span>
                      <span className="font-semibold text-text-secondary">{formatLimit(lim.aiInteractionsPerMonth)}/mês</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Automações</span>
                      <span className="font-semibold text-text-secondary">{formatLimit(lim.maxAutomations)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Canais</span>
                      <span className="font-semibold text-text-secondary">{lim.maxChannels}</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 mb-6 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check size={12} className="text-success shrink-0 mt-0.5" />
                        <span className="text-xs text-text-secondary">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={plan.highlighted && !isCurrent ? 'primary' : isCurrent ? 'secondary' : 'outline'}
                    fullWidth
                    disabled={isCurrent || loadingBilling || isFree}
                    loading={loadingPlan === planId}
                    onClick={() => handleSelectPlan(planId)}
                    leftIcon={isCurrent || isFree ? undefined : <CreditCard size={13} />}
                  >
                    {isCurrent ? 'Plano atual' : isFree ? 'Gratuito' : `Assinar ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-text-muted mt-4">
            Todos os planos incluem SSL, backups automáticos e SLA de 99.9%.
            Cancele a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}
