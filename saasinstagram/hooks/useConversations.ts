'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getFirebaseAuth } from '@/lib/firebase/client';
import type { Conversation, ConversationFilter, ConversationStatus } from '@/types/conversation';

interface ConversationsState {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  stats: {
    total: number;
    open: number;
    pending: number;
    resolved: number;
    unassigned: number;
  } | null;
}

async function getAuthHeaders() {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    return {} as Record<string, string>;
  }

  const idToken = await user.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
  } as Record<string, string>;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? 'Erro ao carregar conversas');
  }

  return data;
}

async function enrichContactsInBackground(
  conversations: Conversation[],
  workspaceId: string,
  setState: React.Dispatch<React.SetStateAction<ConversationsState>>
) {
  const headers = await getAuthHeaders();
  await Promise.allSettled(
    conversations.map(async (conv) => {
      try {
        const res = await fetch('/api/conversations/enrich-contact', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, conversationId: conv.id }),
        });
        if (!res.ok) return;
        const result = await res.json() as { enriched: boolean; contact?: Conversation['contact'] };
        if (result.enriched && result.contact) {
          setState((prev) => ({
            ...prev,
            conversations: prev.conversations.map((c) =>
              c.id === conv.id ? { ...c, contact: result.contact! } : c
            ),
          }));
        }
      } catch {
        // silent — enrichment is best-effort
      }
    })
  );
}

export function useConversations(workspaceId: string | null, filter: ConversationFilter = {}) {
  const [state, setState] = useState<ConversationsState>({
    conversations: [],
    loading: true,
    error: null,
    stats: null,
  });

  const loadConversationsViaApi = useCallback(async (includeStats = false) => {
    if (!workspaceId) {
      setState((prev) => ({ ...prev, conversations: [], stats: null, loading: false }));
      return;
    }

    const params = new URLSearchParams({
      workspaceId,
      limit: '50',
    });

    if (includeStats) {
      params.set('includeStats', '1');
    }

    if (filter.status && filter.status !== 'all') params.set('status', filter.status);
    if (filter.channel && filter.channel !== 'all') params.set('channel', filter.channel);
    if (filter.assignedTo) params.set('assignedTo', filter.assignedTo);

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/conversations?${params.toString()}`, {
      headers,
      credentials: 'include',
      cache: 'no-store',
    });

    const data = await parseApiResponse<{
      conversations?: Conversation[];
      stats?: ConversationsState['stats'];
    }>(response);

    const convList = data.conversations ?? [];
    setState((prev) => ({
      ...prev,
      conversations: convList,
      stats: includeStats ? (data.stats ?? prev.stats) : prev.stats,
      loading: false,
      error: null,
    }));

    // Background-enrich Instagram contacts with placeholder names
    const needsEnrichment = convList.filter((c) => {
      if (c.channel !== 'instagram') return false;
      const n = c.contact?.name?.trim();
      return !n || n === 'Contato' || /^#[0-9a-f]+$/i.test(n) || /^\d+$/.test(n);
    });
    if (needsEnrichment.length > 0) {
      void enrichContactsInBackground(needsEnrichment, workspaceId, setState);
    }
  }, [filter.assignedTo, filter.channel, filter.status, workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setState((prev) => ({ ...prev, conversations: [], stats: null, loading: false }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    void loadConversationsViaApi(true).catch((error) => {
      console.error('Conversation polling error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao carregar conversas',
        loading: false,
      }));
    });

    const interval = window.setInterval(() => {
      void loadConversationsViaApi(false).catch((error) => {
        console.error('Conversation polling error:', error);
      });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadConversationsViaApi, workspaceId]);

  const loadStats = useCallback(async () => {
    await loadConversationsViaApi(true);
  }, [loadConversationsViaApi]);

  const patchConversation = useCallback(async (body: Record<string, unknown>) => {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/conversations', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    await parseApiResponse<{ success: boolean }>(response);
  }, []);

  const updateStatus = useCallback(async (conversationId: string, status: ConversationStatus) => {
    await patchConversation({ id: conversationId, status });
    await loadConversationsViaApi(true);
  }, [loadConversationsViaApi, patchConversation]);

  const assignAgent = useCallback(async (conversationId: string, agentUid: string, agentName: string) => {
    await patchConversation({
      id: conversationId,
      assignedTo: agentUid,
      assignedToName: agentName,
    });
    await loadConversationsViaApi(true);
  }, [loadConversationsViaApi, patchConversation]);

  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      await patchConversation({ id: conversationId, unreadCount: 0 });
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((conversation) => (
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )),
      }));
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [patchConversation]);

  return {
    conversations: state.conversations,
    loading: state.loading,
    error: state.error,
    stats: state.stats,
    loadStats,
    updateStatus,
    assignAgent,
    markAsRead,
  };
}

export function useConversation(conversationId: string | null) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async () => {
    if (!conversationId) {
      setConversation(null);
      setLoading(false);
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/conversations?conversationId=${encodeURIComponent(conversationId)}`, {
      headers,
      credentials: 'include',
      cache: 'no-store',
    });

    const data = await parseApiResponse<{ conversation?: Conversation | null }>(response);
    setConversation(data.conversation ?? null);
    setLoading(false);
    setError(null);
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    void loadConversation().catch((error) => {
      console.error('Error loading conversation:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar conversa');
      setLoading(false);
    });

    if (!conversationId) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadConversation().catch(() => null);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [conversationId, loadConversation]);

  return {
    conversation,
    loading,
    error,
    reload: loadConversation,
  };
}
