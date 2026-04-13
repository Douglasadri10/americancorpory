'use client';

import React from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import {
  Instagram,
  Facebook,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  RefreshCw,
  Trash2,
  Link,
  Power,
  Webhook,
} from 'lucide-react';
import { isChannelDemoReady } from '@/lib/meta/connection';
import type { MetaConnectedChannel } from '@/types/meta';
import { Badge } from '@/components/ui/Badge';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';
import { toast } from 'sonner';

interface ChannelCardProps {
  channel: MetaConnectedChannel;
  onRefresh?: (channelId: string) => void;
  onDisconnect?: (channelId: string) => void;
  onToggle?: (channelId: string, isActive: boolean) => void;
  onWebhookVerified?: (channelId: string) => void;
}

const channelConfig = {
  instagram: {
    icon: Instagram,
    color: 'text-instagram',
    bg: 'bg-pink-950/50',
    border: 'border-instagram/20',
    label: 'Instagram',
    descriptionPt: 'Mensagens diretas e stories',
    descriptionEn: 'Direct messages and stories',
  },
  facebook: {
    icon: Facebook,
    color: 'text-facebook',
    bg: 'bg-blue-950/50',
    border: 'border-facebook/20',
    label: 'Facebook',
    descriptionPt: 'Messenger e comentários',
    descriptionEn: 'Messenger and comments',
  },
  whatsapp: {
    icon: MessageCircle,
    color: 'text-whatsapp',
    bg: 'bg-green-950/50',
    border: 'border-whatsapp/20',
    label: 'WhatsApp',
    descriptionPt: 'WhatsApp Business Cloud API',
    descriptionEn: 'WhatsApp Business Cloud API',
  },
};

function getStatusRowTone(ok: boolean) {
  return ok
    ? {
        icon: <CheckCircle size={13} className="text-success" />,
        valueClassName: 'text-success',
      }
    : {
        icon: <AlertCircle size={13} className="text-warning" />,
        valueClassName: 'text-warning',
      };
}

function getTokenLabel(
  channel: MetaConnectedChannel,
  isEnglish: boolean,
  dateFormat: string,
  dateFnsLocale: ReturnType<typeof useWorkspaceLocale>['dateFnsLocale']
) {
  switch (channel.tokenStatus) {
    case 'missing_scopes':
      return isEnglish ? 'Missing permissions' : 'Permissões faltando';
    case 'invalid':
      return isEnglish ? 'Reconnect' : 'Reautorizar';
    case 'limited':
      return isEnglish ? 'Limited manual token' : 'Manual limitado';
    case 'expiring_soon':
      return channel.tokenExpiresAt
        ? `${isEnglish ? 'Expires' : 'Expira'} ${format(new Date(channel.tokenExpiresAt), dateFormat, { locale: dateFnsLocale })}`
        : isEnglish ? 'Expiring soon' : 'Expira em breve';
    case 'active':
      return channel.tokenExpiresAt
        ? `${isEnglish ? 'Valid until' : 'Válido até'} ${format(new Date(channel.tokenExpiresAt), dateFormat, { locale: dateFnsLocale })}`
        : isEnglish ? 'Valid' : 'Válido';
    default:
      return channel.tokenExpiresAt
        ? `${isEnglish ? 'Expires' : 'Expira'} ${format(new Date(channel.tokenExpiresAt), dateFormat, { locale: dateFnsLocale })}`
        : isEnglish ? 'Pending status' : 'Status pendente';
  }
}

function getWebhookLabel(channel: MetaConnectedChannel, isEnglish: boolean) {
  switch (channel.webhookStatus) {
    case 'subscribed':
      return isEnglish ? 'Subscribed' : 'Inscrito';
    case 'failed':
      return isEnglish ? 'Failed' : 'Falhou';
    default:
      return isEnglish ? 'Pending' : 'Pendente';
  }
}

export function ChannelCard({ channel, onRefresh, onDisconnect, onToggle, onWebhookVerified }: ChannelCardProps) {
  const { isEnglish, dateFnsLocale } = useWorkspaceLocale();
  const [showMenu, setShowMenu] = React.useState(false);
  const [subscribing, setSubscribing] = React.useState(false);
  const [refreshingIg, setRefreshingIg] = React.useState(false);
  const config = channelConfig[channel.channel];
  const Icon = config.icon;
  const dateFormat = isEnglish ? 'MM/dd/yy' : 'dd/MM/yy';
  const demoReady = isChannelDemoReady(channel);
  const tokenOk =
    channel.tokenStatus === 'active' ||
    channel.tokenStatus === 'expiring_soon' ||
    channel.tokenStatus === 'limited';
  const webhookOk = channel.webhookStatus === 'subscribed';
  const igOk = channel.igConnectionStatus === 'connected' || channel.igConnectionStatus === 'not_required';
  const tokenTone = getStatusRowTone(tokenOk && !channel.reauthorizationRequired);
  const webhookTone = getStatusRowTone(webhookOk);
  const igTone = getStatusRowTone(igOk);
  const demoTone = getStatusRowTone(demoReady);
  const phoneTone = getStatusRowTone(Boolean(channel.phoneNumberId));

  const handleRefreshIgAccount = async () => {
    setRefreshingIg(true);
    setShowMenu(false);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error(isEnglish ? 'Not authenticated' : 'Não autenticado');
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json() as { success?: boolean; error?: string; instagramAccountId?: string };
      if (!res.ok) {
        toast.error(data.error ?? (isEnglish ? 'Error reconnecting Instagram account' : 'Erro ao reconectar conta Instagram'));
      } else {
        toast.success(
          isEnglish
            ? `Instagram account linked: ${data.instagramAccountId}`
            : `Conta Instagram vinculada: ${data.instagramAccountId}`
        );
        onWebhookVerified?.(channel.id);
      }
    } catch {
      toast.error(isEnglish ? 'Error reconnecting Instagram account' : 'Erro ao reconectar conta Instagram');
    } finally {
      setRefreshingIg(false);
    }
  };

  const handleSubscribeWebhook = async () => {
    setSubscribing(true);
    setShowMenu(false);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error(isEnglish ? 'Not authenticated' : 'Não autenticado');
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/channels/${channel.id}/subscribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json() as { success?: boolean; error?: string; hint?: string };
      if (!res.ok) {
        toast.error(data.hint ?? data.error ?? (isEnglish ? 'Error verifying webhook' : 'Erro ao verificar webhook'));
      } else {
        toast.success(isEnglish ? 'Webhook verified successfully.' : 'Webhook verificado com sucesso!');
        onWebhookVerified?.(channel.id);
      }
    } catch {
      toast.error(isEnglish ? 'Error verifying webhook' : 'Erro ao verificar webhook');
    } finally {
      setSubscribing(false);
    }
  };

  // Use stable Graph API redirect URL — always resolves to current profile picture.
  // For Instagram channels prefer the IG account ID over the page ID.
  // pageAvatarURL stored in Firestore may be an expired temporary CDN URL, so we
  // construct the URL here instead of trusting the stored value.
  const graphId =
    channel.channel === 'instagram'
      ? (channel.instagramAccountId ?? channel.instagramAccountIdApi ?? channel.pageId)
      : channel.channel === 'facebook'
        ? channel.pageId
        : null;
  const avatarSrc = graphId
    ? `https://graph.facebook.com/${graphId}/picture?type=square`
    : null;

  return (
    <div
      className={clsx(
        'bg-card border rounded-xl p-4 transition-all',
        channel.isActive ? `border-border hover:${config.border}` : 'border-border opacity-60'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar: real profile photo with platform badge */}
          <div className="relative shrink-0">
            <div className={clsx('w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center', config.bg)}>
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={channel.pageName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to platform icon on broken image
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) parent.dataset.fallback = '1';
                  }}
                />
              ) : (
                <Icon size={22} className={config.color} />
              )}
            </div>
            {/* Platform badge in bottom-right corner */}
            {avatarSrc && (
              <div className={clsx('absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card flex items-center justify-center', config.bg)}>
                <Icon size={10} className={config.color} />
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
          >
            <MoreVertical size={14} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-modal w-48 z-10 py-1">
              {channel.channel === 'instagram' && channel.igConnectionStatus !== 'connected' && (
                <button
                  onClick={handleRefreshIgAccount}
                  disabled={refreshingIg}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                >
                  <Instagram size={12} />
                  {refreshingIg
                    ? (isEnglish ? 'Loading...' : 'Buscando...')
                    : (isEnglish ? 'Reconnect Instagram account' : 'Reconectar conta IG')}
                </button>
              )}
              {!channel.webhookVerified && (
                <button
                  onClick={handleSubscribeWebhook}
                  disabled={subscribing}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                >
                  <Webhook size={12} />
                  {subscribing
                    ? (isEnglish ? 'Checking...' : 'Verificando...')
                    : (isEnglish ? 'Verify webhook' : 'Verificar webhook')}
                </button>
              )}
              <button
                onClick={() => {
                  onRefresh?.(channel.id);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
              >
                <RefreshCw size={12} />
                {isEnglish ? 'Refresh token' : 'Atualizar token'}
              </button>
              <button
                onClick={() => {
                  onToggle?.(channel.id, !channel.isActive);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
              >
                <Power size={12} />
                {channel.isActive
                  ? (isEnglish ? 'Deactivate' : 'Desativar')
                  : (isEnglish ? 'Activate' : 'Ativar')}
              </button>
              <hr className="border-border my-1" />
              <button
                onClick={() => {
                  onDisconnect?.(channel.id);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-danger hover:bg-red-950 transition-colors"
              >
                <Trash2 size={12} />
                {isEnglish ? 'Disconnect' : 'Desconectar'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{channel.pageName}</h3>
          <Badge variant={channel.isActive ? 'success' : 'default'} size="xs" dot>
            {channel.isActive ? (isEnglish ? 'Active' : 'Ativo') : (isEnglish ? 'Inactive' : 'Inativo')}
          </Badge>
          {channel.reauthorizationRequired && (
            <Badge variant="warning" size="xs">
              {isEnglish ? 'Reconnect' : 'Reautorizar'}
            </Badge>
          )}
        </div>
        <p className={clsx('text-xs mt-0.5', config.color)}>
          {config.label} · {isEnglish ? config.descriptionEn : config.descriptionPt}
        </p>
        {channel.instagramUsername && (
          <p className="text-xs text-text-muted mt-0.5">@{channel.instagramUsername}</p>
        )}
        {channel.phoneNumber && (
          <p className="text-xs text-text-muted mt-0.5">{channel.phoneNumber}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tokenTone.icon}
            <span className="text-xs text-text-muted">Token</span>
          </div>
          <span className={clsx('text-xs', tokenTone.valueClassName)}>
            {getTokenLabel(channel, isEnglish, dateFormat, dateFnsLocale)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {channel.channel === 'whatsapp' ? phoneTone.icon : igTone.icon}
            <span className="text-xs text-text-muted">
              {channel.channel === 'instagram'
                ? (isEnglish ? 'Instagram account' : 'Conta IG')
                : channel.channel === 'facebook'
                  ? (isEnglish ? 'Page' : 'Página')
                  : (isEnglish ? 'Phone number' : 'Número')}
            </span>
          </div>
          <span className={clsx('text-xs', channel.channel === 'whatsapp' ? phoneTone.valueClassName : igTone.valueClassName)}>
            {channel.channel === 'instagram'
              ? igOk
                ? (isEnglish ? 'Linked' : 'Vinculada')
                : (isEnglish ? 'Not linked' : 'Não vinculada')
              : channel.channel === 'facebook'
                ? (isEnglish ? 'Connected' : 'Conectada')
                : channel.phoneNumber ?? (isEnglish ? 'Not configured' : 'Não configurado')}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {webhookTone.icon}
            <span className="text-xs text-text-muted">Webhook</span>
          </div>
          <span className={clsx('text-xs', webhookTone.valueClassName)}>
            {getWebhookLabel(channel, isEnglish)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {demoTone.icon}
            <span className="text-xs text-text-muted">{isEnglish ? 'Ready for demo' : 'Pronto para demo'}</span>
          </div>
          <span className={clsx('text-xs', demoTone.valueClassName)}>
            {demoReady ? (isEnglish ? 'Ready' : 'Pronto') : (isEnglish ? 'Blocked' : 'Bloqueado')}
          </span>
        </div>

        {channel.webhookSubscribedAt && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">{isEnglish ? 'Last subscription' : 'Última assinatura'}</span>
            </div>
            <span className="text-xs text-text-muted">
              {format(new Date(channel.webhookSubscribedAt), dateFormat, { locale: dateFnsLocale })}
            </span>
          </div>
        )}
      </div>

      {(channel.lastRefreshError || channel.errorMessage) && (
        <div className="mt-3 flex items-start gap-2 bg-red-950/50 border border-danger/20 rounded-lg px-3 py-2">
          <AlertCircle size={12} className="text-danger shrink-0 mt-0.5" />
          <p className="text-xs text-danger">{channel.lastRefreshError ?? channel.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

export default ChannelCard;
