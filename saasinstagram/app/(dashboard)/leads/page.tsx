'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Download, Filter, Search, TrendingUp, Users, DollarSign, Trophy, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { LeadTable } from '@/components/leads/LeadTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Lead, LeadFilter } from '@/types/lead';
import { toast } from 'sonner';

export default function LeadsPage() {
  const { user } = useAuth();
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceId') : null;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadFilter>({});
  const [stats, setStats] = useState({ total: 0, new: 0, won: 0, lost: 0, totalValue: 0 });
  const [searchText, setSearchText] = useState('');
  const [showUnqualified, setShowUnqualified] = useState(false);

  // New lead modal
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadSource, setNewLeadSource] = useState<Lead['source']>('manual');
  const [savingLead, setSavingLead] = useState(false);

  // More filters panel
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [filterAssigned, setFilterAssigned] = useState('');
  const [filterMinValue, setFilterMinValue] = useState('');
  const [filterMaxValue, setFilterMaxValue] = useState('');
  const moreFiltersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMoreFilters) return;
    function handleClick(e: MouseEvent) {
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target as Node)) {
        setShowMoreFilters(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMoreFilters]);

  const loadLeads = () => {
    if (!workspaceId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const auth = getFirebaseAuth();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) { setLoading(false); return; }

    firebaseUser.getIdToken().then(async (idToken) => {
      const params = new URLSearchParams({ workspaceId });
      const res = await fetch(`/api/leads?${params}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json() as { leads: Lead[]; stats: typeof stats };

      let leadsData: Lead[] = data.leads ?? [];

      // Apply client-side filters
      const activeFilter: LeadFilter = {
        ...filter,
        search: searchText || undefined,
        minValue: filterMinValue ? Number(filterMinValue) : undefined,
        maxValue: filterMaxValue ? Number(filterMaxValue) : undefined,
        assignedTo: filterAssigned || undefined,
      };
      if (activeFilter.status && activeFilter.status !== 'all') {
        leadsData = leadsData.filter((l) => l.status === activeFilter.status);
      }
      if (activeFilter.source && activeFilter.source !== 'all') {
        leadsData = leadsData.filter((l) => l.source === activeFilter.source);
      }
      if (activeFilter.assignedTo) {
        leadsData = leadsData.filter((l) => l.assignedTo === activeFilter.assignedTo);
      }
      if (activeFilter.search) {
        const q = activeFilter.search.toLowerCase();
        leadsData = leadsData.filter(
          (l) =>
            l.name?.toLowerCase().includes(q) ||
            l.email?.toLowerCase().includes(q) ||
            l.phone?.toLowerCase().includes(q) ||
            l.company?.toLowerCase().includes(q)
        );
      }
      if (activeFilter.minValue !== undefined) {
        leadsData = leadsData.filter((l) => (l.dealValue ?? 0) >= activeFilter.minValue!);
      }
      if (activeFilter.maxValue !== undefined) {
        leadsData = leadsData.filter((l) => (l.dealValue ?? 0) <= activeFilter.maxValue!);
      }

      setLeads(leadsData.slice(0, 50));
      setStats(data.stats ?? stats);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLeads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, filter, user, searchText]);

  const handleExport = () => {
    if (leads.length === 0) {
      toast.info('Nenhum lead para exportar.');
      return;
    }
    const headers = ['Nome', 'Email', 'Telefone', 'Empresa', 'Status', 'Origem', 'Criado em'];
    const rows = leads.map((l) => [
      l.name,
      l.email ?? '',
      l.phone ?? '',
      l.company ?? '',
      l.status,
      l.source,
      new Date(l.createdAt).toLocaleDateString('pt-BR'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${leads.length} leads exportados.`);
  };

  const handleCreateLead = async () => {
    if (!newLeadName.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    if (!workspaceId) return;
    setSavingLead(true);
    try {
      const auth = getFirebaseAuth();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Não autenticado');
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        credentials: 'include',
        body: JSON.stringify({
          workspaceId,
          name: newLeadName.trim(),
          email: newLeadEmail.trim() || undefined,
          phone: newLeadPhone.trim() || undefined,
          company: newLeadCompany.trim() || undefined,
          source: newLeadSource,
          status: 'new',
        }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Lead criado com sucesso!');
      setShowNewLead(false);
      setNewLeadName('');
      setNewLeadEmail('');
      setNewLeadPhone('');
      setNewLeadCompany('');
      setNewLeadSource('manual');
      loadLeads();
    } catch {
      toast.error('Erro ao criar lead.');
    } finally {
      setSavingLead(false);
    }
  };

  const inputClass = 'w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Leads"
        subtitle={`${stats.total} leads no pipeline`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={handleExport}>
              Exportar
            </Button>
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowNewLead(true)}>
              Novo lead
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total de leads', value: stats.total, icon: Users, color: 'bg-accent' },
            { label: 'Novos', value: stats.new, icon: TrendingUp, color: 'bg-info' },
            { label: 'Ganhos', value: stats.won, icon: Trophy, color: 'bg-success' },
            {
              label: 'Valor total',
              value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(stats.totalValue),
              icon: DollarSign,
              color: 'bg-warning',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center shrink-0`}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">{stat.label}</p>
                    <p className="text-lg font-bold text-text-primary">{stat.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar leads..."
              className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <select
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-accent"
            onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value as LeadFilter['status'] }))}
          >
            <option value="all">Todos os status</option>
            <option value="new">Novo</option>
            <option value="contacted">Contatado</option>
            <option value="qualified">Qualificado</option>
            <option value="proposal">Proposta</option>
            <option value="negotiation">Negociação</option>
            <option value="won">Ganho</option>
            <option value="lost">Perdido</option>
          </select>

          <select
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-accent"
            onChange={(e) => setFilter((prev) => ({ ...prev, source: e.target.value as LeadFilter['source'] }))}
          >
            <option value="all">Todas as origens</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="manual">Manual</option>
          </select>

          <div ref={moreFiltersRef} className="relative">
            <Button
              variant={showMoreFilters ? 'secondary' : 'ghost'}
              size="sm"
              leftIcon={<Filter size={14} />}
              onClick={() => setShowMoreFilters((v) => !v)}
            >
              Mais filtros
            </Button>
            {showMoreFilters && (
              <div className="absolute left-0 top-full mt-2 bg-card border border-border rounded-xl shadow-2xl z-30 p-4 w-64 space-y-3">
                <p className="text-xs font-semibold text-text-primary">Filtros avançados</p>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Atribuído a (UID)</label>
                  <input
                    type="text"
                    value={filterAssigned}
                    onChange={(e) => setFilterAssigned(e.target.value)}
                    placeholder="UID do agente"
                    className={inputClass}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-text-muted block mb-1">Valor mín.</label>
                    <input type="number" value={filterMinValue} onChange={(e) => setFilterMinValue(e.target.value)} placeholder="0" className={inputClass} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-text-muted block mb-1">Valor máx.</label>
                    <input type="number" value={filterMaxValue} onChange={(e) => setFilterMaxValue(e.target.value)} placeholder="∞" className={inputClass} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => { loadLeads(); setShowMoreFilters(false); }}>Aplicar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setFilterAssigned(''); setFilterMinValue(''); setFilterMaxValue(''); loadLeads(); }}>Limpar</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setShowUnqualified((v) => !v)}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1"
          >
            <span>{showUnqualified ? '⬛' : '⬜'}</span>
            {showUnqualified ? 'Ocultar não qualificados' : 'Mostrar não qualificados'}
          </button>
          <p className="text-xs text-text-muted">
            🔥 ≥ 70 pts &nbsp;🟡 30–69 pts
          </p>
        </div>
        <LeadTable
          leads={showUnqualified ? leads : leads.filter((l) => l.status !== 'unqualified')}
          loading={loading}
          onLeadClick={(lead) => console.log('Lead clicked:', lead.id)}
          onStatusChange={(id, status) => console.log('Status change:', id, status)}
        />
      </div>

      {/* New Lead Modal */}
      {showNewLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowNewLead(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Novo lead</h2>
              <button onClick={() => setShowNewLead(false)} className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">Nome *</label>
                <input
                  type="text"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="Nome completo"
                  autoFocus
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Email</label>
                <input type="email" value={newLeadEmail} onChange={(e) => setNewLeadEmail(e.target.value)} placeholder="email@exemplo.com" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Telefone</label>
                <input type="tel" value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} placeholder="+55 11 99999-9999" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Empresa</label>
                <input type="text" value={newLeadCompany} onChange={(e) => setNewLeadCompany(e.target.value)} placeholder="Nome da empresa" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Origem</label>
                <select value={newLeadSource} onChange={(e) => setNewLeadSource(e.target.value as Lead['source'])} className={inputClass}>
                  <option value="manual">Manual</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="import">Importação</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <Button variant="secondary" className="flex-1" onClick={() => setShowNewLead(false)}>Cancelar</Button>
              <Button className="flex-1" loading={savingLead} onClick={handleCreateLead}>Criar lead</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
