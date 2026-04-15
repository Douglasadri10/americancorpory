'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { WorkspaceLocaleProvider } from '@/components/providers/WorkspaceLocaleProvider';
import type { Workspace } from '@/types/workspace';

const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center animate-pulse">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      </div>
      <p className="text-sm text-text-muted">Carregando...</p>
    </div>
  </div>
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  // true until workspace is resolved — prevents pages from rendering with null workspaceId
  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    setWorkspaceLoading(true);
    // If localStorage has a cached ID, send it for a fast exact-match lookup
    const cached = localStorage.getItem('currentWorkspaceId');
    const workspaceQuery = cached ? `?workspaceId=${encodeURIComponent(cached)}` : '';

    user.getIdToken().then((idToken) =>
      fetch(`/api/workspace/me${workspaceQuery}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => r.json())
        .then((data: { workspace?: Workspace }) => {
          if (data.workspace) {
            localStorage.setItem('currentWorkspaceId', data.workspace.id);
            setWorkspace(data.workspace);
          }
        })
        .catch(() => {
          if (cached) console.warn('Workspace API failed, using cached ID');
        })
        .finally(() => setWorkspaceLoading(false))
    );
  }, [user]);

  if (authLoading || workspaceLoading) {
    return <LoadingScreen />;
  }

  if (!user) return null;

  return (
    <WorkspaceLocaleProvider initialWorkspace={workspace}>
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="relative">
          <Sidebar />
        </div>
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden pb-16 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </WorkspaceLocaleProvider>
  );
}
