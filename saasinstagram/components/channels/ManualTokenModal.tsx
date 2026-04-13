'use client';

import React, { useState, useEffect } from 'react';
import { X, Instagram, Loader2, HelpCircle, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';

interface Props {
  channel: 'instagram' | 'whatsapp';
  workspaceId: string;
  onClose: () => void;
  onSuccess: (sessionId: string, resolvedWorkspaceId?: string) => void;
}

export function ManualTokenModal({ channel, workspaceId: initialWorkspaceId, onClose, onSuccess }: Props) {
  const { isEnglish } = useWorkspaceLocale();
  const [workspaceId, setWorkspaceId] = useState(
    initialWorkspaceId || (typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceId') ?? '' : '')
  );
  const [accessToken, setAccessToken] = useState('');
  const [pageId, setPageId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceId) return;
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return;
    const cached = typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceId') : null;
    const workspaceQuery = cached ? `?workspaceId=${encodeURIComponent(cached)}` : '';

    user.getIdToken().then((idToken) =>
      fetch(`/api/workspace/me${workspaceQuery}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json())
        .then((data: { workspace?: { id: string } }) => {
          if (data.workspace?.id) {
            setWorkspaceId(data.workspace.id);
            localStorage.setItem('currentWorkspaceId', data.workspace.id);
          }
        })
        .catch(() => null)
    );
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accessToken.trim()) {
      setError(isEnglish ? 'Enter the access token.' : 'Insira o access token.');
      return;
    }
    if (!workspaceId.trim()) {
      setError(isEnglish ? 'Workspace ID not found. Reload the page and try again.' : 'Workspace ID não encontrado. Recarregue a página e tente novamente.');
      return;
    }
    if (channel === 'whatsapp' && !wabaId.trim()) {
      setError(isEnglish ? 'Enter the WABA ID.' : 'Informe o WABA ID.');
      return;
    }

    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error(isEnglish ? 'Not authenticated' : 'Não autenticado');

      const idToken = await user.getIdToken();

      const res = await fetch('/api/channels/manual/inspect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          workspaceId: workspaceId.trim(),
          channel,
          accessToken: accessToken.trim(),
          pageId: pageId.trim() || undefined,
          wabaId: wabaId.trim() || undefined,
          phoneNumberId: phoneNumberId.trim() || undefined,
        }),
      });

      const data = await res.json() as { error?: string; sessionId?: string };

      if (!res.ok || !data.sessionId) {
        throw new Error(data.error ?? (isEnglish ? 'Error connecting channel' : 'Erro ao conectar canal'));
      }

      onSuccess(data.sessionId, workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : (isEnglish ? 'Unknown error' : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text-primary">
            {isEnglish ? 'Use advanced token' : 'Usar token avançado'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${channel === 'instagram' ? 'border border-instagram/30 bg-pink-950/30' : 'border border-whatsapp/30 bg-green-950/30'}`}>
            {channel === 'instagram' ? (
              <Instagram size={15} className="text-instagram" />
            ) : (
              <MessageCircle size={15} className="text-whatsapp" />
            )}
            <div>
              <p className="text-sm font-medium text-text-primary">
                {channel === 'instagram' ? 'Instagram Approval Flow' : 'WhatsApp Manual Connection'}
              </p>
              <p className="text-xs text-text-muted">
                {channel === 'instagram'
                  ? (isEnglish ? 'Validate a token and select one eligible account.' : 'Fluxo avançado para validar token e selecionar uma única conta.')
                  : (isEnglish ? 'Validate the token, load WABA phone numbers, and select one number.' : 'Valide o token, carregue os números do WABA e selecione um número.')}
              </p>
            </div>
          </div>

          {!workspaceId && (
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1.5">
                Workspace ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                placeholder={isEnglish ? 'Paste your workspace ID' : 'Cole o ID do seu workspace'}
                className="w-full bg-surface-elevated border border-red-500/40 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-red-400 mt-1">
                {isEnglish ? 'Workspace was not detected. Reload the page and try again.' : 'Workspace não detectado. Encontre o ID em: Configurações → Workspace.'}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">
              Access Token <span className="text-red-400">*</span>
            </label>
            <textarea
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAAxxxxxxxxxx..."
              rows={3}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none font-mono"
            />
            <p className="text-xs text-text-muted mt-1">
              {channel === 'instagram'
                ? (isEnglish ? 'User Token or Page Token from Meta for Developers / Graph API Explorer' : 'User Token ou Page Token do Meta for Developers / Graph API Explorer')
                : (isEnglish ? 'System User, Business Integration, or User Token with WhatsApp permissions' : 'System User, Business Integration ou User Token com permissões de WhatsApp')}
            </p>
          </div>

          {channel === 'instagram' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Page ID <span className="text-text-muted font-normal">({isEnglish ? 'optional' : 'opcional'})</span>
                </label>
                <input
                  type="text"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder="123456789"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
                <p className="text-xs font-medium text-text-secondary">Instagram Account ID</p>
                <p className="text-xs text-text-muted mt-1">
                  {isEnglish
                    ? 'Resolved and validated by the backend. Only provide the Page ID if you are using a page token or IG token.'
                    : 'Agora é resolvido e validado pelo backend. Informe só o Page ID se estiver usando page token/IG token.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  WABA ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder="123456789"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Phone Number ID <span className="text-text-muted font-normal">({isEnglish ? 'optional' : 'opcional'})</span>
                </label>
                <input
                  type="text"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="107654321"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 bg-accent-subtle/20 border border-accent/20 rounded-lg p-3">
            <HelpCircle size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted">
              {channel === 'instagram' ? (
                <>
                  {isEnglish ? 'For Instagram: open ' : 'Para Instagram: acesse '}
                  <span className="text-text-primary font-medium">Meta for Developers → Graph API Explorer</span>
                  {isEnglish ? ', generate a User Token with ' : ', selecione seu app, gere um User Token com '}
                  <span className="font-mono text-xs bg-surface px-1 rounded">instagram_manage_messages</span>,{' '}
                  <span className="font-mono text-xs bg-surface px-1 rounded">pages_show_list</span>
                  {isEnglish
                    ? ' and related scopes, then paste it here. The app will inspect the token and list eligible accounts.'
                    : ' e dependências, e cole aqui. O app vai inspecionar o token e listar as contas elegíveis.'}
                </>
              ) : (
                <>
                  {isEnglish ? 'For WhatsApp: use a token with ' : 'Para WhatsApp: use um token com '}
                  <span className="font-mono text-xs bg-surface px-1 rounded">whatsapp_business_management</span>{' '}
                  {isEnglish ? 'and ' : 'e '}
                  <span className="font-mono text-xs bg-surface px-1 rounded">whatsapp_business_messaging</span>
                  {isEnglish
                    ? '. Get the WABA ID and Phone Number ID in Meta App Dashboard → WhatsApp → API Setup.'
                    : '. Pegue o WABA ID e o Phone Number ID em Meta App Dashboard → WhatsApp → API Setup.'}
                </>
              )}
            </p>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" fullWidth onClick={onClose} disabled={loading}>
              {isEnglish ? 'Cancel' : 'Cancelar'}
            </Button>
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {isEnglish ? 'Inspecting...' : 'Inspecionando...'}
                </span>
              ) : (
                isEnglish ? 'Inspect token' : 'Inspecionar token'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
