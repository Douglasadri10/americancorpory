'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Search, Bell, HelpCircle, ChevronDown, Settings, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function Header({ title, subtitle, actions, className }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { isEnglish } = useWorkspaceLocale();
  const router = useRouter();
  const [showNotif, setShowNotif] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const makeOutsideHandler = useCallback(
    (ref: React.RefObject<HTMLDivElement>, setter: (v: boolean) => void) =>
      (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) setter(false);
      },
    []
  );

  useEffect(() => {
    if (!showNotif) return;
    const h = makeOutsideHandler(notifRef, setShowNotif);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showNotif, makeOutsideHandler]);

  useEffect(() => {
    if (!showAvatar) return;
    const h = makeOutsideHandler(avatarRef, setShowAvatar);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showAvatar, makeOutsideHandler]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        router.push('/inbox');
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [router]);

  return (
    <header
      className={clsx(
        'h-[58px] bg-sidebar border-b border-border px-6',
        'flex items-center justify-between shrink-0',
        className
      )}
    >
      {/* Left: Title */}
      <div className="flex flex-col justify-center min-w-0">
        {title && (
          <h1 className="text-[15px] font-semibold text-text-primary leading-tight tracking-[-0.01em] truncate">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-xs text-text-muted truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {actions}

        {/* Search */}
        <button
          onClick={() => router.push('/inbox')}
          className="hidden md:flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary hover:border-border-strong transition-all"
        >
          <Search size={13} className="shrink-0" />
          <span className="text-xs">{isEnglish ? 'Search...' : 'Buscar...'}</span>
          <span className="ml-1 flex items-center gap-0.5 text-[10px] text-text-muted bg-white border border-border rounded px-1.5 py-0.5 font-medium">
            ⌘K
          </span>
        </button>

        {/* Help */}
        <a
          href="mailto:admin@usehanna.com"
          className="hidden md:flex p-2 text-text-muted hover:text-text-secondary rounded-lg hover:bg-surface transition-colors"
          title={isEnglish ? 'Help & Support' : 'Ajuda e Suporte'}
        >
          <HelpCircle size={16} />
        </a>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotif((v) => !v)}
            className={clsx(
              'relative p-2 rounded-lg transition-colors',
              showNotif
                ? 'text-text-primary bg-surface'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface'
            )}
          >
            <Bell size={16} />
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-border rounded-xl shadow-dropdown z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">
                  {isEnglish ? 'Notifications' : 'Notificações'}
                </span>
              </div>
              <div className="py-10 text-center">
                <Bell size={24} className="text-text-muted mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-text-primary">
                  {isEnglish ? 'No notifications' : 'Sem notificações'}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {isEnglish ? "You're all caught up!" : 'Você está em dia!'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border mx-1" />

        {/* User Avatar */}
        <div ref={avatarRef} className="relative">
          <button
            onClick={() => setShowAvatar((v) => !v)}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors px-1 py-1 rounded-lg hover:bg-surface"
          >
            <div className="w-7 h-7 rounded-full bg-accent-subtle border border-accent-border flex items-center justify-center overflow-hidden">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-accent">
                  {(user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
            <ChevronDown
              size={13}
              className={clsx('text-text-muted transition-transform duration-150', showAvatar && 'rotate-180')}
            />
          </button>

          {showAvatar && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-border rounded-xl shadow-dropdown z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user?.displayName ?? (isEnglish ? 'User' : 'Usuário')}
                </p>
                <p className="text-xs text-text-muted truncate mt-0.5">{user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setShowAvatar(false); router.push('/settings'); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                >
                  <Settings size={14} />
                  {isEnglish ? 'Settings' : 'Configurações'}
                </button>
                <hr className="border-border my-1" />
                <button
                  onClick={() => { setShowAvatar(false); signOut(); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-danger hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  {isEnglish ? 'Sign out' : 'Sair'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
