'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Plus, Trash2, Edit2, Brain, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

interface BlockDisplay {
  id: string;
  name: string;
  content: string;
  triggers: string[];
  isActive: boolean;
  priority: number;
  category?: string;
  hasEmbedding: boolean;
  createdAt: string;
}

interface BlockFormState {
  name: string;
  content: string;
  triggerInput: string;
  triggers: string[];
  category: string;
  priority: number;
  isActive: boolean;
}

const emptyForm = (): BlockFormState => ({
  name: '',
  content: '',
  triggerInput: '',
  triggers: [],
  category: '',
  priority: 10,
  isActive: true,
});

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

export function KnowledgeBlocksPanel({ workspaceId }: { workspaceId: string }) {
  const [blocks, setBlocks] = useState<BlockDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlockFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadBlocks = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await apiCall(`/api/knowledge-blocks?workspaceId=${workspaceId}`);
      setBlocks((data.blocks as BlockDisplay[]) ?? []);
    } catch {
      toast.error('Erro ao carregar blocos de conhecimento');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const handleAddTrigger = () => {
    const t = form.triggerInput.trim().toLowerCase();
    if (!t || form.triggers.includes(t)) return;
    setForm((prev) => ({ ...prev, triggers: [...prev.triggers, t], triggerInput: '' }));
  };

  const handleRemoveTrigger = (trigger: string) => {
    setForm((prev) => ({ ...prev, triggers: prev.triggers.filter((t) => t !== trigger) }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error('Nome e conteúdo são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        workspaceId,
        name: form.name.trim(),
        content: form.content.trim(),
        triggers: form.triggers,
        category: form.category.trim() || undefined,
        priority: form.priority,
        isActive: form.isActive,
      };

      if (editingId) {
        await apiCall(`/api/knowledge-blocks/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Bloco atualizado');
      } else {
        await apiCall('/api/knowledge-blocks', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Bloco criado — embedding gerado automaticamente');
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      await loadBlocks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (block: BlockDisplay) => {
    setForm({
      name: block.name,
      content: block.content,
      triggers: block.triggers,
      triggerInput: '',
      category: block.category ?? '',
      priority: block.priority,
      isActive: block.isActive,
    });
    setEditingId(block.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este bloco de conhecimento?')) return;
    try {
      await apiCall(`/api/knowledge-blocks/${id}`, { method: 'DELETE' });
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      toast.success('Bloco excluído');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleToggleActive = async (block: BlockDisplay) => {
    try {
      await apiCall(`/api/knowledge-blocks/${block.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !block.isActive }),
      });
      setBlocks((prev) =>
        prev.map((b) => b.id === block.id ? { ...b, isActive: !b.isActive } : b)
      );
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Brain size={16} className="text-accent" />
            Knowledge Base
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Blocos de conhecimento injetados automaticamente no contexto da IA com base na mensagem recebida.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            Novo bloco
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-text-primary">
            {editingId ? 'Editar bloco' : 'Novo bloco de conhecimento'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nome do bloco"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="ex: Tabela de Preços"
              fullWidth
            />
            <Input
              label="Categoria (opcional)"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="ex: Vendas, Suporte"
              fullWidth
            />
          </div>

          <Textarea
            label="Conteúdo do conhecimento"
            value={form.content}
            onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="Descreva os produtos, preços, políticas ou qualquer informação que a IA deve usar..."
            fullWidth
            hint="Este texto será injetado no prompt quando a IA detectar que é relevante para a conversa."
          />

          {/* Triggers */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Palavras-chave (triggers)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={form.triggerInput}
                onChange={(e) => setForm((prev) => ({ ...prev, triggerInput: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTrigger();
                  }
                }}
                placeholder="Digite e pressione Enter"
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60"
              />
              <Button size="sm" variant="secondary" onClick={handleAddTrigger}>
                <Plus size={14} />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.triggers.map((trigger) => (
                <span
                  key={trigger}
                  className="flex items-center gap-1 text-xs bg-accent-subtle text-accent px-2 py-0.5 rounded-full"
                >
                  {trigger}
                  <button onClick={() => handleRemoveTrigger(trigger)} className="hover:text-danger">
                    <X size={10} />
                  </button>
                </span>
              ))}
              {form.triggers.length === 0 && (
                <span className="text-xs text-text-muted">
                  Sem triggers — usará apenas similaridade semântica
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <button
                  onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={clsx(
                    'w-8 h-4 rounded-full transition-colors relative shrink-0',
                    form.isActive ? 'bg-accent' : 'bg-muted'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform',
                      form.isActive ? 'translate-x-[16px]' : 'translate-x-0'
                    )}
                  />
                </button>
                Ativo
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} loading={saving}>
                {editingId ? 'Salvar alterações' : 'Criar bloco'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Blocks list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-card border border-border rounded-xl h-16" />
          ))}
        </div>
      ) : blocks.length === 0 && !showForm ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <Brain size={32} className="text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-text-primary mb-1">Nenhum bloco criado</p>
          <p className="text-xs text-text-muted mb-4 max-w-xs mx-auto">
            Crie blocos de conhecimento para que a IA use informações específicas da sua empresa nas respostas.
          </p>
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            Criar primeiro bloco
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((block) => (
            <div
              key={block.id}
              className={clsx(
                'bg-card border rounded-xl overflow-hidden transition-all',
                block.isActive ? 'border-border' : 'border-border opacity-60'
              )}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Active toggle */}
                <button
                  onClick={() => handleToggleActive(block)}
                  className={clsx(
                    'w-8 h-4 rounded-full transition-colors relative shrink-0',
                    block.isActive ? 'bg-accent' : 'bg-muted'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform',
                      block.isActive ? 'translate-x-[16px]' : 'translate-x-0'
                    )}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary">{block.name}</span>
                    {block.category && (
                      <Badge variant="default" size="xs">{block.category}</Badge>
                    )}
                    {block.hasEmbedding && (
                      <span className="flex items-center gap-0.5 text-[10px] text-success">
                        <Check size={10} /> embedding
                      </span>
                    )}
                  </div>
                  {block.triggers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {block.triggers.slice(0, 5).map((t) => (
                        <span key={t} className="text-[10px] bg-surface text-text-muted px-1.5 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                      {block.triggers.length > 5 && (
                        <span className="text-[10px] text-text-muted">+{block.triggers.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedId(expandedId === block.id ? null : block.id)}
                    className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
                  >
                    {expandedId === block.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    onClick={() => handleEdit(block)}
                    className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(block.id)}
                    className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-red-950 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded content preview */}
              {expandedId === block.id && (
                <div className="px-4 pb-4 border-t border-border">
                  <p className="text-xs text-text-muted mt-3 whitespace-pre-wrap line-clamp-6">
                    {block.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
