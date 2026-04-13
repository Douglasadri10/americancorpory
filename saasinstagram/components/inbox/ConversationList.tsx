'use client';

import React from 'react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { Instagram, Facebook, MessageCircle, Filter, RefreshCw, type LucideIcon } from 'lucide-react';
import type { Conversation, ConversationFilter, Channel } from '@/types/conversation';
import { Badge } from '@/components/ui/Badge';
import { getContactDisplayName, getContactInitial } from '@/lib/conversations/display';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  loading?: boolean;
  filter?: ConversationFilter;
  onSelect: (conversation: Conversation) => void;
  onFilterChange?: (filter: ConversationFilter) => void;
}

const ChannelIcon: Record<Channel, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: MessageCircle,
};

const channelColors: Record<Channel, string> = {
  instagram: 'text-instagram',
  facebook: 'text-facebook',
  whatsapp: 'text-whatsapp',
};

const statusColors: Record<string, string> = {
  open: 'success',
  pending: 'warning',
  resolved: 'outline',
  spam: 'danger',
};

export function ConversationList({
  conversations,
  selectedId,
  loading,
  filter = {},
  onSelect,
  onFilterChange,
}: ConversationListProps) {
  const { isEnglish, dateFnsLocale } = useWorkspaceLocale();
  const statusOptions = [
    { value: 'all', label: isEnglish ? 'All' : 'Todas' },
    { value: 'open', label: isEnglish ? 'Open' : 'Abertas' },
    { value: 'pending', label: isEnglish ? 'Pending' : 'Pendentes' },
    { value: 'resolved', label: isEnglish ? 'Resolved' : 'Resolvidas' },
  ];

  const channelOptions = [
    { value: 'all', label: isEnglish ? 'All' : 'Todos' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'whatsapp', label: 'WhatsApp' },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-border w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary">{isEnglish ? 'Conversations' : 'Conversas'}</h2>
          <div className="flex items-center gap-1">
            <button className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface transition-colors">
              <Filter size={14} />
            </button>
            <button className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder={isEnglish ? 'Search conversation...' : 'Buscar conversa...'}
          value={filter.search ?? ''}
          onChange={(e) => onFilterChange?.({ ...filter, search: e.target.value })}
          className="w-full bg-white border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />

        {/* Status Tabs */}
        <div className="flex gap-1 mt-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                onFilterChange?.({
                  ...filter,
                  status: opt.value as ConversationFilter['status'],
                })
              }
              className={clsx(
                'flex-1 py-1 text-xs rounded-md transition-colors',
                filter.status === opt.value || (!filter.status && opt.value === 'all')
                  ? 'bg-accent-subtle text-accent font-medium'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Channel Filter */}
        <div className="flex gap-1 mt-1">
          {channelOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                onFilterChange?.({
                  ...filter,
                  channel: opt.value as ConversationFilter['channel'],
                })
              }
              className={clsx(
                'flex-1 py-1 text-xs rounded-md transition-colors',
                filter.channel === opt.value || (!filter.channel && opt.value === 'all')
                  ? 'bg-surface text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <MessageCircle size={40} className="text-text-muted mb-3 opacity-40" />
            <p className="text-sm text-text-muted">{isEnglish ? 'No conversations found' : 'Nenhuma conversa encontrada'}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {conversations.map((conv) => {
              const Icon = ChannelIcon[conv.channel];
              const isSelected = conv.id === selectedId;
              const hasUnread = conv.unreadCount > 0;
              const displayName = getContactDisplayName(conv.contact);

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={clsx(
                    'w-full text-left px-4 py-3 transition-colors',
                    isSelected
                      ? 'bg-accent-subtle border-l-2 border-accent'
                      : 'hover:bg-surface border-l-2 border-transparent',
                    hasUnread && !isSelected && 'bg-surface'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center overflow-hidden">
                        {conv.contact.avatarURL ? (
                          <img
                            src={conv.contact.avatarURL}
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-text-secondary">
                            {getContactInitial(conv.contact)}
                          </span>
                        )}
                      </div>
                      {/* Channel badge */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-sidebar flex items-center justify-center">
                        <Icon size={10} className={channelColors[conv.channel]} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={clsx(
                            'text-sm truncate',
                            hasUnread
                              ? 'font-semibold text-text-primary'
                              : 'font-medium text-text-primary'
                          )}
                        >
                          {displayName}
                        </span>
                        <span className="text-xs text-text-muted shrink-0">
                          {conv.lastMessage?.timestamp
                            ? formatDistanceToNow(new Date(conv.lastMessage.timestamp), {
                                addSuffix: false,
                                locale: dateFnsLocale,
                              })
                            : ''}
                        </span>
                      </div>

                      <p
                        className={clsx(
                          'text-xs truncate mt-0.5',
                          hasUnread ? 'text-text-secondary' : 'text-text-muted'
                        )}
                      >
                        {conv.lastMessage?.fromAgent && '↳ '}
                        {conv.lastMessage?.text ?? (isEnglish ? 'Media' : 'Mídia')}
                      </p>

                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={statusColors[conv.status] as 'success' | 'warning' | 'danger' | 'outline'}
                            size="xs"
                            dot
                          >
                            {conv.status === 'open'
                              ? (isEnglish ? 'Open' : 'Aberta')
                              : conv.status === 'pending'
                              ? (isEnglish ? 'Pending' : 'Pendente')
                              : conv.status === 'resolved'
                              ? (isEnglish ? 'Resolved' : 'Resolvida')
                              : 'Spam'}
                          </Badge>
                          {conv.assignedToName && (
                            <span className="text-xs text-text-muted truncate max-w-[60px]">
                              {conv.assignedToName.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        {hasUnread && (
                          <span className="bg-accent text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversationList;
