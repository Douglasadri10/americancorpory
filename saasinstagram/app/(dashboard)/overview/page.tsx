'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Users,
  TrendingUp,
  Zap,
  ArrowUpRight,
  Instagram,
  Facebook,
  Activity,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { getContactDisplayName, getContactInitial } from '@/lib/conversations/display';
import type { Conversation } from '@/types/conversation';

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}) => (
  <Card>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </Card>
);

function isSameDay(value?: string) {
  if (!value) return false;
  const now = new Date();
  const date = new Date(value);
  return (
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  const { isEnglish } = useWorkspaceLocale();
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceId') : null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [connectedChannels, setConnectedChannels] = useState(0);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !workspaceId) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) { setLoading(false); return; }

    setLoading(true);
    firebaseUser.getIdToken().then(async (idToken) => {
      const headers = { Authorization: `Bearer ${idToken}` };
      const params = new URLSearchParams({ workspaceId, limit: '50', includeStats: '1' });

      const [convRes, leadsRes, channelsRes] = await Promise.allSettled([
        fetch(`/api/conversations?${params}`, { headers, credentials: 'include', cache: 'no-store' }),
        fetch(`/api/leads?workspaceId=${workspaceId}`, { headers, credentials: 'include', cache: 'no-store' }),
        fetch(`/api/channels?workspaceId=${workspaceId}`, { headers, credentials: 'include', cache: 'no-store' }),
      ]);

      if (convRes.status === 'fulfilled' && convRes.value.ok) {
        const data = await convRes.value.json() as { conversations?: Conversation[] };
        const convList = data.conversations ?? [];
        setConversations(convList);

        // Background-enrich contacts that only have a placeholder name (#xxxxxx or "Contato")
        const toEnrich = convList.filter((c) => {
          if (c.channel !== 'instagram') return false;
          const n = c.contact?.name?.trim();
          return !n || n === 'Contato' || /^#[0-9a-f]+$/i.test(n) || /^\d+$/.test(n);
        });
        if (toEnrich.length > 0) {
          Promise.allSettled(
            toEnrich.map((c) =>
              fetch('/api/conversations/enrich-contact', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, conversationId: c.id }),
              })
                .then((r) => r.ok ? r.json() as Promise<{ enriched: boolean; contact?: Conversation['contact'] }> : null)
                .then((result) => {
                  if (result?.enriched && result.contact) {
                    setConversations((prev) =>
                      prev.map((conv) =>
                        conv.id === c.id ? { ...conv, contact: result.contact! } : conv
                      )
                    );
                  }
                })
                .catch(() => null)
            )
          );
        }
      }
      if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
        const data = await leadsRes.value.json() as { stats?: { total: number } };
        setLeadsTotal(data.stats?.total ?? 0);
      }
      if (channelsRes.status === 'fulfilled' && channelsRes.value.ok) {
        const data = await channelsRes.value.json() as { channels?: Array<{ connected?: boolean; isActive?: boolean }> };
        setConnectedChannels(
          (data.channels ?? []).filter((c) => c.connected !== false && c.isActive !== false).length
        );
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user, workspaceId]);

  const channelBreakdown = useMemo(
    () =>
      conversations.reduce<Record<string, number>>(
        (acc, conv) => {
          acc[conv.channel] = (acc[conv.channel] ?? 0) + 1;
          return acc;
        },
        { instagram: 0, facebook: 0, whatsapp: 0 }
      ),
    [conversations]
  );

  const stats = useMemo(
    () => ({
      totalConversations: conversations.length,
      open: conversations.filter((c) => c.status === 'open').length,
      pending: conversations.filter((c) => c.status === 'pending').length,
      resolvedToday: conversations.filter((c) => c.status === 'resolved' && isSameDay(c.resolvedAt)).length,
      leadsTotal,
      connectedChannels,
    }),
    [conversations, leadsTotal, connectedChannels]
  );

  const recentConversations = useMemo(
    () =>
      [...conversations]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5),
    [conversations]
  );

  const hour = new Date().getHours();
  const greeting = isEnglish
    ? hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
    : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.displayName?.split(' ')[0] ?? (isEnglish ? 'User' : 'Usuário');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={isEnglish ? 'Overview' : 'Visão Geral'}
        subtitle={isEnglish ? 'Support dashboard' : 'Dashboard de atendimento'}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {greeting}, {firstName}! 👋
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {isEnglish
              ? 'Here is a live summary of your workspace support activity'
              : 'Aqui está um resumo real do atendimento do workspace'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={isEnglish ? 'Open conversations' : 'Conversas abertas'}
            value={loading ? '—' : stats.open}
            icon={MessageSquare}
            color="bg-accent"
          />
          <StatCard
            title={isEnglish ? 'Pending' : 'Pendentes'}
            value={loading ? '—' : stats.pending}
            icon={Activity}
            color="bg-warning"
          />
          <StatCard
            title={isEnglish ? 'Total leads' : 'Leads totais'}
            value={loading ? '—' : stats.leadsTotal}
            icon={Users}
            color="bg-success"
          />
          <StatCard
            title={isEnglish ? 'Resolved today' : 'Resolvidas hoje'}
            value={loading ? '—' : stats.resolvedToday}
            icon={TrendingUp}
            color="bg-info"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card padding="none">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <CardTitle>{isEnglish ? 'Recent conversations' : 'Conversas recentes'}</CardTitle>
                  <CardDescription>
                    {isEnglish ? 'Latest real interactions from this workspace' : 'Últimas interações reais do workspace'}
                  </CardDescription>
                </div>
                <a
                  href="/inbox"
                  className="text-xs text-accent hover:text-accent-light transition-colors flex items-center gap-1"
                >
                  {isEnglish ? 'View all' : 'Ver todas'} <ArrowUpRight size={12} />
                </a>
              </div>

              {loading ? (
                <div className="divide-y divide-border/50">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3 px-4 py-3 animate-pulse">
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
                  <p className="text-sm text-text-muted">{isEnglish ? 'No conversations yet' : 'Nenhuma conversa ainda'}</p>
                  <p className="text-xs text-text-muted mt-1">{isEnglish ? 'Connect a channel to get started' : 'Conecte um canal para começar'}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentConversations.map((conversation) => {
                    const ChannelIconMap = {
                      instagram: Instagram,
                      facebook: Facebook,
                      whatsapp: MessageCircle,
                    };
                    const ChannelIcon = ChannelIconMap[conversation.channel];
                    const channelColorMap = {
                      instagram: 'text-instagram',
                      facebook: 'text-facebook',
                      whatsapp: 'text-whatsapp',
                    };
                    const displayName = getContactDisplayName(conversation.contact);

                    return (
                      <a
                        key={conversation.id}
                        href={`/inbox/${conversation.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
                      >
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center">
                            <span className="text-xs font-medium text-text-secondary">
                              {getContactInitial(conversation.contact)}
                            </span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white border border-border flex items-center justify-center">
                            <ChannelIcon size={8} className={channelColorMap[conversation.channel]} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {displayName}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {conversation.lastMessage?.text ?? (isEnglish ? 'Media' : 'Mídia')}
                          </p>
                        </div>
                        <Badge
                          variant={
                            conversation.status === 'open'
                              ? 'success'
                              : conversation.status === 'pending'
                              ? 'warning'
                              : 'default'
                          }
                          size="xs"
                        >
                          {conversation.status === 'open'
                            ? (isEnglish ? 'Open' : 'Aberta')
                            : conversation.status === 'pending'
                            ? (isEnglish ? 'Pending' : 'Pendente')
                            : (isEnglish ? 'Resolved' : 'Resolvida')}
                        </Badge>
                      </a>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{isEnglish ? 'Channels' : 'Canais'}</CardTitle>
                <CardDescription>{isEnglish ? 'Real volume by channel' : 'Volume real por canal'}</CardDescription>
              </CardHeader>
              <div className="space-y-3">
                {[
                  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-instagram', bar: 'bg-instagram' },
                  { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-facebook', bar: 'bg-facebook' },
                  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-whatsapp', bar: 'bg-whatsapp' },
                ].map(({ key, label, icon: Icon, color, bar }) => {
                  const count = channelBreakdown[key] ?? 0;
                  const total = stats.totalConversations || 1;
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
                      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
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

            <Card>
              <CardHeader>
                <CardTitle>{isEnglish ? 'Quick actions' : 'Ações rápidas'}</CardTitle>
                <CardDescription>
                  {loading
                    ? (isEnglish ? 'Loading workspace state' : 'Carregando estado do workspace')
                    : isEnglish
                      ? `${stats.connectedChannels} connected channels`
                      : `${stats.connectedChannels} canais conectados`}
                </CardDescription>
              </CardHeader>
              <div className="space-y-2">
                {[
                  {
                    label: isEnglish ? 'Connect channel' : 'Conectar canal',
                    href: '/channels',
                    icon: Zap,
                    color: 'text-accent',
                  },
                  {
                    label: isEnglish ? 'Create automation' : 'Criar automação',
                    href: '/automations',
                    icon: Zap,
                    color: 'text-accent',
                  },
                  {
                    label: isEnglish ? 'Invite agent' : 'Convidar agente',
                    href: '/team',
                    icon: Users,
                    color: 'text-accent',
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <a
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors group"
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
