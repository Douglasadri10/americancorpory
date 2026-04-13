'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Instagram,
  Facebook,
  MessageCircle,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  User,
  TrendingUp,
} from 'lucide-react';
import type { Lead, LeadStatus } from '@/types/lead';
import { Badge } from '@/components/ui/Badge';

interface LeadTableProps {
  leads: Lead[];
  loading?: boolean;
  onLeadClick?: (lead: Lead) => void;
  onStatusChange?: (leadId: string, status: LeadStatus) => void;
}

type SortField = 'name' | 'status' | 'source' | 'dealValue' | 'createdAt';
type SortDir = 'asc' | 'desc';

const statusConfig: Record<LeadStatus, { label: string; badge: string }> = {
  new: { label: 'Novo', badge: 'info' },
  contacted: { label: 'Contatado', badge: 'primary' },
  qualified: { label: 'Qualificado', badge: 'warning' },
  proposal: { label: 'Proposta', badge: 'warning' },
  negotiation: { label: 'Negociação', badge: 'warning' },
  won: { label: 'Ganho', badge: 'success' },
  lost: { label: 'Perdido', badge: 'danger' },
  unqualified: { label: 'Não qualificado', badge: 'default' },
};

const sourceIcons = {
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: MessageCircle,
  manual: User,
  import: TrendingUp,
  api: TrendingUp,
};

const sourceColors = {
  instagram: 'text-instagram',
  facebook: 'text-facebook',
  whatsapp: 'text-whatsapp',
  manual: 'text-text-muted',
  import: 'text-text-muted',
  api: 'text-text-muted',
};

export function LeadTable({ leads, loading, onLeadClick, onStatusChange }: LeadTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedLeads = [...leads].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'source':
        comparison = a.source.localeCompare(b.source);
        break;
      case 'dealValue':
        comparison = (a.dealValue ?? 0) - (b.dealValue ?? 0);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return sortDir === 'asc' ? comparison : -comparison;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp size={12} className="text-accent" />
    ) : (
      <ChevronDown size={12} className="text-accent" />
    );
  };

  const ThButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
    >
      {children}
      <SortIcon field={field} />
    </button>
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-accent-subtle border-b border-accent/30 px-4 py-2 flex items-center gap-3">
          <span className="text-xs text-accent font-medium">
            {selectedIds.size} selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface transition-colors">
              Atribuir
            </button>
            <button className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface transition-colors">
              Mudar status
            </button>
            <button className="text-xs text-danger hover:text-red-400 px-2 py-1 rounded hover:bg-red-950 transition-colors">
              Excluir
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-border bg-transparent"
                />
              </th>
              <th className="px-4 py-3 text-left">
                <ThButton field="name">Nome</ThButton>
              </th>
              <th className="px-4 py-3 text-left">
                <ThButton field="status">Status</ThButton>
              </th>
              <th className="px-4 py-3 text-left">
                <ThButton field="source">Origem</ThButton>
              </th>
              <th className="px-4 py-3 text-left hidden md:table-cell">
                <span className="text-xs font-medium text-text-muted">Atribuído</span>
              </th>
              <th className="px-4 py-3 text-left hidden lg:table-cell">
                <ThButton field="dealValue">Valor</ThButton>
              </th>
              <th className="px-4 py-3 text-left hidden lg:table-cell">
                <ThButton field="createdAt">Criado em</ThButton>
              </th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="w-4 h-4 bg-muted rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted" />
                      <div className="space-y-1.5">
                        <div className="h-3 bg-muted rounded w-24" />
                        <div className="h-2.5 bg-muted rounded w-16" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-5 bg-muted rounded w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-muted rounded w-16" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="h-3 bg-muted rounded w-20" />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-3 bg-muted rounded w-16" />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-3 bg-muted rounded w-20" />
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : sortedLeads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-text-muted">
                  Nenhum lead encontrado
                </td>
              </tr>
            ) : (
              sortedLeads.map((lead) => {
                const status = statusConfig[lead.status];
                const SourceIcon = sourceIcons[lead.source] ?? User;
                const sourceColor = sourceColors[lead.source] ?? 'text-text-muted';

                return (
                  <tr
                    key={lead.id}
                    className={clsx(
                      'transition-colors hover:bg-surface',
                      selectedIds.has(lead.id) && 'bg-accent-subtle/30'
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onLeadClick?.(lead)}
                        className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center overflow-hidden shrink-0">
                          {lead.avatarURL ? (
                            <img src={lead.avatarURL} alt={lead.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-medium text-text-secondary">
                              {lead.name[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-text-primary truncate">{lead.name}</p>
                            {lead.score !== undefined && lead.score >= 70 && (
                              <span className="text-xs" title={`Score: ${lead.score}`}>🔥</span>
                            )}
                            {lead.score !== undefined && lead.score >= 30 && lead.score < 70 && (
                              <span className="text-xs" title={`Score: ${lead.score}`}>🟡</span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted truncate">
                            {lead.email ?? lead.phone ?? lead.company ?? '-'}
                          </p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={status.badge as 'success' | 'danger' | 'warning' | 'info' | 'default' | 'primary'} size="xs">
                        {status.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <SourceIcon size={13} className={sourceColor} />
                        <span className="text-xs text-text-secondary capitalize">{lead.source}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-text-secondary">
                        {lead.assignedToName ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-text-secondary">
                        {lead.dealValue
                          ? new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: lead.currency ?? 'BRL',
                            }).format(lead.dealValue)
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-text-muted">
                        {format(new Date(lead.createdAt), 'dd/MM/yy', { locale: ptBR })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === lead.id ? null : lead.id);
                          }}
                          className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface transition-colors"
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {openMenuId === lead.id && (
                          <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-modal w-40 z-10 py-1">
                            <button
                              onClick={() => { onLeadClick?.(lead); setOpenMenuId(null); }}
                              className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                            >
                              Ver detalhes
                            </button>
                            <button className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:bg-surface hover:text-text-primary transition-colors">
                              Editar
                            </button>
                            <hr className="border-border my-1" />
                            <button className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-red-950 transition-colors">
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LeadTable;
