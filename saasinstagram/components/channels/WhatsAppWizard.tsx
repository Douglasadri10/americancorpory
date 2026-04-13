'use client';

import React, { useState } from 'react';
import {
  X,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Copy,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
}

const STEPS = [
  { id: 1, label: 'Preparar conta' },
  { id: 2, label: 'Pegar token' },
  { id: 3, label: 'IDs do número' },
  { id: 4, label: 'Conectar' },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                step.id < current
                  ? 'bg-success text-white'
                  : step.id === current
                  ? 'bg-whatsapp text-white'
                  : 'bg-surface text-text-muted'
              }`}
            >
              {step.id < current ? <CheckCircle2 size={12} /> : step.id}
            </div>
            <span
              className={`text-[11px] hidden sm:block ${
                step.id === current ? 'text-text-primary font-medium' : 'text-text-muted'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-1 ${step.id < current ? 'bg-success/40' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function CopyableCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5 font-mono text-xs text-text-secondary">
      <span className="flex-1">{value}</span>
      <button onClick={copy} className="text-text-muted hover:text-text-primary transition-colors">
        {copied ? <CheckCircle2 size={12} className="text-success" /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-whatsapp hover:text-whatsapp/80 transition-colors font-medium"
    >
      {children}
      <ExternalLink size={11} />
    </a>
  );
}

function Step1() {
  const items = [
    { label: 'Conta Meta Business (business.facebook.com)', done: false },
    { label: 'App no Meta for Developers com produto WhatsApp', done: false },
    { label: 'Número de telefone aprovado no WABA', done: false },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Antes de começar, você precisa de três coisas prontas no Meta:
      </p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
            <div className="w-5 h-5 rounded-full border-2 border-text-muted flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-text-muted font-bold">{i + 1}</span>
            </div>
            <span className="text-sm text-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 pt-1">
        <LinkButton href="https://business.facebook.com">Abrir Meta Business</LinkButton>
        <LinkButton href="https://developers.facebook.com/apps">Abrir Apps Meta</LinkButton>
      </div>
      <div className="bg-whatsapp/10 border border-whatsapp/20 rounded-lg px-3 py-2.5">
        <p className="text-xs text-text-secondary">
          <span className="font-semibold text-whatsapp">Dica:</span> Use o modo de teste gratuito do WhatsApp Business API — você consegue até 1.000 mensagens/mês sem custo, ideal para começar.
        </p>
      </div>
    </div>
  );
}

function Step2() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Você precisa de um <strong className="text-text-primary">System User Token</strong> com permissões de WhatsApp. Siga os passos:
      </p>
      <ol className="space-y-3">
        {[
          <>Acesse <LinkButton href="https://business.facebook.com/settings/system-users">Meta Business → Usuários do Sistema</LinkButton></>,
          'Crie um usuário do tipo "Admin" (ou use um existente)',
          'Clique em "Gerar novo token" → selecione seu app Meta',
          <>Marque as permissões:<br />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {['whatsapp_business_management', 'whatsapp_business_messaging'].map((p) => (
                <CopyableCode key={p} value={p} />
              ))}
            </div>
          </>,
          'Copie o token gerado — ele começa com EAA...',
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
            <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="bg-amber-950/30 border border-amber-700/30 rounded-lg px-3 py-2.5 flex gap-2">
        <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-text-muted">
          <span className="text-amber-400 font-medium">Importante:</span> tokens de System User são permanentes. Tokens de usuário pessoal expiram em 60 dias.
        </p>
      </div>
    </div>
  );
}

function Step3({ wabaId, setWabaId, phoneNumberId, setPhoneNumberId }: {
  wabaId: string; setWabaId: (v: string) => void;
  phoneNumberId: string; setPhoneNumberId: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Agora pegue o <strong className="text-text-primary">WABA ID</strong> e o <strong className="text-text-primary">Phone Number ID</strong>:
      </p>
      <ol className="space-y-2 text-sm text-text-secondary">
        <li className="flex items-start gap-3">
          <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0 mt-0.5">1</span>
          <span>Acesse <LinkButton href="https://developers.facebook.com/apps">Meta for Developers</LinkButton> → selecione seu app</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0 mt-0.5">2</span>
          <span>No menu lateral: <strong className="text-text-primary">WhatsApp → API Setup</strong></span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0 mt-0.5">3</span>
          <span>Copie o <strong className="text-text-primary">WhatsApp Business Account ID</strong> (WABA ID) e o <strong className="text-text-primary">Phone Number ID</strong></span>
        </li>
      </ol>

      <div className="space-y-3 pt-1">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1.5">
            WABA ID <span className="text-red-400">*</span>
            <span className="text-text-muted font-normal ml-1">— encontrado em API Setup</span>
          </label>
          <input
            type="text"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="ex: 123456789012345"
            className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-whatsapp/50 font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1.5">
            Phone Number ID <span className="text-red-400">*</span>
            <span className="text-text-muted font-normal ml-1">— logo abaixo do WABA ID</span>
          </label>
          <input
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="ex: 987654321098765"
            className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-whatsapp/50 font-mono"
          />
        </div>
      </div>
    </div>
  );
}

function Step4({ accessToken, setAccessToken }: { accessToken: string; setAccessToken: (v: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Cole o token que você gerou no passo 2:
      </p>
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1.5">
          System User Token <span className="text-red-400">*</span>
        </label>
        <textarea
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="EAAxxxxxxxxxx..."
          rows={4}
          className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-whatsapp/50 resize-none font-mono"
          autoFocus
        />
      </div>
      <div className="bg-surface border border-border rounded-lg p-3 space-y-1.5">
        <p className="text-xs font-medium text-text-secondary">Resumo da conexão:</p>
        <p className="text-xs text-text-muted">Token: {accessToken ? `${accessToken.slice(0, 12)}···` : <span className="text-warning">não informado</span>}</p>
      </div>
    </div>
  );
}

export function WhatsAppWizard({ workspaceId, onClose, onSuccess }: Props) {
  const { isEnglish } = useWorkspaceLocale();
  const [step, setStep] = useState(1);
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = () => {
    if (step === 3) return wabaId.trim().length > 0 && phoneNumberId.trim().length > 0;
    if (step === 4) return accessToken.trim().length > 10;
    return true;
  };

  const handleNext = async () => {
    if (step < 4) { setStep(step + 1); return; }

    // Final step — submit
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Não autenticado');
      const idToken = await user.getIdToken();

      const res = await fetch('/api/channels/manual/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          workspaceId,
          channel: 'whatsapp',
          accessToken: accessToken.trim(),
          wabaId: wabaId.trim(),
          phoneNumberId: phoneNumberId.trim(),
        }),
      });

      const data = await res.json() as { error?: string; sessionId?: string };
      if (!res.ok || !data.sessionId) throw new Error(data.error ?? 'Erro ao conectar canal');
      onSuccess(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const stepContent: Record<number, React.ReactNode> = {
    1: <Step1 />,
    2: <Step2 />,
    3: <Step3 wabaId={wabaId} setWabaId={setWabaId} phoneNumberId={phoneNumberId} setPhoneNumberId={setPhoneNumberId} />,
    4: <Step4 accessToken={accessToken} setAccessToken={setAccessToken} />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-950/60 flex items-center justify-center">
              <MessageCircle size={16} className="text-whatsapp" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Conectar WhatsApp</p>
              <p className="text-xs text-text-muted">WhatsApp Business Cloud API</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <StepIndicator current={step} />
          <div className="min-h-[260px]">
            {stepContent[step]}
          </div>

          {error && (
            <div className="mt-4 flex gap-2 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5 gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            leftIcon={step > 1 ? <ArrowLeft size={13} /> : undefined}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          <Button
            size="sm"
            onClick={() => void handleNext()}
            disabled={!canProceed() || loading}
            rightIcon={step < 4 ? <ChevronRight size={13} /> : undefined}
            className="bg-whatsapp hover:bg-whatsapp/90 text-white min-w-[120px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" />
                Conectando...
              </span>
            ) : step === 4 ? (
              'Conectar agora'
            ) : (
              `Continuar ${step}/4`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppWizard;
