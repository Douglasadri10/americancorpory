'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Facebook, Instagram, Loader2, MessageCircle, ShieldAlert, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';
import type { MetaChannelConnectSession, MetaConnectionCandidate } from '@/types/meta';

interface Props {
  onClose: () => void;
  onConnected: () => void;
  sessionId: string;
}

function getCandidateTone(candidate: MetaConnectionCandidate, isEnglish: boolean) {
  if (candidate.isEligible) {
    return {
      badge: 'success' as const,
      border: 'border-emerald-500/30',
      icon: <CheckCircle2 size={15} className="text-success" />,
      label: candidate.limitedUse
        ? (isEnglish ? 'Ready with limits' : 'Pronto com limite')
        : (isEnglish ? 'Ready' : 'Pronto'),
    };
  }

  return {
    badge: 'warning' as const,
    border: 'border-amber-500/30',
    icon: <ShieldAlert size={15} className="text-warning" />,
    label: isEnglish ? 'Needs adjustment' : 'Ajuste necessário',
  };
}

function getCandidateDetails(candidate: MetaConnectionCandidate, isEnglish: boolean) {
  const tokenValue =
    candidate.tokenStatus === 'missing_scopes'
      ? (isEnglish ? 'Missing permissions' : 'Permissões faltando')
      : candidate.tokenStatus === 'limited'
        ? (isEnglish ? 'Manual limited' : 'Manual limitado')
        : candidate.tokenStatus === 'expiring_soon'
          ? (isEnglish ? 'Expiring soon' : 'Expira em breve')
          : candidate.tokenStatus === 'active'
            ? (isEnglish ? 'Valid' : 'Válido')
            : (isEnglish ? 'Invalid' : 'Inválido');

  if (candidate.channel === 'whatsapp') {
    return [
      {
        label: 'Token',
        value: tokenValue,
        tone:
          candidate.tokenStatus === 'active' || candidate.tokenStatus === 'limited' || candidate.tokenStatus === 'expiring_soon'
            ? 'text-success'
            : 'text-warning',
      },
      {
        label: isEnglish ? 'Phone number' : 'Número',
        value: candidate.phoneNumber ?? (isEnglish ? 'Not found' : 'Não encontrado'),
        tone: candidate.phoneNumber ? 'text-success' : 'text-warning',
      },
      {
        label: 'Webhook',
        value: isEnglish ? 'App-level' : 'Nível do app',
        tone: 'text-text-secondary',
      },
    ];
  }

  return [
    {
      label: 'Token',
      value: tokenValue,
      tone:
        candidate.tokenStatus === 'active' || candidate.tokenStatus === 'limited' || candidate.tokenStatus === 'expiring_soon'
          ? 'text-success'
          : 'text-warning',
    },
    {
      label: candidate.channel === 'facebook' ? (isEnglish ? 'Page' : 'Página') : (isEnglish ? 'Instagram account' : 'Conta IG'),
      value:
        candidate.channel === 'facebook'
          ? (isEnglish ? 'Connected' : 'Conectada')
          : candidate.igConnectionStatus === 'connected'
            ? (isEnglish ? 'Linked' : 'Vinculada')
            : (isEnglish ? 'Not linked' : 'Não vinculada'),
      tone: candidate.channel === 'facebook' || candidate.igConnectionStatus === 'connected' ? 'text-success' : 'text-warning',
    },
    {
      label: 'Webhook',
      value: candidate.isEligible ? (isEnglish ? 'Subscribes on connect' : 'Assina ao concluir') : (isEnglish ? 'Blocked' : 'Bloqueado'),
      tone: candidate.isEligible ? 'text-text-secondary' : 'text-warning',
    },
  ];
}

export function ConnectionSessionModal({ sessionId, onClose, onConnected }: Props) {
  const { isEnglish } = useWorkspaceLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<MetaChannelConnectSession | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setLoading(true);
      setError(null);

      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) throw new Error(isEnglish ? 'Not authenticated' : 'Não autenticado');

        const idToken = await user.getIdToken();
        const res = await fetch(`/api/channels/connect-session/${sessionId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json() as { error?: string; session?: MetaChannelConnectSession };

        if (!res.ok || !data.session) {
          throw new Error(data.error ?? (isEnglish ? 'Failed to load session' : 'Falha ao carregar sessão'));
        }

        if (cancelled) return;

        setSession(data.session);
        const initialCandidate =
          data.session.candidates.find((candidate) => candidate.isEligible) ??
          data.session.candidates[0];

        setSelectedCandidateId(initialCandidate?.id ?? null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : (isEnglish ? 'Failed to load session' : 'Falha ao carregar sessão'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [isEnglish, sessionId]);

  const selectedCandidate = useMemo(
    () => session?.candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [selectedCandidateId, session]
  );

  const handleConnect = async () => {
    if (!selectedCandidateId) {
      setError(isEnglish ? 'Select an account to continue.' : 'Selecione uma conta para continuar.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error(isEnglish ? 'Not authenticated' : 'Não autenticado');

      const idToken = await user.getIdToken();
      const res = await fetch(`/api/channels/connect-session/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ candidateId: selectedCandidateId }),
      });
      const data = await res.json() as { error?: string; success?: boolean };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? (isEnglish ? 'Failed to connect account' : 'Falha ao conectar conta'));
      }

      onConnected();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : (isEnglish ? 'Failed to connect account' : 'Falha ao conectar conta'));
    } finally {
      setSubmitting(false);
    }
  };

  const currentChannel = session?.channel ?? 'instagram';
  const ChannelIcon = currentChannel === 'facebook' ? Facebook : currentChannel === 'whatsapp' ? MessageCircle : Instagram;
  const modalTitle =
    currentChannel === 'facebook'
      ? (isEnglish ? 'Select Facebook Page' : 'Selecionar Página do Facebook')
      : currentChannel === 'whatsapp'
        ? (isEnglish ? 'Select WhatsApp Number' : 'Selecionar número do WhatsApp')
        : (isEnglish ? 'Select Instagram account' : 'Selecionar conta do Instagram');
  const modalSubtitle =
    currentChannel === 'facebook'
      ? (isEnglish ? 'The token has been validated. Choose one Page to finish the connection.' : 'O token foi validado. Escolha exatamente uma Página para concluir a conexão.')
      : currentChannel === 'whatsapp'
        ? (isEnglish ? 'The token has been validated. Choose one business phone number to finish the connection.' : 'O token foi validado. Escolha um número comercial para concluir a conexão.')
        : (isEnglish ? 'The token has been validated. Choose one Page/account to finish the connection.' : 'O token foi validado. Escolha exatamente uma Página/conta para concluir a conexão.');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{modalTitle}</h2>
            <p className="text-xs text-text-muted mt-1">{modalSubtitle}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-text-muted gap-2">
              <Loader2 size={16} className="animate-spin" />
              {isEnglish ? 'Loading available accounts...' : 'Carregando contas disponíveis...'}
            </div>
          )}

          {!loading && error && (
            <div className="flex gap-2 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3">
              <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {!loading && session && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={currentChannel as 'instagram' | 'facebook' | 'whatsapp'} size="sm">
                  <ChannelIcon size={12} className="mr-1" />
                  {currentChannel === 'facebook'
                    ? 'Facebook Approval Flow'
                    : currentChannel === 'whatsapp'
                      ? 'WhatsApp Manual Flow'
                      : 'Instagram Approval Flow'}
                </Badge>
                <Badge variant={session.authMethod === 'oauth' ? 'primary' : 'outline'} size="sm">
                  {session.authMethod === 'oauth'
                    ? (isEnglish ? 'Meta OAuth' : 'OAuth Meta')
                    : (isEnglish ? 'Advanced token' : 'Token avançado')}
                </Badge>
                {session.lastError && (
                  <Badge variant="warning" size="sm">
                    {isEnglish ? 'Review current error' : 'Revisar erro atual'}
                  </Badge>
                )}
              </div>

              {session.lastError && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3">
                  <p className="text-sm text-amber-200">{session.lastError}</p>
                </div>
              )}

              {session.candidates.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-4 py-5 text-sm text-text-muted">
                  {isEnglish ? 'No eligible account was returned for this session.' : 'Nenhuma conta elegível foi retornada para esta sessão.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {session.candidates.map((candidate) => {
                    const tone = getCandidateTone(candidate, isEnglish);

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedCandidateId(candidate.id)}
                        className={clsx(
                          'w-full text-left rounded-2xl border bg-card px-4 py-4 transition-colors',
                          selectedCandidateId === candidate.id
                            ? 'border-accent ring-2 ring-accent/20'
                            : tone.border
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {candidate.pageAvatarURL ? (
                              <img
                                src={candidate.pageAvatarURL}
                                alt={candidate.pageName}
                                className="w-11 h-11 rounded-xl object-cover border border-border"
                              />
                            ) : (
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${candidate.channel === 'facebook' ? 'bg-blue-950/50' : candidate.channel === 'whatsapp' ? 'bg-green-950/50' : 'bg-pink-950/50'}`}>
                                {candidate.channel === 'facebook' ? (
                                  <Facebook size={18} className="text-facebook" />
                                ) : candidate.channel === 'whatsapp' ? (
                                  <MessageCircle size={18} className="text-whatsapp" />
                                ) : (
                                  <Instagram size={18} className="text-instagram" />
                                )}
                              </div>
                            )}

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-text-primary">{candidate.pageName}</h3>
                                <Badge variant={tone.badge} size="xs">
                                  {tone.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-text-muted mt-1">
                                {candidate.channel === 'whatsapp'
                                  ? `WABA ${candidate.pageId}${candidate.phoneNumber ? ` · ${candidate.phoneNumber}` : ''}`
                                  : `${isEnglish ? 'Page' : 'Página'} ${candidate.pageId}${candidate.instagramUsername ? ` · @${candidate.instagramUsername}` : ''}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            {tone.icon}
                            {candidate.statusReason}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                          {getCandidateDetails(candidate, isEnglish).map((detail) => (
                            <div key={`${candidate.id}-${detail.label}`} className="rounded-xl border border-border bg-surface-elevated px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-text-muted">{detail.label}</p>
                              <p className={clsx('text-sm mt-1', detail.tone)}>{detail.value}</p>
                            </div>
                          ))}
                        </div>

                        {candidate.missingScopes.length > 0 && (
                          <p className="mt-3 text-xs text-amber-300">
                            {isEnglish ? 'Missing scopes' : 'Escopos faltando'}: {candidate.missingScopes.join(', ')}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
          <div className="text-xs text-text-muted">
            {selectedCandidate ? selectedCandidate.statusReason : (isEnglish ? 'Select an account to continue.' : 'Selecione uma conta para continuar.')}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              {isEnglish ? 'Close' : 'Fechar'}
            </Button>
            <Button
              onClick={handleConnect}
              disabled={submitting || !selectedCandidate || !selectedCandidate.isEligible}
            >
              {submitting
                ? (isEnglish ? 'Connecting...' : 'Conectando...')
                : isEnglish
                  ? 'Connect selected account'
                  : 'Conectar conta selecionada'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
