'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFirebaseAuth } from '@/lib/firebase/client';
import type { Message, SendMessagePayload } from '@/types/message';

interface MessagesState {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  error: string | null;
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
    throw new Error(data.error ?? 'Erro ao carregar mensagens');
  }

  return data;
}

export function useMessages(conversationId: string | null) {
  const [state, setState] = useState<MessagesState>({
    messages: [],
    loading: true,
    sending: false,
    error: null,
  });

  const loadMessagesViaApi = useCallback(async () => {
    if (!conversationId) {
      setState((prev) => ({ ...prev, messages: [], loading: false }));
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}&limit=100`, {
      headers,
      credentials: 'include',
      cache: 'no-store',
    });

    const data = await parseApiResponse<{ messages?: Message[] }>(response);
    setState((prev) => ({
      ...prev,
      messages: data.messages ?? [],
      loading: false,
      error: null,
    }));
  }, [conversationId]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void loadMessagesViaApi().catch((error) => {
      console.error('Message polling error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao carregar mensagens',
        loading: false,
      }));
    });

    if (!conversationId) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadMessagesViaApi().catch(() => null);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [conversationId, loadMessagesViaApi]);

  const sendMessage = useCallback(async (
    payload: Omit<SendMessagePayload, 'conversationId'> & { workspaceId: string }
  ) => {
    if (!conversationId) {
      return;
    }

    setState((prev) => ({ ...prev, sending: true, error: null }));

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          conversationId,
        }),
      });

      await parseApiResponse<Message>(response);
      await loadMessagesViaApi();
      setState((prev) => ({ ...prev, sending: false }));
    } catch (error) {
      console.error('Error sending message:', error);
      setState((prev) => ({
        ...prev,
        sending: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar mensagem',
      }));
      throw error;
    }
  }, [conversationId, loadMessagesViaApi]);

  const markAsRead = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      await fetch('/api/conversations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        credentials: 'include',
        body: JSON.stringify({
          id: conversationId,
          unreadCount: 0,
        }),
      });
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [conversationId]);

  return {
    messages: state.messages,
    loading: state.loading,
    sending: state.sending,
    error: state.error,
    sendMessage,
    markAsRead,
    reload: loadMessagesViaApi,
  };
}
