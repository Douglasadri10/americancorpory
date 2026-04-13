'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Zap,
  Link2,
  CreditCard,
  Settings,
  LogOut,
  Bell,
  ScrollText,
  CalendarDays,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';

interface NavItem {
  labelPt: string;
  labelEn: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { labelPt: 'Visão Geral', labelEn: 'Overview', href: '/overview', icon: LayoutDashboard },
  { labelPt: 'Inbox', labelEn: 'Inbox', href: '/inbox', icon: MessageSquare },
  { labelPt: 'Leads', labelEn: 'Leads', href: '/leads', icon: Users },
  { labelPt: 'Agenda', labelEn: 'Schedule', href: '/schedule', icon: CalendarDays },
  { labelPt: 'Automações', labelEn: 'Automations', href: '/automations', icon: Zap },
  { labelPt: 'Canais', labelEn: 'Channels', href: '/channels', icon: Link2 },
  { labelPt: 'Faturamento', labelEn: 'Billing', href: '/billing', icon: CreditCard },
  { labelPt: 'Suporte', labelEn: 'Support', href: '/support', icon: LifeBuoy },
  { labelPt: 'Configurações', labelEn: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { workspace, isEnglish } = useWorkspaceLocale();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <aside
      className={clsx(
        'relative hidden lg:flex lg:flex-col h-screen bg-sidebar border-r border-border shrink-0 transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[224px]'
      )}
    >
      {/* Workspace header */}
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-5 border-b border-border min-h-[64px]',
          collapsed && 'justify-center px-0'
        )}
      >
        <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-accent-subtle">
          <Image
            src="/logo.png"
            alt="HannaAI"
            width={28}
            height={28}
            className="w-full h-full object-cover"
          />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate leading-tight">
              {workspace?.name ?? 'HannaAI'}
            </p>
            <p className="text-xs text-text-muted truncate capitalize mt-0.5">
              {workspace?.plan?.id ?? 'starter'}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? (isEnglish ? item.labelEn : item.labelPt) : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-100 group relative',
                active
                  ? 'bg-accent-subtle text-accent font-medium'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary',
                collapsed && 'justify-center px-0 w-10 mx-auto'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full" />
              )}
              <Icon
                size={17}
                className={clsx(
                  'shrink-0',
                  active ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'
                )}
              />
              {!collapsed && (
                <span className="flex-1 truncate">{isEnglish ? item.labelEn : item.labelPt}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border py-3 px-2 space-y-0.5">
        {/* Notifications */}
        <button
          className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary',
            'hover:bg-surface hover:text-text-primary transition-colors w-full',
            collapsed && 'justify-center px-0 w-10 mx-auto'
          )}
          title={collapsed ? (isEnglish ? 'Notifications' : 'Notificações') : undefined}
        >
          <Bell size={17} className="shrink-0 text-text-muted" />
          {!collapsed && <span>{isEnglish ? 'Notifications' : 'Notificações'}</span>}
        </button>

        {/* User */}
        <div
          className={clsx(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg',
            collapsed && 'justify-center px-0 w-10 mx-auto'
          )}
        >
          <div className="w-6 h-6 rounded-full bg-accent-subtle border border-accent-border flex items-center justify-center shrink-0 overflow-hidden">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'User'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-semibold text-accent">
                {(user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}
              </span>
            )}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate leading-tight">
                  {user?.displayName ?? user?.email}
                </p>
              </div>
              <button
                onClick={signOut}
                className="text-text-muted hover:text-danger transition-colors p-1 rounded"
                title={isEnglish ? 'Sign out' : 'Sair'}
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted',
            'hover:bg-surface hover:text-text-secondary transition-colors w-full',
            collapsed && 'justify-center px-0 w-10 mx-auto'
          )}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed
            ? <PanelLeftOpen size={15} className="shrink-0" />
            : <PanelLeftClose size={15} className="shrink-0" />
          }
          {!collapsed && (
            <span className="text-xs">{isEnglish ? 'Collapse' : 'Recolher'}</span>
          )}
        </button>
      </div>

      {/* Hidden dev logs */}
      {!collapsed && (
        <div className="px-4 pb-2">
          <Link
            href="/logs"
            className="flex items-center gap-1.5 opacity-[0.08] hover:opacity-30 transition-opacity duration-300 group"
            title="Developer logs"
          >
            <ScrollText size={9} className="text-text-muted" />
            <span className="text-[9px] font-mono text-text-muted tracking-wider">sys/logs</span>
          </Link>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
