'use client';

import React, { useEffect } from 'react';
import {
  MessageSquare,
  Users,
  TrendingUp,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Instagram,
  Facebook,
  Activity,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';

const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color: string;
}) => (
  <Card>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-1 ${change >= 0 ? 'text-success' : 'text-danger'}`}>
            {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            <span className="text-xs font-medium">{Math.abs(change)}% vs mês anterior</span>
          </div>
        )}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </Card>
);

export default function OverviewPage() {
  const { user } = useAuth();
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceId') : null;
  const { conversations, stats, loadStats, loading } = useConversations(user ? workspaceId : null);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.displayName?.split(' ')[0] ?? 'Usuário';

  const channelBreakdown = conversations.reduce(
    (acc, conv) => {
      acc[conv.channel] = (acc[conv.channel] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const recentConversations = conversations.slice(0, 5);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Visão Geral" subtitle="Dashboard de atendimento" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {greeting}, {firstName}! 👋
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Aqui está um resumo do seu atendimento hoje
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Conversas abertas"
            value={loading ? '—' : stats?.open ?? 0}
            change={12}
            icon={MessageSquare}
            color="bg-accent"
          />
          <StatCard
            title="Pendentes"
            value={loading ? '—' : stats?.pending ?? 0}
            change={-5}
            icon={Activity}
            color="bg-warning"
          />
          <StatCard
            title="Leads gerados"
            value="—"
            change={8}
            icon={Users}
            color="bg-success"
          />
          <StatCard
            title="Resolvidas hoje"
            value={loading ? '—' : stats?.resolved ?? 0}
            change={18}
            icon={TrendingUp}
            color="bg-info"
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent conversations */}
          <div className="lg:col-span-2">
            <Card padding="none">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <CardTitle>Conversas recentes</CardTitle>
                  <CardDescription>Últimas interações</CardDescription>
                </div>
                <a
                  href="/inbox"
                  className="text-xs text-accent hover:text-accent-light transition-colors flex items-center gap-1"
                >
                  Ver todas <ArrowUpRight size={12} />
                </a>
              </div>

              {loading ? (
                <div className="divide-y divide-border/50">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-muted" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-muted rounded w-32" />
                        <div className="h-2.5 bg-muted rounded w-48" />
                      </div>
                      <div className="h-5 bg-muted rounded w-16" />
                    </div>
                  ))}
                </div>
              ) : recentConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare size={32} className="text-text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-text-muted">Nenhuma conversa ainda</p>
                  <p className="text-xs text-text-muted mt-1">Conecte um canal para começar</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentConversations.map((conv) => {
                    const ChannelIconMap = {
                      instagram: Instagram,
                      facebook: Facebook,
                      whatsapp: MessageCircle,
                    };
                    const ChannelIcon = ChannelIconMap[conv.channel];
                    const channelColorMap = {
                      instagram: 'text-instagram',
                      facebook: 'text-facebook',
                      whatsapp: 'text-whatsapp',
                    };

                    return (
                      <a
                        key={conv.id}
                        href={`/inbox/${conv.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[#1f1f1f] transition-colors"
                      >
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                            <span className="text-xs font-medium text-text-secondary">
                              {conv.contact.name[0]?.toUpperCase()}
                            </span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-card flex items-center justify-center">
                            <ChannelIcon size={8} className={channelColorMap[conv.channel]} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {conv.contact.name}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {conv.lastMessage?.text ?? 'Mídia'}
                          </p>
                        </div>
                        <Badge
                          variant={
                            conv.status === 'open'
                              ? 'success'
                              : conv.status === 'pending'
                              ? 'warning'
                              : 'default'
                          }
                          size="xs"
                        >
                          {conv.status === 'open'
                            ? 'Aberta'
                            : conv.status === 'pending'
                            ? 'Pendente'
                            : 'Resolvida'}
                        </Badge>
                      </a>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Channel breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Canais</CardTitle>
                <CardDescription>Volume por canal</CardDescription>
              </CardHeader>
              <div className="space-y-3">
                {[
                  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-instagram', bar: 'bg-instagram' },
                  { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-facebook', bar: 'bg-facebook' },
                  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-whatsapp', bar: 'bg-whatsapp' },
                ].map(({ key, label, icon: Icon, color, bar }) => {
                  const count = channelBreakdown[key] ?? 0;
                  const total = conversations.length || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon size={13} className={color} />
                          <span className="text-xs text-text-secondary">{label}</span>
                        </div>
                        <span className="text-xs text-text-muted">{count}</span>
                      </div>
                      <div className="h-1.5 bg-[#252525] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${bar} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Quick actions */}
            <Card>
              <CardHeader>
                <CardTitle>Ações rápidas</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {[
                  { label: 'Conectar canal', href: '/channels', icon: Zap, color: 'text-accent' },
                  { label: 'Criar automação', href: '/automations', icon: Zap, color: 'text-accent' },
                  { label: 'Convidar agente', href: '/team', icon: Users, color: 'text-accent' },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <a
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#252525] transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-accent-subtle flex items-center justify-center">
                        <Icon size={13} className={action.color} />
                      </div>
                      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                        {action.label}
                      </span>
                      <ArrowUpRight size={13} className="ml-auto text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
