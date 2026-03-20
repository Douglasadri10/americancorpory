'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Instagram, Facebook, MessageCircle, ExternalLink, RefreshCw, Key } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ManualTokenModal } from '@/components/channels/ManualTokenModal';
import { getFirebaseAuth } from '@/lib/firebase/client';
import type { MetaConnectedChannel } from '@/types/meta';
import { toast } from 'sonner';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? '823966477378935';

async function getChannelsViaApi(workspaceId: string): Promise<MetaConnectedChannel[]> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return [];
  const idToken = await user.getIdToken();
  const res = await fetch(`/api/channels?workspaceId=${workspaceId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error('Falha ao carregar canais');
  const data = await res.json() as { channels: MetaConnectedChannel[] };
  return data.channels ?? [];
}

const availableChannels = [
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Conecte sua conta do Instagram Business para atender DMs e stories',
    icon: Instagram,
    color: 'text-instagram',
    bg: 'bg-pink-950/50',
    scope: 'instagram_basic,instagram_manage_messages,pages_read_engagement,pages_manage_metadata',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Conecte sua página do Facebook para atender via Messenger',
    icon: Facebook,
    color: 'text-facebook',
    bg: 'bg-blue-950/50',
    scope: 'pages_messaging,pages_read_engagement,pages_manage_metadata',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Conecte o WhatsApp Business via Cloud API para automação completa',
    icon: MessageCircle,
    color: 'text-whatsapp',
    bg: 'bg-green-950/50',
    scope: 'whatsapp_business_management,whatsapp_business_messaging',
  },
];

export default function ChannelsPage() {
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [channels, setChannels] = useState<MetaConnectedChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Show OAuth result feedback from URL params
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success === 'connected') toast.success('Canal conectado com sucesso!');
    else if (error) toast.error(`Erro ao conectar: ${decodeURIComponent(error)}`);
  }, [searchParams]);

  // Resolve workspaceId: localStorage first, then API fallback
  useEffect(() => {
    const cached = localStorage.getItem('currentWorkspaceId');
    if (cached) {
      setWorkspaceId(cached);
      return;
    }
    // Fetch from API using Admin SDK (bypasses Firestore rules)
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return;
    const workspaceQuery = cached ? `?workspaceId=${encodeURIComponent(cached)}` : '';
    user.getIdToken().then((idToken) =>
      fetch(`/api/workspace/me${workspaceQuery}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json())
        .then((data: { workspace?: { id: string } }) => {
          if (data.workspace?.id) {
            localStorage.setItem('currentWorkspaceId', data.workspace.id);
            setWorkspaceId(data.workspace.id);
          }
        })
        .catch(() => null)
    );
  }, []);

  const loadChannels = useCallback(async (wsId?: string) => {
    const id = wsId ?? workspaceId;
    if (!id) return;
    try {
      const data = await getChannelsViaApi(id);
      setChannels(data);
    } catch {
      toast.error('Erro ao carregar canais');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleOAuthConnect = (channelId: string) => {
    if (!workspaceId) {
      toast.error('Workspace não encontrado');
      return;
    }
    const redirectUri = `${window.location.origin}/api/meta/callback`;
    const ch = availableChannels.find((c) => c.id === channelId);
    if (!ch) return;

    const oauthUrl =
      `https://www.facebook.com/dialog/oauth?client_id=${META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${ch.scope}` +
      `&state=${channelId}_${workspaceId}`;

    window.location.href = oauthUrl;
  };

  const connectedChannelIds = new Set(channels.map((c) => c.channel));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Canais"
        subtitle={`${channels.length} canal${channels.length !== 1 ? 'is' : ''} conectado${channels.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Key size={14} />}
              onClick={() => setShowTokenModal(true)}
            >
              Conectar com token
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => void loadChannels()}>
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Connected channels */}
        {channels.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">
              Canais conectados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onRefresh={() => toast.info('Atualizando token...')}
                  onDisconnect={async (id) => {
                    const auth = getFirebaseAuth();
                    const user = auth.currentUser;
                    if (!user) return;
                    const idToken = await user.getIdToken();
                    await fetch(`/api/channels/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } });
                    toast.success('Canal removido');
                    loadChannels();
                  }}
                  onToggle={(_id, active) => toast.info(`Canal ${active ? 'ativado' : 'desativado'}`)}
                  onWebhookVerified={() => loadChannels()}
                />
              ))}
            </div>
          </div>
        )}

        {/* Available channels */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">
            {channels.length > 0 ? 'Adicionar canal' : 'Canais disponíveis'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableChannels.map((ch) => {
              const Icon = ch.icon;
              const isConnected = connectedChannelIds.has(ch.id as 'instagram' | 'facebook' | 'whatsapp');

              return (
                <Card key={ch.id} hover className="flex flex-col">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ch.bg}`}>
                      <Icon size={20} className={ch.color} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{ch.name}</h3>
                      {isConnected && (
                        <span className="text-xs text-success">Conectado</span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-text-muted mb-4 flex-1">{ch.description}</p>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant={isConnected ? 'secondary' : 'primary'}
                      fullWidth
                      onClick={() => handleOAuthConnect(ch.id)}
                      leftIcon={isConnected ? <Plus size={13} /> : <ExternalLink size={13} />}
                    >
                      {isConnected ? 'Adicionar conta' : `Conectar ${ch.name}`}
                    </Button>
                    {ch.id !== 'whatsapp' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        fullWidth
                        onClick={() => setShowTokenModal(true)}
                        leftIcon={<Key size={13} />}
                      >
                        Usar token manual
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Help section */}
        <Card className="bg-accent-subtle/30 border-accent/20">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <ExternalLink size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                Precisa de ajuda para conectar?
              </h3>
              <p className="text-xs text-text-muted mb-3">
                Para testes, use{' '}
                <strong className="text-text-secondary">Graph API Explorer</strong> no Meta for Developers para gerar um token
                com <code className="text-xs bg-surface px-1 rounded">instagram_manage_messages</code> e conecte via{' '}
                <strong className="text-text-secondary">Conectar com token</strong>.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Ver documentação
                </Button>
                <Button variant="ghost" size="sm">
                  Falar com suporte
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {showTokenModal && (
        <ManualTokenModal
          workspaceId={workspaceId ?? ''}
          onClose={() => setShowTokenModal(false)}
          onSuccess={(resolvedWorkspaceId?: string) => {
            setShowTokenModal(false);
            toast.success('Canal conectado com sucesso!');
            // Use resolved workspace from modal if local state still null
            if (resolvedWorkspaceId && !workspaceId) {
              setWorkspaceId(resolvedWorkspaceId);
              loadChannels(resolvedWorkspaceId);
            } else {
              loadChannels();
            }
          }}
        />
      )}
    </div>
  );
}
