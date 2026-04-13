'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Send, X, ChevronRight, MessageSquare, Clock,
  CheckCircle, AlertCircle, Ticket, RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@/types/support';

async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

const STATUS_CONFIG: Record<SupportTicketStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'default'; icon: React.ReactNode }> = {
  open: { label: 'Aberto', variant: 'info', icon: <AlertCircle size={12} /> },
  in_progress: { label: 'Em andamento', variant: 'warning', icon: <Clock size={12} /> },
  resolved: { label: 'Resolvido', variant: 'success', icon: <CheckCircle size={12} /> },
  closed: { label: 'Fechado', variant: 'default', icon: <X size={12} /> },
};

const PRIORITY_CONFIG: Record<SupportTicketPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'text-text-muted' },
  medium: { label: 'Média', color: 'text-info' },
  high: { label: 'Alta', color: 'text-warning' },
  urgent: { label: 'Urgente', color: 'text-danger' },
};

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  billing: 'Faturamento',
  technical: 'Técnico',
  feature_request: 'Sugestão',
  general: 'Geral',
};

export default function SupportPage() {
  const { user } = useAuth();
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceId') : null;

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // New ticket modal
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState<SupportTicketCategory>('general');
  const [newPriority, setNewPriority] = useState<SupportTicketPriority>('medium');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadTickets = async () => {
    if (!workspaceId || !user) { setLoading(false); return; }
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/support?workspaceId=${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { tickets: SupportTicket[] };
        setTickets(data.tickets);
        // Sync selected ticket if open
        if (selectedTicket) {
          const updated = data.tickets.find((t) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTickets(); }, [workspaceId, user]);

  useEffect(() => {
    if (selectedTicket && threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages.length]);

  const handleCreate = async () => {
    if (!workspaceId || !newSubject.trim() || !newMessage.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setCreating(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({
          workspaceId,
          subject: newSubject.trim(),
          category: newCategory,
          priority: newPriority,
          message: newMessage.trim(),
        }),
      });
      if (!res.ok) {
        toast.error('Erro ao criar ticket');
        return;
      }
      const data = await res.json() as { ticket: SupportTicket };
      setTickets((prev) => [data.ticket, ...prev]);
      setSelectedTicket(data.ticket);
      setShowNew(false);
      setNewSubject('');
      setNewMessage('');
      setNewCategory('general');
      setNewPriority('medium');
      toast.success('Ticket criado com sucesso');
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (!res.ok) {
        toast.error('Erro ao enviar mensagem');
        return;
      }
      setReplyText('');
      await loadTickets();
    } finally {
      setSendingReply(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleReply();
    }
  };

  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Suporte"
        subtitle={openCount > 0 ? `${openCount} ticket${openCount > 1 ? 's' : ''} em aberto` : 'Central de suporte'}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Ticket list panel */}
        <div className={clsx(
          'flex flex-col border-r border-border shrink-0 overflow-hidden',
          selectedTicket ? 'w-[320px]' : 'flex-1'
        )}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-medium text-text-secondary">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={loadTickets}
                className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                title="Atualizar"
              >
                <RefreshCw size={14} />
              </button>
              <Button size="sm" leftIcon={<Plus size={13} />} onClick={() => setShowNew(true)}>
                Novo ticket
              </Button>
            </div>
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-surface rounded-lg animate-pulse" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Ticket size={32} className="text-text-muted mb-3 opacity-50" />
                <p className="text-sm text-text-muted">Nenhum ticket ainda</p>
                <p className="text-xs text-text-muted mt-1 mb-4">Abra um ticket para obter ajuda</p>
                <Button size="sm" leftIcon={<Plus size={13} />} onClick={() => setShowNew(true)}>
                  Abrir ticket
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tickets.map((ticket) => {
                  const statusConf = STATUS_CONFIG[ticket.status];
                  const priConf = PRIORITY_CONFIG[ticket.priority];
                  const isSelected = selectedTicket?.id === ticket.id;

                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={clsx(
                        'w-full text-left px-4 py-3.5 hover:bg-surface transition-colors',
                        isSelected && 'bg-accent-subtle border-l-2 border-accent'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-sm font-medium text-text-primary truncate flex-1">
                          {ticket.subject}
                        </span>
                        <ChevronRight size={14} className="text-text-muted shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={statusConf.variant} size="xs">
                          {statusConf.label}
                        </Badge>
                        <span className={clsx('text-xs font-medium', priConf.color)}>
                          {priConf.label}
                        </span>
                        <span className="text-xs text-text-muted">
                          {CATEGORY_LABELS[ticket.category]}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1.5">
                        {new Date(ticket.updatedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Thread view */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Thread header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-text-primary truncate">
                    {selectedTicket.subject}
                  </h2>
                  <Badge variant={STATUS_CONFIG[selectedTicket.status].variant} size="xs">
                    {STATUS_CONFIG[selectedTicket.status].label}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {CATEGORY_LABELS[selectedTicket.category]} · Prioridade{' '}
                  <span className={PRIORITY_CONFIG[selectedTicket.priority].color}>
                    {PRIORITY_CONFIG[selectedTicket.priority].label}
                  </span>
                  {' · '}Aberto em{' '}
                  {new Date(selectedTicket.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors ml-2 shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {selectedTicket.messages.map((msg) => {
                const isUser = msg.senderType === 'user';
                return (
                  <div key={msg.id} className={clsx('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
                        <MessageSquare size={13} className="text-accent" />
                      </div>
                    )}
                    <div className={clsx(
                      'max-w-[70%] rounded-xl px-4 py-2.5',
                      isUser
                        ? 'bg-accent text-white rounded-tr-sm'
                        : 'bg-surface text-text-primary rounded-tl-sm border border-border'
                    )}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                      <p className={clsx(
                        'text-xs mt-1',
                        isUser ? 'text-white/60' : 'text-text-muted'
                      )}>
                        {msg.senderName} · {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {isUser && (
                      <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-text-secondary">
                          {(msg.senderName[0] ?? 'U').toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            {/* Reply box */}
            {selectedTicket.status !== 'closed' ? (
              <div className="border-t border-border px-5 py-3 shrink-0">
                <div className="flex gap-3 items-end">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escreva sua mensagem... (Ctrl+Enter para enviar)"
                    rows={3}
                    className={clsx(
                      'flex-1 bg-white border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary',
                      'placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50 transition-colors'
                    )}
                  />
                  <Button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sendingReply}
                    loading={sendingReply}
                    leftIcon={<Send size={13} />}
                    className="shrink-0"
                  >
                    Enviar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t border-border px-5 py-3 text-center shrink-0">
                <p className="text-xs text-text-muted">Este ticket está fechado.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 hidden lg:flex">
            <MessageSquare size={40} className="text-text-muted mb-3 opacity-30" />
            <p className="text-sm text-text-muted">Selecione um ticket para ver a conversa</p>
          </div>
        )}
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-text-primary">Abrir ticket de suporte</h2>
              <button onClick={() => setShowNew(false)} className="text-text-muted hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Assunto *</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Ex: Problema com integração do WhatsApp"
                  className="w-full bg-white border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Categoria</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as SupportTicketCategory)}
                    className="w-full bg-white border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                  >
                    <option value="general">Geral</option>
                    <option value="technical">Técnico</option>
                    <option value="billing">Faturamento</option>
                    <option value="feature_request">Sugestão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Prioridade</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as SupportTicketPriority)}
                    className="w-full bg-white border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Descreva o problema *</label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Descreva em detalhes o que está acontecendo, incluindo passos para reproduzir o problema..."
                  rows={5}
                  className="w-full bg-white border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <Button variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button
                onClick={handleCreate}
                loading={creating}
                disabled={!newSubject.trim() || !newMessage.trim()}
                leftIcon={<Send size={13} />}
              >
                Abrir ticket
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
