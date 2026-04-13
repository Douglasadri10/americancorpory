'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Zap,
  MessageSquare,
  UserCheck,
  Tag,
  Bot,
  Clock,
  Globe,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import type { Automation, AutomationTrigger, AutomationAction, AutomationActionType } from '@/types/automation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { toast } from 'sonner';

interface AutomationEditorProps {
  automation?: Partial<Automation>;
  onSave: (automation: Omit<Automation, 'id' | 'stats' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  workspaceId: string;
  createdBy: string;
  loading?: boolean;
}

const triggerOptions = [
  { value: 'new_conversation', label: 'Nova conversa iniciada' },
  { value: 'new_message', label: 'Nova mensagem recebida' },
  { value: 'keyword_match', label: 'Palavra-chave detectada' },
  { value: 'conversation_assigned', label: 'Conversa atribuída' },
  { value: 'conversation_resolved', label: 'Conversa resolvida' },
  { value: 'no_agent_reply', label: 'Sem resposta do agente' },
  { value: 'outside_business_hours', label: 'Fora do horário de atendimento' },
];

const actionOptions: Array<{ value: AutomationActionType; label: string; icon: LucideIcon }> = [
  { value: 'send_message', label: 'Enviar mensagem', icon: MessageSquare },
  { value: 'ai_reply', label: 'Responder com IA', icon: Bot },
  { value: 'assign_agent', label: 'Atribuir agente', icon: UserCheck },
  { value: 'add_tag', label: 'Adicionar etiqueta', icon: Tag },
  { value: 'change_status', label: 'Mudar status', icon: Zap },
  { value: 'wait', label: 'Aguardar', icon: Clock },
  { value: 'webhook', label: 'Webhook', icon: Globe },
  { value: 'notify_agent', label: 'Notificar agente', icon: Bell },
];

function ActionEditor({
  action,
  onChange,
  onRemove,
}: {
  action: AutomationAction;
  onChange: (action: AutomationAction) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const actionInfo = actionOptions.find((a) => a.value === action.type);
  const Icon = actionInfo?.icon ?? MessageSquare;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-surface cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical size={14} className="text-text-muted cursor-grab" />
        <div className="w-7 h-7 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
          <Icon size={13} className="text-accent" />
        </div>
        <span className="flex-1 text-sm font-medium text-text-primary">
          {actionInfo?.label ?? action.type}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 text-text-muted hover:text-danger transition-colors rounded"
        >
          <Trash2 size={13} />
        </button>
        {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
      </div>

      {expanded && (
        <div className="p-4 space-y-3 border-t border-border bg-card">
          {action.type === 'send_message' && (
            <Textarea
              label="Mensagem"
              value={action.message ?? ''}
              onChange={(e) => onChange({ ...action, message: e.target.value })}
              placeholder="Digite a mensagem a ser enviada..."
              fullWidth
              hint="Use {{contact.name}} para o nome do contato"
            />
          )}

          {action.type === 'ai_reply' && (
            <>
              <Textarea
                label="Prompt do sistema (instrução para a IA)"
                value={action.aiSystemPrompt ?? ''}
                onChange={(e) => onChange({ ...action, aiSystemPrompt: e.target.value })}
                placeholder="Você é um assistente de atendimento. Responda no idioma do cliente..."
                fullWidth
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Modelo"
                  value={action.aiModel ?? 'gpt-4o-mini'}
                  onChange={(e) => onChange({ ...action, aiModel: e.target.value })}
                  options={[
                    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido)' },
                    { value: 'gpt-4o', label: 'GPT-4o (preciso)' },
                  ]}
                  fullWidth
                />
                <Input
                  label="Máx. tokens"
                  type="number"
                  value={action.aiMaxTokens ?? 300}
                  onChange={(e) => onChange({ ...action, aiMaxTokens: parseInt(e.target.value) })}
                  fullWidth
                />
              </div>
            </>
          )}

          {action.type === 'assign_agent' && (
            <Input
              label="UID do agente"
              value={action.agentUid ?? ''}
              onChange={(e) => onChange({ ...action, agentUid: e.target.value })}
              placeholder="UID do agente para atribuir"
              fullWidth
            />
          )}

          {action.type === 'change_status' && (
            <Select
              label="Novo status"
              value={action.status ?? 'open'}
              onChange={(e) => onChange({ ...action, status: e.target.value })}
              options={[
                { value: 'open', label: 'Aberta' },
                { value: 'pending', label: 'Pendente' },
                { value: 'resolved', label: 'Resolvida' },
              ]}
              fullWidth
            />
          )}

          {action.type === 'wait' && (
            <Input
              label="Aguardar (segundos)"
              type="number"
              value={action.waitSeconds ?? 60}
              onChange={(e) => onChange({ ...action, waitSeconds: parseInt(e.target.value) })}
              fullWidth
              hint="Mínimo: 1 segundo, máximo: 3600 segundos (1 hora)"
            />
          )}

          {action.type === 'webhook' && (
            <>
              <Input
                label="URL do webhook"
                type="url"
                value={action.webhookUrl ?? ''}
                onChange={(e) => onChange({ ...action, webhookUrl: e.target.value })}
                placeholder="https://seu-servidor.com/webhook"
                fullWidth
              />
              <Select
                label="Método"
                value={action.webhookMethod ?? 'POST'}
                onChange={(e) => onChange({ ...action, webhookMethod: e.target.value as 'GET' | 'POST' | 'PUT' })}
                options={[
                  { value: 'POST', label: 'POST' },
                  { value: 'GET', label: 'GET' },
                  { value: 'PUT', label: 'PUT' },
                ]}
                fullWidth
              />
            </>
          )}

          {action.type === 'notify_agent' && (
            <>
              <Input
                label="UID do agente"
                value={action.notifyAgentUid ?? ''}
                onChange={(e) => onChange({ ...action, notifyAgentUid: e.target.value })}
                placeholder="UID do agente a notificar"
                fullWidth
              />
              <Textarea
                label="Mensagem de notificação"
                value={action.notifyMessage ?? ''}
                onChange={(e) => onChange({ ...action, notifyMessage: e.target.value })}
                placeholder="Nova conversa atribuída a você..."
                fullWidth
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AutomationEditor({
  automation,
  onSave,
  onCancel,
  workspaceId,
  createdBy,
  loading,
}: AutomationEditorProps) {
  const [name, setName] = useState(automation?.name ?? '');
  const [description, setDescription] = useState(automation?.description ?? '');
  const [isActive, setIsActive] = useState(automation?.isActive ?? true);
  const [trigger, setTrigger] = useState<AutomationTrigger>(
    automation?.trigger ?? {
      type: 'new_message',
      conditions: [],
      channels: ['instagram', 'facebook', 'whatsapp'],
    }
  );
  const [actions, setActions] = useState<AutomationAction[]>(automation?.actions ?? []);
  const [saving, setSaving] = useState(false);

  const addAction = (type: AutomationActionType) => {
    const newAction: AutomationAction = {
      id: `action_${Date.now()}`,
      type,
      order: actions.length,
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (index: number, action: AutomationAction) => {
    const updated = [...actions];
    updated[index] = action;
    setActions(updated);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Digite um nome para a automação');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        workspaceId,
        name: name.trim(),
        description: description.trim(),
        isActive,
        trigger,
        actions,
        createdBy,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {automation?.id ? 'Editar Automação' : 'Nova Automação'}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Configure gatilho e ações para automatizar o atendimento
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Ativa</span>
            <button
              onClick={() => setIsActive(!isActive)}
              className={clsx(
                'w-10 h-5 rounded-full transition-colors relative',
                isActive ? 'bg-accent' : 'bg-muted'
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  isActive ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving || loading}>
            Salvar automação
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <Input
            label="Nome da automação"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Resposta automática fora do horário"
            fullWidth
          />
          <Input
            label="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o que esta automação faz..."
            fullWidth
          />
        </div>

        {/* Trigger */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Zap size={16} className="text-accent" />
            Gatilho
          </h3>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <Select
              label="Quando"
              value={trigger.type}
              onChange={(e) =>
                setTrigger({ ...trigger, type: e.target.value as AutomationTrigger['type'] })
              }
              options={triggerOptions}
              fullWidth
            />

            {/* Channel filter */}
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">
                Canais
              </label>
              <div className="flex gap-2">
                {['instagram', 'facebook', 'whatsapp'].map((ch) => (
                  <button
                    key={ch}
                    onClick={() => {
                      const channels = trigger.channels ?? ['instagram', 'facebook', 'whatsapp'];
                      const next = channels.includes(ch as 'instagram' | 'facebook' | 'whatsapp')
                        ? channels.filter((c) => c !== ch)
                        : [...channels, ch as 'instagram' | 'facebook' | 'whatsapp'];
                      setTrigger({ ...trigger, channels: next });
                    }}
                    className={clsx(
                      'flex-1 py-1.5 text-xs rounded-md border transition-colors capitalize',
                      trigger.channels?.includes(ch as 'instagram' | 'facebook' | 'whatsapp')
                        ? 'bg-accent-subtle text-accent border-accent/30'
                        : 'text-text-muted border-border hover:border-muted'
                    )}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Keyword condition */}
            {trigger.type === 'keyword_match' && (
              <Input
                label="Palavras-chave (separadas por vírgula)"
                placeholder="preço, valor, quanto custa"
                fullWidth
                hint="A automação será ativada quando qualquer palavra-chave for detectada"
              />
            )}

            {/* No reply delay */}
            {trigger.type === 'no_agent_reply' && (
              <Input
                label="Delay (minutos)"
                type="number"
                value={trigger.delayMinutes ?? 30}
                onChange={(e) =>
                  setTrigger({ ...trigger, delayMinutes: parseInt(e.target.value) })
                }
                fullWidth
                hint="Ativar após X minutos sem resposta do agente"
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-accent" />
            Ações
            <span className="text-xs text-text-muted font-normal">({actions.length} ação{actions.length !== 1 ? 'ões' : ''})</span>
          </h3>

          <div className="space-y-2 mb-4">
            {actions.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-6 text-center">
                <p className="text-sm text-text-muted">Adicione ações que serão executadas quando o gatilho for ativado</p>
              </div>
            ) : (
              actions.map((action, index) => (
                <ActionEditor
                  key={action.id}
                  action={action}
                  onChange={(updated) => updateAction(index, updated)}
                  onRemove={() => removeAction(index)}
                />
              ))
            )}
          </div>

          {/* Add Action */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-surface border-b border-border">
              <p className="text-xs text-text-muted font-medium">Adicionar ação</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-2">
              {actionOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => addAction(opt.value)}
                    className="flex items-center gap-2 p-2.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors text-left"
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="text-xs">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AutomationEditor;
