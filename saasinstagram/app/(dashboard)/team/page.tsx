'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { UserPlus, MoreHorizontal, Crown, Shield, Headphones, Eye, Mail, type LucideIcon } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import type { WorkspaceMember, WorkspaceMemberRole } from '@/types/workspace';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const roleConfig: Record<WorkspaceMemberRole, { label: string; icon: LucideIcon; color: string }> = {
  owner: { label: 'Proprietário', icon: Crown, color: 'text-warning' },
  admin: { label: 'Admin', icon: Shield, color: 'text-info' },
  agent: { label: 'Agente', icon: Headphones, color: 'text-success' },
  viewer: { label: 'Visualizador', icon: Eye, color: 'text-text-muted' },
};

export default function TeamPage() {
  const { user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('agent');
  const [sending, setSending] = useState(false);

  // Mock members for demo
  const members: WorkspaceMember[] = [
    {
      uid: user?.uid ?? 'owner',
      email: user?.email ?? 'owner@example.com',
      displayName: user?.displayName ?? 'Proprietário',
      photoURL: user?.photoURL ?? undefined,
      role: 'owner',
      joinedAt: new Date().toISOString(),
      isActive: true,
    },
  ];

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      // In production, call API to send invite
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`Convite enviado para ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteModal(false);
    } catch {
      toast.error('Erro ao enviar convite');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Equipe"
        subtitle={`${members.length} membro${members.length !== 1 ? 's' : ''}`}
        actions={
          <Button
            size="sm"
            leftIcon={<UserPlus size={14} />}
            onClick={() => setShowInviteModal(true)}
          >
            Convidar membro
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Members list */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Membros ativos</h2>
          </div>

          <div className="divide-y divide-border/50">
            {members.map((member) => {
              const role = roleConfig[member.role];
              const RoleIcon = role.icon;

              return (
                <div key={member.uid} className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center overflow-hidden shrink-0">
                    {member.photoURL ? (
                      <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-text-secondary">
                        {member.displayName[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary truncate">{member.displayName}</p>
                      {member.uid === user?.uid && (
                        <span className="text-xs text-text-muted">(você)</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate">{member.email}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <RoleIcon size={13} className={role.color} />
                      <span className={clsx('text-xs font-medium', role.color)}>{role.label}</span>
                    </div>

                    <Badge variant={member.isActive ? 'success' : 'default'} size="xs" dot>
                      {member.isActive ? 'Online' : 'Offline'}
                    </Badge>

                    {member.uid !== user?.uid && (
                      <button className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors">
                        <MoreHorizontal size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Roles explanation */}
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Permissões por papel</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(roleConfig).map(([key, config]) => {
              const Icon = config.icon;
              const permissions: Record<string, string[]> = {
                owner: ['Acesso total', 'Faturamento', 'Excluir workspace'],
                admin: ['Gerenciar equipe', 'Configurar canais', 'Ver relatórios'],
                agent: ['Atender conversas', 'Gerenciar leads', 'Ver automações'],
                viewer: ['Visualizar conversas', 'Ver relatórios'],
              };

              return (
                <div key={key} className="bg-surface border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className={config.color} />
                    <span className={clsx('text-xs font-semibold', config.color)}>{config.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {permissions[key].map((perm) => (
                      <li key={perm} className="text-xs text-text-muted flex items-center gap-1">
                        <span className="w-1 h-1 bg-text-muted rounded-full shrink-0" />
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-modal animate-fade-in">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Convidar membro</h2>
            <p className="text-sm text-text-muted mb-5">
              O membro receberá um email com o convite para participar do workspace.
            </p>

            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="membro@empresa.com"
                leftIcon={<Mail size={14} />}
                fullWidth
                autoFocus
              />

              <div>
                <label className="text-sm font-medium text-text-secondary block mb-2">Papel</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['agent', 'admin', 'viewer'] as WorkspaceMemberRole[]).map((role) => {
                    const config = roleConfig[role];
                    const RoleIcon = config.icon;
                    return (
                      <button
                        key={role}
                        onClick={() => setInviteRole(role)}
                        className={clsx(
                          'flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors',
                          inviteRole === role
                            ? 'bg-accent-subtle border-accent/30'
                            : 'border-border hover:border-muted'
                        )}
                      >
                        <RoleIcon size={14} className={inviteRole === role ? 'text-accent' : config.color} />
                        <span className={clsx('text-xs font-medium', inviteRole === role ? 'text-accent' : 'text-text-secondary')}>
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => { setShowInviteModal(false); setInviteEmail(''); }}
                disabled={sending}
              >
                Cancelar
              </Button>
              <Button
                fullWidth
                onClick={handleInvite}
                loading={sending}
                disabled={!inviteEmail.trim()}
              >
                Enviar convite
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
