'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Header } from '@/components/layout/Header';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ConversationThread } from '@/components/inbox/ConversationThread';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { useConversations } from '@/hooks/useConversations';
import { useActiveWorkspaceId } from '@/hooks/useActiveWorkspace';
import type { Conversation, ConversationFilter } from '@/types/conversation';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';
import { toast } from 'sonner';

export default function InboxPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isEnglish } = useWorkspaceLocale();
  const workspaceId = useActiveWorkspaceId();

  const [filter, setFilter] = useState<ConversationFilter>({ status: 'open' });
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showContactPanel, setShowContactPanel] = useState(true);
  const [automationSaving, setAutomationSaving] = useState(false);

  const { conversations, loading, error, updateStatus, updateConversation } = useConversations(user ? workspaceId : null, filter);

  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    const freshConversation = conversations.find((conversation) => conversation.id === selectedConversation.id);
    if (freshConversation) {
      setSelectedConversation(freshConversation);
    }
  }, [conversations, selectedConversation]);

  const handleSelectConversation = (conv: Conversation) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      router.push(`/inbox/${conv.id}`);
      return;
    }
    setSelectedConversation(conv);
    router.push(`/inbox/${conv.id}`, { scroll: false });
  };

  const handleStatusChange = async (status: Conversation['status']) => {
    if (!selectedConversation) return;
    await updateStatus(selectedConversation.id, status);
    setSelectedConversation((prev) => prev ? { ...prev, status } : null);
    // Switch list filter to match new status so conversation stays visible
    if (status === 'open' || status === 'pending') {
      setFilter((prev) => ({ ...prev, status }));
    } else if (status === 'resolved') {
      setFilter((prev) => ({ ...prev, status: 'resolved' }));
    }
  };

  const handleAutomationToggle = async (enabled: boolean) => {
    if (!selectedConversation) return;

    setAutomationSaving(true);
    try {
      const updates = {
        aiEnabled: enabled ? selectedConversation.aiEnabled : false,
        aiHandoffRequested: !enabled,
      };

      await updateConversation(selectedConversation.id, updates);
      setSelectedConversation((prev) => (prev ? { ...prev, ...updates } : prev));
      toast.success(
        enabled
          ? (isEnglish ? 'AI enabled for this chat.' : 'IA ativada neste chat.')
          : (isEnglish ? 'AI disabled for this chat.' : 'IA desligada neste chat.')
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (isEnglish ? 'Error updating chat automation' : 'Erro ao atualizar a automação do chat')
      );
    } finally {
      setAutomationSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Inbox"
        subtitle={isEnglish ? `${conversations.length} conversations` : `${conversations.length} conversas`}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list: full width on mobile (when no selection), fixed 300px on desktop */}
        <div
          className={clsx(
            'flex flex-col h-full',
            selectedConversation
              ? 'hidden lg:flex lg:w-[300px] lg:shrink-0'
              : 'flex-1 lg:flex-none lg:w-[300px] lg:shrink-0'
          )}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversation?.id}
            loading={loading}
            error={error}
            filter={filter}
            onSelect={handleSelectConversation}
            onFilterChange={setFilter}
          />
        </div>

        {/* Thread or empty state: hidden on mobile when no selection */}
        <div className={clsx('flex-1 min-w-0', selectedConversation ? 'flex' : 'hidden lg:flex')}>
          {selectedConversation ? (
            <>
              <div className="flex-1 min-w-0 overflow-hidden">
                <ConversationThread
                  conversation={selectedConversation}
                  workspaceId={workspaceId ?? ''}
                  onStatusChange={handleStatusChange}
                  onAutomationToggle={handleAutomationToggle}
                  automationSaving={automationSaving}
                />
              </div>

              {/* Contact panel — desktop only */}
              {showContactPanel && (
                <div className="hidden xl:block">
                  <ContactPanel
                    conversation={selectedConversation}
                    automationSaving={automationSaving}
                    onAutomationToggle={handleAutomationToggle}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-accent-subtle flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {isEnglish ? 'Select a conversation' : 'Selecione uma conversa'}
              </h3>
              <p className="text-sm text-text-muted max-w-xs">
                {isEnglish
                  ? 'Choose a conversation from the list to start replying'
                  : 'Escolha uma conversa na lista ao lado para começar a atender'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
