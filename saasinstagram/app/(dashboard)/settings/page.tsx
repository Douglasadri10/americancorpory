'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Save, Globe, Clock, Bell, Bot, Shield, Palette, Brain, Plug, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';
import { KnowledgeBlocksPanel } from '@/components/settings/KnowledgeBlocksPanel';
import { toast } from 'sonner';

const DEFAULT_AI_PROMPT_PT =
  'Você é um assistente de atendimento ao cliente profissional. Responda no idioma do cliente, com clareza e educação. Mantenha o idioma estabelecido pelo cliente, a menos que ele peça para mudar.';

const DEFAULT_AI_PROMPT_EN =
  "You are a professional customer support assistant. Reply in the customer's language, clearly and politely. Keep the language established by the customer unless they ask to switch.";

const DEFAULT_ALERT_RECIPIENT_EMAIL = 'admin@usehanna.com';

export default function SettingsPage() {
  const { user } = useAuth();
  const { workspace, setWorkspace, setLanguage: setGlobalLanguage, isEnglish } = useWorkspaceLocale();
  const [activeSection, setActiveSection] = useState('general');
  const [saving, setSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // General settings state
  const [workspaceName, setWorkspaceName] = useState('Meu Workspace');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [language, setLanguage] = useState('pt-BR');

  // Business hours state
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [outsideHoursMsg, setOutsideHoursMsg] = useState(
    'Olá! Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Deixe sua mensagem e retornaremos em breve!'
  );

  // AI settings state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiSystemPrompt, setAiSystemPrompt] = useState(DEFAULT_AI_PROMPT_PT);
  const [aiPersonality, setAiPersonality] = useState('');

  // Notification settings
  const [notifNewConv, setNotifNewConv] = useState(true);
  const [notifNewMsg, setNotifNewMsg] = useState(true);
  const [alertEmailEnabled, setAlertEmailEnabled] = useState(true);
  const [alertWhatsAppEnabled, setAlertWhatsAppEnabled] = useState(false);
  const [alertSmsEnabled, setAlertSmsEnabled] = useState(false);
  const [alertRecipientEmail, setAlertRecipientEmail] = useState('');
  const [alertRecipientPhone, setAlertRecipientPhone] = useState('');
  const [alertOnAccountCreated, setAlertOnAccountCreated] = useState(true);
  const [alertOnLeadWon, setAlertOnLeadWon] = useState(true);
  const [alertOnSupportTicketOpened, setAlertOnSupportTicketOpened] = useState(true);

  // Appearance
  const [theme, setTheme] = useState<'dark' | 'dim' | 'system'>('dim');

  // Integrations
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);

  // Load saved theme on mount and apply it
  useEffect(() => {
    const saved = (localStorage.getItem('hanna-theme') ?? 'dim') as 'dark' | 'dim' | 'system';
    setTheme(saved);
    applyTheme(saved);
  }, []);

  // Apply theme whenever it changes
  const applyTheme = (t: 'dark' | 'dim' | 'system') => {
    const html = document.documentElement;
    if (t === 'dark') {
      html.classList.add('dark');
    } else if (t === 'dim') {
      html.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      prefersDark ? html.classList.add('dark') : html.classList.remove('dark');
    }
    localStorage.setItem('hanna-theme', t);
  };

  const handleThemeChange = (t: 'dark' | 'dim' | 'system') => {
    setTheme(t);
    applyTheme(t);
  };

  const sections = [
    { id: 'general', label: isEnglish ? 'General' : 'Geral', icon: Globe },
    { id: 'hours', label: isEnglish ? 'Hours' : 'Horários', icon: Clock },
    { id: 'notifications', label: isEnglish ? 'Notifications' : 'Notificações', icon: Bell },
    { id: 'ai', label: isEnglish ? 'AI & Automation' : 'IA e Automação', icon: Bot },
    { id: 'knowledge', label: isEnglish ? 'Knowledge Base' : 'Base de Conhecimento', icon: Brain },
    { id: 'integrations', label: isEnglish ? 'Integrations' : 'Integrações', icon: Plug },
    { id: 'security', label: isEnglish ? 'Security' : 'Segurança', icon: Shield },
    { id: 'appearance', label: isEnglish ? 'Appearance' : 'Aparência', icon: Palette },
  ];
  const daysOfWeek = isEnglish
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  // Load workspace + existing settings on mount — depends on `user` so it re-runs
  // when Firebase Auth restores the session, avoiding a race with auth.currentUser.
  useEffect(() => {
    if (!user) return;
    const cached = localStorage.getItem('currentWorkspaceId');
    const workspaceQuery = cached ? `?workspaceId=${encodeURIComponent(cached)}` : '';

    user.getIdToken().then((idToken) =>
      fetch(`/api/workspace/me${workspaceQuery}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json())
        .then((data: { workspace?: { id: string; name: string; settings?: Record<string, unknown> } }) => {
          if (!data.workspace) return;
          setWorkspaceId(data.workspace.id);
          localStorage.setItem('currentWorkspaceId', data.workspace.id);
          setWorkspace((prev) => prev ? {
            ...prev,
            id: data.workspace!.id,
            name: data.workspace!.name ?? prev.name,
            settings: {
              ...prev.settings,
              ...(data.workspace!.settings ?? {}),
            },
          } : prev);
          if (data.workspace.name) setWorkspaceName(data.workspace.name);
          const s = data.workspace.settings as Record<string, unknown> | undefined;
          if (s) {
            if (typeof s.aiEnabled === 'boolean') setAiEnabled(s.aiEnabled);
            if (typeof s.aiPersonality === 'string') setAiPersonality(s.aiPersonality);
            if (typeof s.timezone === 'string') setTimezone(s.timezone);
            if (typeof s.language === 'string') setLanguage(s.language);
            const businessHours = s.businessHours as {
              enabled?: boolean;
              outsideHoursMessage?: string;
            } | undefined;
            if (typeof businessHours?.enabled === 'boolean') setHoursEnabled(businessHours.enabled);
            if (typeof businessHours?.outsideHoursMessage === 'string') setOutsideHoursMsg(businessHours.outsideHoursMessage);
            const notifications = s.notifications as {
              newConversation?: boolean;
              newMessage?: boolean;
              alertChannels?: {
                email?: boolean;
                whatsapp?: boolean;
                sms?: boolean;
              };
              alertRecipients?: {
                email?: string;
                phone?: string;
              };
              alertEvents?: {
                accountCreated?: boolean;
                leadWon?: boolean;
                supportTicketOpened?: boolean;
              };
            } | undefined;
            if (typeof notifications?.newConversation === 'boolean') setNotifNewConv(notifications.newConversation);
            if (typeof notifications?.newMessage === 'boolean') setNotifNewMsg(notifications.newMessage);
            if (typeof notifications?.alertChannels?.email === 'boolean') setAlertEmailEnabled(notifications.alertChannels.email);
            if (typeof notifications?.alertChannels?.whatsapp === 'boolean') setAlertWhatsAppEnabled(notifications.alertChannels.whatsapp);
            if (typeof notifications?.alertChannels?.sms === 'boolean') setAlertSmsEnabled(notifications.alertChannels.sms);
            if (typeof notifications?.alertRecipients?.email === 'string') setAlertRecipientEmail(notifications.alertRecipients.email);
            if (typeof notifications?.alertRecipients?.phone === 'string') setAlertRecipientPhone(notifications.alertRecipients.phone);
            if (typeof notifications?.alertEvents?.accountCreated === 'boolean') setAlertOnAccountCreated(notifications.alertEvents.accountCreated);
            if (typeof notifications?.alertEvents?.leadWon === 'boolean') setAlertOnLeadWon(notifications.alertEvents.leadWon);
            if (typeof notifications?.alertEvents?.supportTicketOpened === 'boolean') setAlertOnSupportTicketOpened(notifications.alertEvents.supportTicketOpened);
          }
          // Check Google Calendar integration
          const integrations = (data.workspace as Record<string, unknown>).integrations as Record<string, unknown> | undefined;
          const gc = integrations?.googleCalendar as { connectedEmail?: string } | null | undefined;
          if (gc?.connectedEmail) {
            setGoogleConnected(true);
            setGoogleEmail(gc.connectedEmail);
          }
        })
        .catch(() => null)
    );
  }, [user, setWorkspace]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    setWorkspaceId(workspace.id);
    setWorkspaceName(workspace.name);
    if (workspace.settings?.timezone) {
      setTimezone(workspace.settings.timezone);
    }
    if (workspace.settings?.language) {
      setLanguage(workspace.settings.language);
    }
  }, [workspace]);

  useEffect(() => {
    const normalizedAlertRecipientEmail = alertRecipientEmail.trim().toLowerCase();
    const normalizedUserEmail = user?.email?.trim().toLowerCase();

    if (!normalizedAlertRecipientEmail) {
      setAlertRecipientEmail(DEFAULT_ALERT_RECIPIENT_EMAIL);
      return;
    }

    if (normalizedUserEmail && normalizedAlertRecipientEmail === normalizedUserEmail) {
      setAlertRecipientEmail(DEFAULT_ALERT_RECIPIENT_EMAIL);
    }
  }, [alertRecipientEmail, user?.email]);

  useEffect(() => {
    if (!aiPersonality) {
      setAiSystemPrompt(isEnglish ? DEFAULT_AI_PROMPT_EN : DEFAULT_AI_PROMPT_PT);
    }
  }, [aiPersonality, isEnglish]);

  // Handle Google OAuth redirect result
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const googleParam = params.get('google');
    const section = params.get('section');
    if (section === 'integrations') setActiveSection('integrations');
    if (googleParam === 'connected') {
      toast.success('Google Agenda conectado com sucesso!');
      // Reload to get updated integration data
      window.history.replaceState({}, '', window.location.pathname);
    } else if (googleParam === 'error') {
      const msg = params.get('msg');
      toast.error(msg ? `Google Agenda: ${msg}` : 'Erro ao conectar Google Agenda. Tente novamente.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSave = async () => {
    const id = workspaceId ?? workspace?.id ?? null;
    if (!id) {
      toast.error(isEnglish ? 'Workspace not found' : 'Workspace não encontrado');
      return;
    }
    setSaving(true);
    try {
      const auth = getFirebaseAuth();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Não autenticado');
      const idToken = await firebaseUser.getIdToken();

      const settings: Record<string, unknown> = {
        aiEnabled,
        aiPersonality: aiPersonality || aiSystemPrompt,
        aiModel: 'gpt-4o-mini',
        timezone,
        language,
        businessHours: {
          enabled: hoursEnabled,
          outsideHoursMessage: outsideHoursMsg,
        },
        notifications: {
          newConversation: notifNewConv,
          newMessage: notifNewMsg,
          alertChannels: {
            email: alertEmailEnabled,
            whatsapp: alertWhatsAppEnabled,
            sms: alertSmsEnabled,
          },
          alertRecipients: {
            email: alertRecipientEmail.trim() || undefined,
            phone: alertRecipientPhone.trim() || undefined,
          },
          alertEvents: {
            accountCreated: alertOnAccountCreated,
            leadWon: alertOnLeadWon,
            supportTicketOpened: alertOnSupportTicketOpened,
          },
        },
      };

      const res = await fetch('/api/workspace/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ workspaceId: id, workspaceName, settings }),
      });

      if (!res.ok) throw new Error(isEnglish ? 'Failed to save settings' : 'Falha ao salvar');

      const savedInEnglish = language.toLowerCase().startsWith('en');
      setGlobalLanguage(language);
      setWorkspace((prev) => prev ? {
        ...prev,
        name: workspaceName,
        settings: {
          ...prev.settings,
          ...settings,
        },
      } : prev);
      toast.success(savedInEnglish ? 'Settings saved.' : 'Configurações salvas!');
    } catch {
      toast.error(isEnglish ? 'Error saving settings' : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    const id = workspaceId ?? workspace?.id;
    if (!id) return;
    setGoogleConnecting(true);
    try {
      const auth = getFirebaseAuth();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Não autenticado');
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(`/api/auth/google?workspaceId=${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error('Erro ao iniciar autenticação com Google.');
    } finally {
      setGoogleConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    const id = workspaceId ?? workspace?.id;
    if (!id) return;
    setGoogleDisconnecting(true);
    try {
      const auth = getFirebaseAuth();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Não autenticado');
      const idToken = await firebaseUser.getIdToken();
      await fetch(`/api/auth/google/disconnect?workspaceId=${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setGoogleConnected(false);
      setGoogleEmail('');
      toast.success('Google Agenda desconectado.');
    } catch {
      toast.error('Erro ao desconectar.');
    } finally {
      setGoogleDisconnecting(false);
    }
  };

  const Toggle = ({
    value,
    onChange,
    label,
    description,
  }: {
    value: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description?: string;
  }) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={clsx(
          'w-10 h-5 rounded-full transition-colors relative shrink-0',
          value ? 'bg-accent' : 'bg-muted'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
            value ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
            <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-4">
                {isEnglish ? 'Workspace Information' : 'Informações do Workspace'}
              </h3>
              <div className="space-y-4">
                <Input
                  label={isEnglish ? 'Workspace name' : 'Nome do workspace'}
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  fullWidth
                />
                <Select
                  label={isEnglish ? 'Timezone' : 'Fuso horário'}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  options={[
                    { value: 'America/New_York', label: 'Eastern Time — New York (GMT-5)' },
                    { value: 'America/Chicago', label: 'Central Time — Chicago (GMT-6)' },
                    { value: 'America/Denver', label: 'Mountain Time — Denver (GMT-7)' },
                    { value: 'America/Los_Angeles', label: 'Pacific Time — Los Angeles (GMT-8)' },
                    { value: 'America/Phoenix', label: 'Arizona — Phoenix (GMT-7)' },
                    { value: 'America/Anchorage', label: 'Alaska (GMT-9)' },
                    { value: 'Pacific/Honolulu', label: 'Hawaii (GMT-10)' },
                    { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
                    { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
                    { value: 'America/Belem', label: 'Belém (GMT-3)' },
                    { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
                  ]}
                  fullWidth
                />
                <Select
                  label={isEnglish ? 'Language' : 'Idioma'}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  options={[
                    { value: 'pt-BR', label: 'Português (Brasil)' },
                    { value: 'en-US', label: 'English (US)' },
                  ]}
                  fullWidth
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary mb-4">
                {isEnglish ? 'User Profile' : 'Perfil do usuário'}
              </h3>
              <div className="space-y-4">
                <Input
                  label={isEnglish ? 'Name' : 'Nome'}
                  value={user?.displayName ?? ''}
                  placeholder={isEnglish ? 'Your name' : 'Seu nome'}
                  fullWidth
                />
                <Input
                  label="Email"
                  value={user?.email ?? ''}
                  disabled
                  fullWidth
                  hint={isEnglish ? 'Email cannot be changed' : 'O email não pode ser alterado'}
                />
              </div>
            </div>
          </div>
        );

      case 'hours':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {isEnglish ? 'Business hours' : 'Horário de atendimento'}
                </p>
                <p className="text-xs text-text-muted">
                  {isEnglish ? 'Set when your business is available' : 'Defina os horários em que seu negócio está disponível'}
                </p>
              </div>
              <button
                onClick={() => setHoursEnabled(!hoursEnabled)}
                className={clsx('w-10 h-5 rounded-full transition-colors relative', hoursEnabled ? 'bg-accent' : 'bg-muted')}
              >
                <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', hoursEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>

            {hoursEnabled && (
              <div className="space-y-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2">
                    <span className="text-sm text-text-secondary w-20 shrink-0">{day}</span>
                    <input type="time" defaultValue="09:00" className="bg-transparent text-sm text-text-primary focus:outline-none" />
                    <span className="text-text-muted text-xs">{isEnglish ? 'to' : 'até'}</span>
                    <input type="time" defaultValue="18:00" className="bg-transparent text-sm text-text-primary focus:outline-none" />
                  </div>
                ))}
              </div>
            )}

            <Textarea
              label={isEnglish ? 'Outside business hours message' : 'Mensagem fora do horário'}
              value={outsideHoursMsg}
              onChange={(e) => setOutsideHoursMsg(e.target.value)}
              fullWidth
              hint={isEnglish ? 'Sent automatically when someone contacts you outside business hours' : 'Enviada automaticamente quando alguém contata fora do horário'}
            />
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="divide-y divide-border">
              <Toggle
                value={notifNewConv}
                onChange={setNotifNewConv}
                label={isEnglish ? 'New conversation' : 'Nova conversa'}
                description={isEnglish ? 'Notify when a new conversation arrives' : 'Notificar quando uma nova conversa chegar'}
              />
              <Toggle
                value={notifNewMsg}
                onChange={setNotifNewMsg}
                label={isEnglish ? 'New message' : 'Nova mensagem'}
                description={isEnglish ? 'Notify when a new message arrives in assigned conversations' : 'Notificar quando uma nova mensagem chegar em conversas atribuídas'}
              />
            </div>

            <div className="pt-2 border-t border-border space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {isEnglish ? 'Operational alerts' : 'Alertas operacionais'}
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {isEnglish
                    ? 'Get alerts when a workspace is created, a sale is marked as won, or a support ticket is opened.'
                    : 'Receba alertas quando uma conta for criada, uma venda for marcada como ganha ou um ticket de suporte for aberto.'}
                </p>
              </div>

              <div className="divide-y divide-border rounded-xl border border-border px-4">
                <Toggle
                  value={alertOnAccountCreated}
                  onChange={setAlertOnAccountCreated}
                  label={isEnglish ? 'Account created' : 'Conta criada'}
                  description={isEnglish ? 'Alert when a new workspace/account is created' : 'Alertar quando um novo workspace/conta for criado'}
                />
                <Toggle
                  value={alertOnLeadWon}
                  onChange={setAlertOnLeadWon}
                  label={isEnglish ? 'Sale won' : 'Venda ganha'}
                  description={isEnglish ? 'Alert when a lead is moved to won' : 'Alertar quando um lead for movido para ganho'}
                />
                <Toggle
                  value={alertOnSupportTicketOpened}
                  onChange={setAlertOnSupportTicketOpened}
                  label={isEnglish ? 'Support ticket opened' : 'Ticket aberto'}
                  description={isEnglish ? 'Alert when a new support ticket is opened' : 'Alertar quando um novo ticket de suporte for aberto'}
                />
              </div>

              <div className="divide-y divide-border rounded-xl border border-border px-4">
                <Toggle
                  value={alertEmailEnabled}
                  onChange={setAlertEmailEnabled}
                  label="Email"
                  description={isEnglish ? 'Send operational alerts by email' : 'Enviar alertas operacionais por email'}
                />
                <Toggle
                  value={alertWhatsAppEnabled}
                  onChange={setAlertWhatsAppEnabled}
                  label="WhatsApp"
                  description={isEnglish ? 'Send operational alerts by WhatsApp' : 'Enviar alertas operacionais por WhatsApp'}
                />
                <Toggle
                  value={alertSmsEnabled}
                  onChange={setAlertSmsEnabled}
                  label="SMS"
                  description={isEnglish ? 'Send operational alerts by text message' : 'Enviar alertas operacionais por mensagem de texto'}
                />
              </div>

              <Input
                label={isEnglish ? 'Alert email' : 'Email para alertas'}
                type="email"
                value={alertRecipientEmail}
                onChange={(e) => setAlertRecipientEmail(e.target.value)}
                placeholder={DEFAULT_ALERT_RECIPIENT_EMAIL}
                fullWidth
                hint={isEnglish ? `Used when email alerts are enabled. Defaults to ${DEFAULT_ALERT_RECIPIENT_EMAIL}.` : `Usado quando os alertas por email estiverem ligados. Padrão: ${DEFAULT_ALERT_RECIPIENT_EMAIL}.`}
              />

              <Input
                label={isEnglish ? 'Phone for WhatsApp / SMS' : 'Telefone para WhatsApp / SMS'}
                value={alertRecipientPhone}
                onChange={(e) => setAlertRecipientPhone(e.target.value)}
                placeholder="+5511999999999"
                fullWidth
                hint={isEnglish ? 'Use international format, for example +5511999999999.' : 'Use formato internacional, por exemplo +5511999999999.'}
              />

              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-xs text-text-muted">
                  {isEnglish
                    ? 'Email delivery uses Resend if configured. SMS and WhatsApp delivery use Twilio if configured.'
                    : 'Envio por email usa Resend se configurado. SMS e WhatsApp usam Twilio se configurado.'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'ai':
        return (
          <div className="space-y-4">
            <Toggle
              value={aiEnabled}
              onChange={setAiEnabled}
              label={isEnglish ? 'Enable AI globally' : 'Habilitar IA globalmente'}
              description={isEnglish ? 'Allow automations and agents to use AI for replies' : 'Permite que automações e agentes usem IA para responder'}
            />

            {aiEnabled && (
              <Textarea
                label={isEnglish ? 'Default system prompt' : 'Prompt de sistema padrão'}
                value={aiPersonality || aiSystemPrompt}
                onChange={(e) => setAiPersonality(e.target.value)}
                fullWidth
                hint={isEnglish ? "Global instruction for AI. Example: 'You are the MD Floors assistant. Always reply in the customer's language, in a professional and helpful way.'" : "Instrução global para a IA. Ex: 'Você é o assistente da MD Floors. Sempre responda no idioma do cliente, de forma profissional e prestativa.'"}
              />
            )}
          </div>
        );

      case 'knowledge':
        return (
          <KnowledgeBlocksPanel workspaceId={workspaceId ?? workspace?.id ?? ''} />
        );

      case 'integrations':
        return (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              {isEnglish
                ? 'Connect external services to enhance HannaAI.'
                : 'Conecte serviços externos para potencializar o HannaAI.'}
            </p>

            {/* Google Calendar */}
            <div className="border border-border rounded-xl p-4 flex items-start gap-4">
              {/* Google icon */}
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-6 h-6">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-text-primary">Google Agenda</p>
                  {googleConnected ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 size={12} /> {isEnglish ? 'Connected' : 'Conectado'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                      <AlertCircle size={12} /> {isEnglish ? 'Not connected' : 'Não conectado'}
                    </span>
                  )}
                </div>
                {googleConnected ? (
                  <p className="text-xs text-text-muted mb-3">{googleEmail}</p>
                ) : (
                  <p className="text-xs text-text-muted mb-3">
                    {isEnglish
                      ? 'Sync appointments with Google Calendar. AI will check real availability before suggesting time slots.'
                      : 'Sincronize compromissos com o Google Agenda. A IA verificará disponibilidade real antes de sugerir horários.'}
                  </p>
                )}

                {googleConnected ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={googleDisconnecting}
                    onClick={handleDisconnectGoogle}
                  >
                    {isEnglish ? 'Disconnect' : 'Desconectar'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    loading={googleConnecting}
                    onClick={handleConnectGoogle}
                  >
                    {isEnglish ? 'Connect Google Calendar' : 'Conectar Google Agenda'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                {isEnglish ? 'Change password' : 'Alterar senha'}
              </h3>
              <div className="space-y-3">
                <Input label={isEnglish ? 'Current password' : 'Senha atual'} type="password" placeholder="••••••••" fullWidth />
                <Input label={isEnglish ? 'New password' : 'Nova senha'} type="password" placeholder="••••••••" fullWidth />
                <Input label={isEnglish ? 'Confirm new password' : 'Confirmar nova senha'} type="password" placeholder="••••••••" fullWidth />
                <Button variant="secondary" size="sm">{isEnglish ? 'Change password' : 'Alterar senha'}</Button>
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                {isEnglish ? 'Active sessions' : 'Sessões ativas'}
              </h3>
              <div className="bg-surface border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-text-primary">{isEnglish ? 'This device' : 'Este dispositivo'}</p>
                    <p className="text-xs text-text-muted">{isEnglish ? 'Browser · Now' : 'Navegador · Agora'}</p>
                  </div>
                  <Badge variant="success" size="xs" dot>{isEnglish ? 'Active' : 'Ativo'}</Badge>
                </div>
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">{isEnglish ? 'Theme' : 'Tema'}</h3>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: 'dark' as const, labelEn: 'Dark', labelPt: 'Escuro' },
                  { key: 'dim' as const, labelEn: 'Light', labelPt: 'Claro' },
                  { key: 'system' as const, labelEn: 'System', labelPt: 'Sistema' },
                ]).map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleThemeChange(option.key)}
                    className={clsx(
                      'p-3 rounded-lg border text-xs font-medium transition-colors',
                      theme === option.key
                        ? 'border-accent bg-accent-subtle text-accent'
                        : 'border-border text-text-muted hover:border-muted'
                    )}
                  >
                    {isEnglish ? option.labelEn : option.labelPt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={isEnglish ? 'Settings' : 'Configurações'} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <div className="w-[200px] shrink-0 border-r border-border p-3 space-y-0.5 overflow-y-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={clsx(
                  'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-accent-subtle text-accent font-medium'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                )}
              >
                <Icon size={15} className={active ? 'text-accent' : 'text-text-muted'} />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl">
            <Card>
              {renderContent()}

              {activeSection !== 'integrations' && activeSection !== 'knowledge' && (
                <div className="mt-6 pt-4 border-t border-border flex justify-end">
                  <Button
                    size="sm"
                    leftIcon={<Save size={14} />}
                    loading={saving}
                    onClick={handleSave}
                  >
                    {isEnglish ? 'Save changes' : 'Salvar alterações'}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
