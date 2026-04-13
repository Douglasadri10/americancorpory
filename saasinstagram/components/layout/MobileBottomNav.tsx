'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Link2,
  MoreHorizontal,
  Zap,
  ScrollText,
  UserCog,
  CreditCard,
  Settings,
  LogOut,
  X,
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

const primaryItems: NavItem[] = [
  { labelPt: 'Visão Geral', labelEn: 'Overview', href: '/overview', icon: LayoutDashboard },
  { labelPt: 'Inbox', labelEn: 'Inbox', href: '/inbox', icon: MessageSquare },
  { labelPt: 'Leads', labelEn: 'Leads', href: '/leads', icon: Users },
  { labelPt: 'Canais', labelEn: 'Channels', href: '/channels', icon: Link2 },
];

const moreItems: NavItem[] = [
  { labelPt: 'Automações', labelEn: 'Automations', href: '/automations', icon: Zap },
  { labelPt: 'Logs', labelEn: 'Logs', href: '/logs', icon: ScrollText },
  { labelPt: 'Equipe', labelEn: 'Team', href: '/team', icon: UserCog },
  { labelPt: 'Faturamento', labelEn: 'Billing', href: '/billing', icon: CreditCard },
  { labelPt: 'Configurações', labelEn: 'Settings', href: '/settings', icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { isEnglish } = useWorkspaceLocale();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const isMoreActive = moreItems.some((item) => isActive(item.href));

  return (
    <>
      {/* Backdrop */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More drawer */}
      <div
        className={clsx(
          'fixed bottom-16 left-0 right-0 z-50 lg:hidden',
          'bg-sidebar border-t border-border rounded-t-2xl',
          'transition-transform duration-300 ease-out',
          showMore ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-semibold text-text-primary">
            {isEnglish ? 'More' : 'Mais'}
          </span>
          <button
            onClick={() => setShowMore(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* More nav items */}
        <nav className="p-3 space-y-0.5">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  active
                    ? 'bg-accent-subtle text-accent font-medium'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                )}
              >
                <Icon
                  size={18}
                  className={clsx(
                    'shrink-0',
                    active ? 'text-accent' : 'text-text-muted'
                  )}
                />
                <span>{isEnglish ? item.labelEn : item.labelPt}</span>
              </Link>
            );
          })}
        </nav>

        {/* User + Sign Out */}
        <div className="px-3 pb-4 pt-2 border-t border-border mt-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 overflow-hidden">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium text-accent">
                  {(user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                {user?.displayName ?? user?.email}
              </p>
              <p className="text-xs text-text-muted truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => { setShowMore(false); signOut(); }}
              className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-red-950/50 transition-colors"
              title={isEnglish ? 'Sign out' : 'Sair'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden h-16 bg-sidebar border-t border-border flex items-center px-2 safe-area-inset-bottom">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-xl transition-colors',
                active ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium leading-none">
                {isEnglish ? item.labelEn : item.labelPt}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setShowMore(!showMore)}
          className={clsx(
            'flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-xl transition-colors',
            (isMoreActive || showMore) ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px] font-medium leading-none">
            {isEnglish ? 'More' : 'Mais'}
          </span>
        </button>
      </nav>
    </>
  );
}
