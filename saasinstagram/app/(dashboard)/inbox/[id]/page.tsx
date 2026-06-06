'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ConversationThread } from '@/components/inbox/ConversationThread';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { useConversations, useConversation } from '@/hooks/useConversations';
import { useActiveWorkspaceId } from '@/hooks/useActiveWorkspace';
import type { ConversationFilter, Conversation } from '@/types/conversation';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Info, X } from 'lucide-react';
import { getContactDisplayName } from '@/lib/conversations/display';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';
import { toast } from 'sonner';

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isEnglish } = useWorkspaceLocale();
  const conversationId = params.id as string;
  const workspaceId = useActiveWorkspaceId();

  const [filter, setFilter] = useState<ConversationFilter>({ status: 'open' });
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);

  const { conversations, loading: listLoading, error: listError, updateStatus } = useConversations(user ? workspaceId : null, filter);
  const { conversation, loading: convLoading, updateConversation } = useConversation(user ? conversationId : null);

  // Close sheet on conversation change
  useEffect(() => {
    setShowContactSheet(false);
  }, [conversationId]);

  const handleStatusChange = async (status: Conversation['status']) => {
    if (!conversation) return;
    await updateStatus(conversation.id, status);
  };

  const handleAutomationToggle = async (enabled: boolean) => {
    if (!conversation) return;

    setAutomationSaving(true);
    try {
      await updateConversation({
        aiEnabled: enabled ? conversation.aiEnabled : false,
        aiHandoffRequested: !enabled,
      });
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
        subtitle={conversation ? getContactDisplayName(conversation.contact) : 'Carregando...'}
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => router.push('/inbox')}
            >
              Voltar
            </Button>
            {/* Info button — mobile only */}
            {conversation && (
              <button
                onClick={() => setShowContactSheet(true)}
                className="lg:hidden p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
                title="Informações do contato"
              >
                <Info size={18} />
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list (hidden on mobile) */}
        <div className="hidden lg:block w-72 shrink-0">
          <ConversationList
            conversations={conversations}
            selectedId={conversationId}
            loading={listLoading}
            error={listError}
            filter={filter}
            onSelect={(conv) => router.push(`/inbox/${conv.id}`)}
            onFilterChange={setFilter}
          />
        </div>

        {/* Thread */}
        {convLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : conversation ? (
          <>
            <div className="flex-1 min-w-0 overflow-hidden">
              <ConversationThread
                conversation={conversation}
                workspaceId={workspaceId ?? ''}
                onStatusChange={handleStatusChange}
                onAutomationToggle={handleAutomationToggle}
                automationSaving={automationSaving}
              />
            </div>

            {/* Contact panel — desktop only (xl+) */}
            <div className="hidden xl:block">
              <ContactPanel
                conversation={conversation}
                automationSaving={automationSaving}
                onAutomationToggle={handleAutomationToggle}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-text-muted">Conversa não encontrada</p>
          </div>
        )}
      </div>

      {/* Contact panel bottom sheet — mobile only */}
      {showContactSheet && conversation && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowContactSheet(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-sidebar rounded-t-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle + close */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border sticky top-0 bg-sidebar">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded-full bg-border mx-auto" />
              </div>
              <button
                onClick={() => setShowContactSheet(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <ContactPanel
              conversation={conversation}
              automationSaving={automationSaving}
              onAutomationToggle={handleAutomationToggle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
