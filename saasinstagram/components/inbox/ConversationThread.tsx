'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Send,
  Paperclip,
  Smile,
  Sparkles,
  CheckCheck,
  MoreVertical,
  Tag,
  Archive,
  Trash2,
  RotateCcw,
  Bot,
  Power,
} from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Conversation } from '@/types/conversation';
import { getContactDisplayName, getContactInitial } from '@/lib/conversations/display';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';

interface ConversationThreadProps {
  conversation: Conversation;
  workspaceId: string;
  onStatusChange?: (status: Conversation['status']) => void;
}

export function ConversationThread({
  conversation,
  workspaceId,
  onStatusChange,
}: ConversationThreadProps) {
  const { isEnglish, intlLocale } = useWorkspaceLocale();
  const [inputText, setInputText] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EMOJIS = [
    '😊','😂','🙏','❤️','👍','🔥','😍','✅','🎉','💯',
    '😅','🤔','👋','✨','💪','😮','🙌','😢','🚀','💡',
    '⭐','🤝','😎','🥰','💬','📝','💰','⚡','🏆','💼',
    '👏','😀','🤩','💕','📞','✔️','🌟','🎯','💎','🙂',
  ];

  useEffect(() => {
    if (!showActions) return;
    function handleClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActions]);

  useEffect(() => {
    if (!showEmoji) return;
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmoji]);

  const { messages, loading, sending, sendMessage, markAsRead } = useMessages(conversation.id);
  const displayName = getContactDisplayName(conversation.contact);

  // Auto-scroll to bottom — scroll the container directly to avoid scrolling the whole page
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  // Mark as read when thread is opened
  useEffect(() => {
    markAsRead();
  }, [conversation.id, markAsRead]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    try {
      await sendMessage({ type: 'text', text, workspaceId });
    } catch (error) {
      setInputText(text); // Restore on error
    }
  }, [inputText, sending, sendMessage, workspaceId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getChannelBadge = () => {
    const variants = {
      instagram: 'instagram' as const,
      facebook: 'facebook' as const,
      whatsapp: 'whatsapp' as const,
    };
    const labels = {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
    };
    return { variant: variants[conversation.channel], label: labels[conversation.channel] };
  };

  const channelBadge = getChannelBadge();

  // Group messages by date
  const groupedMessages = messages.reduce<Array<{ date: string; messages: typeof messages }>>((acc, msg) => {
    const date = new Date(msg.createdAt).toLocaleDateString(intlLocale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const group = acc.find((g) => g.date === date);
    if (group) {
      group.messages.push(msg);
    } else {
      acc.push({ date, messages: [msg] });
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-[60px] border-b border-border px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Contact Avatar */}
          <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center overflow-hidden shrink-0">
            {conversation.contact.avatarURL ? (
              <img
                src={conversation.contact.avatarURL}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-text-secondary">
                {getContactInitial(conversation.contact)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary truncate">
                {displayName}
              </h3>
              <Badge variant={channelBadge.variant} size="xs">
                {channelBadge.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-text-muted">
                {isEnglish ? 'Managed by workspace owner' : 'Gerenciado pelo proprietário do workspace'}
              </p>
              {(conversation.aiEnabled || conversation.aiHandoffRequested) && <span className="text-text-muted">·</span>}
              {conversation.aiHandoffRequested ? (
                <div className="flex items-center gap-1">
                  <Power size={10} className="text-text-muted" />
                  <span className="text-xs text-text-muted">{isEnglish ? 'AI paused' : 'IA pausada'}</span>
                </div>
              ) : conversation.aiEnabled ? (
                <div className="flex items-center gap-1">
                  <Bot size={10} className="text-accent" />
                  <span className="text-xs text-accent">{isEnglish ? 'AI enabled' : 'IA ativa'}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {conversation.status === 'open' ? (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<CheckCheck size={14} />}
              onClick={() => onStatusChange?.('resolved')}
            >
              {isEnglish ? 'Resolve' : 'Resolver'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<RotateCcw size={14} />}
              onClick={() => onStatusChange?.('open')}
            >
              {isEnglish ? 'Reopen' : 'Reabrir'}
            </Button>
          )}

          {/* More options */}
          <div ref={actionsRef} className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
            >
              <MoreVertical size={16} />
            </button>

            {showActions && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-modal w-44 z-10 py-1">
                <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors">
                  <Tag size={14} />
                  {isEnglish ? 'Add tag' : 'Adicionar etiqueta'}
                </button>
                <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors">
                  <Archive size={14} />
                  {isEnglish ? 'Archive' : 'Arquivar'}
                </button>
                <hr className="border-border my-1" />
                <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-red-950 transition-colors">
                  <Trash2 size={14} />
                  {isEnglish ? 'Mark as spam' : 'Marcar como spam'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
              <p className="text-sm text-text-muted">{isEnglish ? 'Loading messages...' : 'Carregando mensagens...'}</p>
              </div>
            </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-accent-subtle flex items-center justify-center mb-3">
              <Send size={20} className="text-accent" />
            </div>
            <p className="text-sm text-text-muted">{isEnglish ? 'No messages yet' : 'Nenhuma mensagem ainda'}</p>
            <p className="text-xs text-text-muted mt-1">{isEnglish ? 'Send a message to start' : 'Envie uma mensagem para iniciar'}</p>
          </div>
        ) : (
          groupedMessages.map(({ date, messages: dayMessages }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-muted whitespace-nowrap">{date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-3">
                {dayMessages.map((msg, idx) => {
                  const prevMsg = dayMessages[idx - 1];
                  const showAvatar =
                    !prevMsg ||
                    prevMsg.direction !== msg.direction ||
                    prevMsg.senderType !== msg.senderType;

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      showAvatar={showAvatar}
                      contactName={displayName}
                      contactAvatar={conversation.contact.avatarURL}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 shrink-0">
        {/* AI Mode Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setAiMode(!aiMode)}
            className={clsx(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors',
              aiMode
                ? 'bg-accent-subtle text-accent border-accent/30'
                : 'text-text-muted border-border hover:border-muted'
            )}
          >
            <Sparkles size={11} />
            {aiMode ? (isEnglish ? 'AI mode enabled' : 'Modo IA ativo') : (isEnglish ? 'Use AI' : 'Usar IA')}
          </button>

          {conversation.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.label}
            </span>
          ))}
        </div>

        <div className="flex items-end gap-2">
          {/* Attachment */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-text-muted hover:text-text-primary transition-colors shrink-0"
            title={isEnglish ? 'Attach file' : 'Anexar arquivo'}
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setInputText((prev) => prev + (prev ? ' ' : '') + `[${file.name}]`);
              }
              e.target.value = '';
            }}
          />

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                aiMode
                  ? (isEnglish ? 'Describe what AI should reply...' : 'Descreva o que a IA deve responder...')
                  : (isEnglish ? 'Write a message...' : 'Escreva uma mensagem...')
              }
              rows={1}
              className={clsx(
                'w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-text-primary',
                'placeholder:text-text-muted resize-none',
                'focus:outline-none focus:border-accent',
                'transition-colors max-h-32 overflow-y-auto',
                aiMode && 'border-accent/30 bg-accent-subtle/10'
              )}
              style={{ minHeight: '44px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
          </div>

          {/* Emoji */}
          <div ref={emojiRef} className="relative shrink-0">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className="p-2 text-text-muted hover:text-text-primary transition-colors"
              title={isEnglish ? 'Emoji' : 'Emoji'}
            >
              <Smile size={18} />
            </button>
            {showEmoji && (
              <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-modal p-2 w-56 z-20">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setInputText((prev) => prev + emoji);
                        inputRef.current?.focus();
                      }}
                      className="text-base p-1 rounded hover:bg-surface transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className={clsx(
              'p-2.5 rounded-xl transition-all shrink-0',
              inputText.trim()
                ? aiMode
                  ? 'bg-accent text-white hover:bg-accent-hover'
                  : 'bg-accent text-white hover:bg-accent-hover'
                : 'bg-surface text-text-muted cursor-not-allowed'
            )}
          >
            {sending ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : aiMode ? (
              <Sparkles size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>

        <p className="text-xs text-text-muted mt-2 text-center">
          {isEnglish ? 'Enter to send · Shift+Enter for a new line' : 'Enter para enviar · Shift+Enter para nova linha'}
        </p>
      </div>
    </div>
  );
}

export default ConversationThread;
