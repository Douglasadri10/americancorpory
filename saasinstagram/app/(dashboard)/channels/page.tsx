'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Instagram, Facebook, MessageCircle, ExternalLink, RefreshCw, Key } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ManualTokenModal } from '@/components/channels/ManualTokenModal';
import { ConnectionSessionModal } from '@/components/channels/ConnectionSessionModal';
import { WhatsAppWizard } from '@/components/channels/WhatsAppWizard';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';
import type { MetaConnectedChannel } from '@/types/meta';
import { toast } from 'sonner';

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

export default function ChannelsPage() {
  const { isEnglish } = useWorkspaceLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [channels, setChannels] = useState<MetaConnectedChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [manualChannel, setManualChannel] = useState<'instagram' | 'whatsapp'>('instagram');
  const [showWhatsAppWizard, setShowWhatsAppWizard] = useState(false);
  const [connectSessionId, setConnectSessionId] = useState<string | null>(null);
  const [oauthConnecting, setOAuthConnecting] = useState(false);

  const availableChannels = [
    {
      id: 'instagram',
      name: 'Instagram',
      description: isEnglish
        ? 'Connect your Instagram Business account to handle DMs and story replies'
        : 'Conecte sua conta do Instagram Business para atender DMs e stories',
      icon: Instagram,
      color: 'text-instagram',
      bg: 'bg-pink-950/50',
      connectionType: 'oauth' as const,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: isEnglish
        ? 'Connect your Facebook Page to handle Messenger conversations'
        : 'Conecte sua Página do Facebook para atender conversas no Messenger',
      icon: Facebook,
      color: 'text-facebook',
      bg: 'bg-blue-950/50',
      connectionType: 'oauth' as const,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: isEnglish
        ? 'Connect a WhatsApp Cloud API number for permission tests and message demos'
        : 'Conecte um número do WhatsApp Cloud API para testes de permissão e demos',
      icon: MessageCircle,
      color: 'text-whatsapp',
      bg: 'bg-green-950/50',
      connectionType: 'manual' as const,
    },
  ];

  useEffect(() => {
    const error = searchParams.get('error');
    const sessionId = searchParams.get('connectSession');

    if (sessionId) {
      setConnectSessionId(sessionId);
    }

    if (error) {
      toast.error(
        isEnglish
          ? `Connection error: ${decodeURIComponent(error)}`
          : `Erro ao conectar: ${decodeURIComponent(error)}`
      );
    }
  }, [isEnglish, searchParams]);

  useEffect(() => {
    const cached = localStorage.getItem('currentWorkspaceId');
    if (cached) {
      setWorkspaceId(cached);
      return;
    }

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
      toast.error(isEnglish ? 'Error loading channels' : 'Erro ao carregar canais');
    } finally {
      setLoading(false);
    }
  }, [isEnglish, workspaceId]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const handleOAuthConnect = async (channelId: 'instagram' | 'facebook') => {
    if (!workspaceId) {
      toast.error(isEnglish ? 'Workspace not found' : 'Workspace não encontrado');
      return;
    }

    setOAuthConnecting(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error(isEnglish ? 'Not authenticated' : 'Não autenticado');

      const idToken = await user.getIdToken();
      const res = await fetch('/api/meta/oauth/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          channel: channelId,
          workspaceId,
        }),
      });
      const data = await res.json() as { authUrl?: string; error?: string };

      if (!res.ok || !data.authUrl) {
        throw new Error(data.error ?? (isEnglish ? 'Failed to start OAuth' : 'Falha ao iniciar OAuth'));
      }

      window.location.href = data.authUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isEnglish ? 'Failed to start OAuth' : 'Falha ao iniciar OAuth'));
    } finally {
      setOAuthConnecting(false);
    }
  };

  const connectedChannelIds = new Set(channels.map((channel) => channel.channel));

  const closeConnectionSession = useCallback(() => {
    setConnectSessionId(null);
    router.replace('/channels');
  }, [router]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={isEnglish ? 'Channels' : 'Canais'}
        subtitle={
          isEnglish
            ? `${channels.length} connected ${channels.length === 1 ? 'channel' : 'channels'}`
            : `${channels.length} canal${channels.length !== 1 ? 'is' : ''} conectado${channels.length !== 1 ? 's' : ''}`
        }
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Key size={14} />}
              onClick={() => {
                setManualChannel('instagram');
                setShowTokenModal(true);
              }}
            >
              {isEnglish ? 'Advanced token' : 'Usar token avançado'}
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => void loadChannels()}>
              {isEnglish ? 'Refresh' : 'Atualizar'}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {loading && channels.length === 0 && (
          <div className="text-sm text-text-muted">
            {isEnglish ? 'Loading channels...' : 'Carregando canais...'}
          </div>
        )}

        {channels.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">
              {isEnglish ? 'Connected channels' : 'Canais conectados'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onRefresh={async (id) => {
                    try {
                      const auth = getFirebaseAuth();
                      const user = auth.currentUser;
                      if (!user) throw new Error(isEnglish ? 'Not authenticated' : 'Não autenticado');

                      const idToken = await user.getIdToken();
                      const res = await fetch(`/api/channels/${id}/refresh-token`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${idToken}` },
                      });
                      const data = await res.json() as { error?: string };

                      if (!res.ok) {
                        throw new Error(data.error ?? (isEnglish ? 'Failed to refresh token' : 'Falha ao atualizar token'));
                      }

                      toast.success(isEnglish ? 'Channel token and status refreshed' : 'Token e status do canal atualizados');
                      await loadChannels();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : (isEnglish ? 'Failed to refresh token' : 'Falha ao atualizar token'));
                      await loadChannels();
                    }
                  }}
                  onDisconnect={async (id) => {
                    const auth = getFirebaseAuth();
                    const user = auth.currentUser;
                    if (!user) return;
                    const idToken = await user.getIdToken();
                    await fetch(`/api/channels/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } });
                    toast.success(isEnglish ? 'Channel removed' : 'Canal removido');
                    void loadChannels();
                  }}
                  onToggle={(_id, active) => {
                    toast.info(
                      isEnglish
                        ? `Channel ${active ? 'activated' : 'deactivated'}`
                        : `Canal ${active ? 'ativado' : 'desativado'}`
                    );
                  }}
                  onWebhookVerified={() => void loadChannels()}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">
            {isEnglish
              ? (channels.length > 0 ? 'Add channels' : 'Channels for approval')
              : (channels.length > 0 ? 'Adicionar canais' : 'Canais para aprovação')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableChannels.map((channel) => {
              const Icon = channel.icon;
              const isConnected = connectedChannelIds.has(channel.id as MetaConnectedChannel['channel']);

              return (
                <Card key={channel.id} hover className="flex flex-col">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${channel.bg}`}>
                      <Icon size={20} className={channel.color} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{channel.name}</h3>
                      {isConnected && (
                        <span className="text-xs text-success">{isEnglish ? 'Connected' : 'Conectado'}</span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-text-muted mb-4 flex-1">{channel.description}</p>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant={isConnected ? 'secondary' : 'primary'}
                      fullWidth
                      onClick={() => {
                        if (channel.connectionType === 'manual') {
                          setShowWhatsAppWizard(true);
                          return;
                        }

                        void handleOAuthConnect(channel.id as 'instagram' | 'facebook');
                      }}
                      disabled={oauthConnecting && channel.connectionType === 'oauth'}
                      leftIcon={isConnected ? <Plus size={13} /> : <ExternalLink size={13} />}
                    >
                      {channel.connectionType === 'manual'
                        ? (isEnglish ? `Configure ${channel.name}` : `Configurar ${channel.name}`)
                        : oauthConnecting
                          ? (isEnglish ? 'Opening Meta...' : 'Abrindo Meta...')
                          : isConnected
                            ? (isEnglish ? 'Add account' : 'Adicionar conta')
                            : isEnglish
                              ? `Connect ${channel.name}`
                              : `Conectar ${channel.name}`}
                    </Button>

                    {channel.id !== 'facebook' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        fullWidth
                        onClick={() => {
                          if (channel.id === 'whatsapp') {
                            setShowWhatsAppWizard(true);
                          } else {
                            setManualChannel('instagram');
                            setShowTokenModal(true);
                          }
                        }}
                        leftIcon={<Key size={13} />}
                      >
                        {isEnglish ? 'Advanced token' : 'Usar token avançado'}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="bg-accent-subtle/30 border-accent/20">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <ExternalLink size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                {isEnglish ? 'Meta approval checklist' : 'Checklist para aprovação Meta'}
              </h3>
              <p className="text-xs text-text-muted mb-3">
                {isEnglish
                  ? 'For the screencast, connect valid Instagram, Facebook, and WhatsApp channels, then demonstrate real message receiving and sending through the Inbox.'
                  : 'Para gravar o screencast, conecte canais válidos de Instagram, Facebook e WhatsApp e demonstre recebimento e envio real de mensagens pelo Inbox.'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://developers.facebook.com/docs/messenger-platform/instagram/app-review/', '_blank', 'noopener,noreferrer')}
                >
                  {isEnglish ? 'Open docs' : 'Ver documentação'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open('https://developers.facebook.com/docs/permissions/', '_blank', 'noopener,noreferrer')}
                >
                  {isEnglish ? 'Review permissions' : 'Revisar permissões'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {showWhatsAppWizard && workspaceId && (
        <WhatsAppWizard
          workspaceId={workspaceId}
          onClose={() => setShowWhatsAppWizard(false)}
          onSuccess={(sessionId) => {
            setShowWhatsAppWizard(false);
            setConnectSessionId(sessionId);
            router.replace(`/channels?connectSession=${encodeURIComponent(sessionId)}`);
          }}
        />
      )}

      {showTokenModal && (
        <ManualTokenModal
          channel={manualChannel}
          workspaceId={workspaceId ?? ''}
          onClose={() => setShowTokenModal(false)}
          onSuccess={(sessionId, resolvedWorkspaceId?: string) => {
            setShowTokenModal(false);
            if (resolvedWorkspaceId && !workspaceId) {
              setWorkspaceId(resolvedWorkspaceId);
            }

            setConnectSessionId(sessionId);
            router.replace(`/channels?connectSession=${encodeURIComponent(sessionId)}`);
          }}
        />
      )}

      {connectSessionId && (
        <ConnectionSessionModal
          sessionId={connectSessionId}
          onClose={closeConnectionSession}
          onConnected={() => {
            closeConnectionSession();
            toast.success(isEnglish ? 'Channel connected successfully.' : 'Canal conectado com sucesso!');
            void loadChannels();
          }}
        />
      )}
    </div>
  );
}
