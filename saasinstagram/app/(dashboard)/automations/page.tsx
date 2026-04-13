'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Plus, Zap, Play, Pause, Trash2, Edit2, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Header } from '@/components/layout/Header';
import { AutomationEditor } from '@/components/automations/AutomationEditor';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getFirebaseAuth } from '@/lib/firebase/client';
import type { Automation } from '@/types/automation';
import { toast } from 'sonner';

const triggerLabels: Record<string, string> = {
  new_conversation: 'Nova conversa',
  new_message: 'Nova mensagem',
  keyword_match: 'Palavra-chave',
  conversation_assigned: 'Conversa atribuída',
  conversation_resolved: 'Conversa resolvida',
  no_agent_reply: 'Sem resposta do agente',
  outside_business_hours: 'Fora do horário',
};

const actionLabels: Record<string, string> = {
  send_message: 'Enviar mensagem',
  ai_reply: 'Responder com IA',
  assign_agent: 'Atribuir agente',
  add_tag: 'Adicionar etiqueta',
  change_status: 'Mudar status',
  send_email: 'Enviar e-mail',
  webhook: 'Webhook',
};

async function apiCall(path: string, options: RequestInit = {}) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Não autenticado');
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Erro na API');
  return data;
}

export default function AutomationsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUid, setCurrentUid] = useState<string>('');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('currentWorkspaceId');
    if (id) setWorkspaceId(id);
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (u) setCurrentUid(u.uid);
  }, []);

  const loadAutomations = useCallback(async (wsId?: string) => {
    const id = wsId ?? workspaceId;
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiCall(`/api/automations?workspaceId=${id}`);
      setAutomations((data.automations as Automation[]) ?? []);
    } catch {
      toast.error('Erro ao carregar automações');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  const handleToggle = async (automation: Automation) => {
    try {
      await apiCall(`/api/automations/${automation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !automation.isActive }),
      });
      setAutomations((prev) =>
        prev.map((a) => a.id === automation.id ? { ...a, isActive: !a.isActive } : a)
      );
      toast.success(`Automação ${!automation.isActive ? 'ativada' : 'desativada'}`);
    } catch {
      toast.error('Erro ao atualizar automação');
    }
  };

  const handleDelete = async (automationId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return;
    try {
      await apiCall(`/api/automations/${automationId}`, { method: 'DELETE' });
      setAutomations((prev) => prev.filter((a) => a.id !== automationId));
      toast.success('Automação excluída');
    } catch {
      toast.error('Erro ao excluir automação');
    }
  };

  const handleSave = async (automationData: Omit<Automation, 'id' | 'stats' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingAutomation) {
        await apiCall(`/api/automations/${editingAutomation.id}`, {
          method: 'PATCH',
          body: JSON.stringify(automationData),
        });
        toast.success('Automação atualizada');
      } else {
        await apiCall('/api/automations', {
          method: 'POST',
          body: JSON.stringify({
            ...automationData,
            stats: { totalTriggered: 0, totalActionsExecuted: 0 },
          }),
        });
        toast.success('Automação criada');
      }
      setShowEditor(false);
      setEditingAutomation(null);
      loadAutomations().catch(() => {/* silent — save already succeeded */});
    } catch {
      toast.error('Erro ao salvar automação');
    }
  };

  if (showEditor) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <AutomationEditor
          automation={editingAutomation ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditingAutomation(null); }}
          workspaceId={workspaceId ?? ''}
          createdBy={currentUid}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Automações"
        subtitle={`${automations.filter((a) => a.isActive).length} ativas`}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => { setEditingAutomation(null); setShowEditor(true); }}
          >
            Nova automação
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-card border border-border rounded-xl p-4 h-24" />
            ))}
          </div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-subtle flex items-center justify-center mb-4">
              <Zap size={28} className="text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Nenhuma automação criada
            </h3>
            <p className="text-sm text-text-muted mb-6 max-w-sm">
              Crie automações para responder automaticamente, atribuir agentes e muito mais.
            </p>
            <Button leftIcon={<Plus size={14} />} onClick={() => setShowEditor(true)}>
              Criar primeira automação
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map((automation) => (
              <div
                key={automation.id}
                className={clsx(
                  'bg-card border rounded-xl p-4 transition-all',
                  automation.isActive ? 'border-border hover:border-muted' : 'border-border opacity-60'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Icon */}
                    <div className={clsx(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      automation.isActive ? 'bg-accent-subtle' : 'bg-muted/30'
                    )}>
                      <Zap size={16} className={automation.isActive ? 'text-accent' : 'text-text-muted'} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-text-primary">{automation.name}</h3>
                        <Badge variant={automation.isActive ? 'success' : 'default'} size="xs" dot>
                          {automation.isActive ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      {automation.description && (
                        <p className="text-xs text-text-muted mt-0.5">{automation.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-text-muted">
                          Gatilho: <span className="text-text-secondary">{triggerLabels[automation.trigger.type] ?? automation.trigger.type}</span>
                        </span>
                        <span className="text-xs text-text-muted">
                          {automation.actions.length} ação{automation.actions.length !== 1 ? 'ões' : ''}
                        </span>
                        {automation.stats?.lastTriggeredAt && (
                          <span className="text-xs text-text-muted">
                            Último disparo: {format(new Date(automation.stats.lastTriggeredAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-text-muted mr-2">
                      <BarChart2 size={12} />
                      <span>{automation.stats?.totalTriggered ?? 0} disparos</span>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(automation)}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        automation.isActive
                          ? 'text-success hover:bg-success/10'
                          : 'text-text-muted hover:text-success hover:bg-success/10'
                      )}
                      title={automation.isActive ? 'Desativar' : 'Ativar'}
                    >
                      {automation.isActive ? <Pause size={14} /> : <Play size={14} />}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => { setEditingAutomation(automation); setShowEditor(true); }}
                      className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(automation.id)}
                      className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-red-950 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Action chips */}
                {automation.actions.length > 0 && (
                  <div className="flex gap-1.5 mt-3 ml-12 flex-wrap">
                    {automation.actions.slice(0, 4).map((action, i) => (
                      <span key={action.id} className="text-xs bg-surface text-text-muted px-2 py-0.5 rounded-md">
                        {i + 1}. {actionLabels[action.type] ?? action.type.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {automation.actions.length > 4 && (
                      <span className="text-xs text-text-muted px-2 py-0.5">
                        +{automation.actions.length - 4} mais
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
