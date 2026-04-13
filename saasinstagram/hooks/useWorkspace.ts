'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFirebaseDb } from '@/lib/firebase/client';
import { WorkspaceService } from '@/services/workspaceService';
import type { Workspace } from '@/types/workspace';

interface WorkspaceState {
  workspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
}

// Simple in-memory cache
let cachedWorkspaceId: string | null = null;
let cachedWorkspace: Workspace | null = null;

export function useWorkspace(workspaceId?: string) {
  const [state, setState] = useState<WorkspaceState>({
    workspace: null,
    workspaces: [],
    loading: true,
    error: null,
  });

  const service = new WorkspaceService(getFirebaseDb());

  const loadWorkspace = useCallback(async (id: string) => {
    // Use cache if available
    if (cachedWorkspaceId === id && cachedWorkspace) {
      setState((prev) => ({
        ...prev,
        workspace: cachedWorkspace,
        loading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const workspace = await service.getWorkspace(id);
      cachedWorkspaceId = id;
      cachedWorkspace = workspace;
      setState((prev) => ({
        ...prev,
        workspace,
        loading: false,
      }));
    } catch (error) {
      console.error('Error loading workspace:', error);
      setState((prev) => ({
        ...prev,
        error: 'Erro ao carregar workspace',
        loading: false,
      }));
    }
  }, []);

  const loadUserWorkspaces = useCallback(async (uid: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const workspaces = await service.getUserWorkspaces(uid);
      setState((prev) => ({
        ...prev,
        workspaces,
        workspace: workspaces[0] ?? null,
        loading: false,
      }));
    } catch (error) {
      console.error('Error loading workspaces:', error);
      setState((prev) => ({
        ...prev,
        error: 'Erro ao carregar workspaces',
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    if (workspaceId) {
      loadWorkspace(workspaceId);
    }
  }, [workspaceId, loadWorkspace]);

  const updateWorkspace = useCallback(
    async (updates: Parameters<WorkspaceService['updateWorkspace']>[1]) => {
      if (!state.workspace) return;
      try {
        await service.updateWorkspace(state.workspace.id, updates);
        // Invalidate cache
        cachedWorkspace = null;
        cachedWorkspaceId = null;
        await loadWorkspace(state.workspace.id);
      } catch (error) {
        console.error('Error updating workspace:', error);
        throw error;
      }
    },
    [state.workspace, loadWorkspace]
  );

  const createWorkspace = useCallback(
    async (params: Parameters<WorkspaceService['createWorkspace']>[0]) => {
      try {
        const workspace = await service.createWorkspace(params);
        setState((prev) => ({
          ...prev,
          workspace,
          workspaces: [...prev.workspaces, workspace],
        }));
        return workspace;
      } catch (error) {
        console.error('Error creating workspace:', error);
        throw error;
      }
    },
    []
  );

  const switchWorkspace = useCallback(
    (id: string) => {
      // Store in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('currentWorkspaceId', id);
      }
      loadWorkspace(id);
    },
    [loadWorkspace]
  );

  return {
    workspace: state.workspace,
    workspaces: state.workspaces,
    loading: state.loading,
    error: state.error,
    loadWorkspace,
    loadUserWorkspaces,
    updateWorkspace,
    createWorkspace,
    switchWorkspace,
  };
}

export function useCurrentWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentWorkspaceId');
}
