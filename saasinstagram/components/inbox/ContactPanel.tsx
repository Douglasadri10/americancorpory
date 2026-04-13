'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import {
  Instagram,
  Facebook,
  MessageCircle,
  Phone,
  Mail,
  User,
  Tag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  Edit3,
} from 'lucide-react';
import type { Conversation } from '@/types/conversation';
import { Badge } from '@/components/ui/Badge';
import { getContactDisplayName, getContactInitial, normalizeContactUsername } from '@/lib/conversations/display';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';

interface ContactPanelProps {
  conversation: Conversation;
  className?: string;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hover:bg-surface transition-colors"
      >
        {title}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function ContactPanel({ conversation, className }: ContactPanelProps) {
  const { isEnglish, dateFnsLocale } = useWorkspaceLocale();
  const { contact } = conversation;
  const displayName = getContactDisplayName(contact);
  const username = normalizeContactUsername(contact.username);

  const channelIcons = {
    instagram: Instagram,
    facebook: Facebook,
    whatsapp: MessageCircle,
  };

  const ChannelIcon = channelIcons[conversation.channel];

  return (
    <div
      className={clsx(
        'w-[260px] shrink-0 bg-sidebar border-l border-border flex flex-col overflow-y-auto',
        className
      )}
    >
      {/* Contact Header */}
      <div className="p-4 border-b border-border text-center">
        <div className="relative inline-block mb-3">
          <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center overflow-hidden mx-auto">
            {contact.avatarURL ? (
              <img
                src={contact.avatarURL}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-semibold text-text-secondary">
                {getContactInitial(contact)}
              </span>
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-sidebar flex items-center justify-center border border-border">
            <ChannelIcon size={12} className={`text-${conversation.channel === 'instagram' ? 'instagram' : conversation.channel === 'facebook' ? 'facebook' : 'whatsapp'}`} />
          </div>
        </div>

        <h3 className="text-sm font-semibold text-text-primary">{displayName}</h3>
        {username && displayName !== `@${username}` && (
          <p className="text-xs text-text-muted mt-0.5">@{username}</p>
        )}

        {/* Quick actions */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {contact.profileURL && (
            <a
              href={contact.profileURL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
              title={isEnglish ? 'View profile' : 'Ver perfil'}
            >
              <ExternalLink size={14} />
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
              title={isEnglish ? 'Call' : 'Ligar'}
            >
              <Phone size={14} />
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
              title="Email"
            >
              <Mail size={14} />
            </a>
          )}
          <button className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface transition-colors" title={isEnglish ? 'Edit' : 'Editar'}>
            <Edit3 size={14} />
          </button>
        </div>
      </div>

      {/* Conversation Info */}
      <Section title={isEnglish ? 'Conversation' : 'Conversa'}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{isEnglish ? 'Channel' : 'Canal'}</span>
            <Badge variant={conversation.channel as 'instagram' | 'facebook' | 'whatsapp'} size="xs">
              {conversation.channel === 'instagram'
                ? 'Instagram'
                : conversation.channel === 'facebook'
                ? 'Facebook'
                : 'WhatsApp'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{isEnglish ? 'Status' : 'Status'}</span>
            <Badge
              variant={
                conversation.status === 'open'
                  ? 'success'
                  : conversation.status === 'pending'
                  ? 'warning'
                  : conversation.status === 'resolved'
                  ? 'outline'
                  : 'danger'
              }
              size="xs"
              dot
            >
              {conversation.status === 'open'
                ? (isEnglish ? 'Open' : 'Aberta')
                : conversation.status === 'pending'
                ? (isEnglish ? 'Pending' : 'Pendente')
                : conversation.status === 'resolved'
                ? (isEnglish ? 'Resolved' : 'Resolvida')
                : 'Spam'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{isEnglish ? 'Priority' : 'Prioridade'}</span>
            <Badge
              variant={
                conversation.priority === 'urgent' || conversation.priority === 'high'
                  ? 'danger'
                  : conversation.priority === 'medium'
                  ? 'warning'
                  : 'default'
              }
              size="xs"
            >
              {conversation.priority === 'urgent'
                ? (isEnglish ? 'Urgent' : 'Urgente')
                : conversation.priority === 'high'
                ? (isEnglish ? 'High' : 'Alta')
                : conversation.priority === 'medium'
                ? (isEnglish ? 'Medium' : 'Média')
                : (isEnglish ? 'Low' : 'Baixa')}
            </Badge>
          </div>
          {conversation.assignedToName && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{isEnglish ? 'Assigned to' : 'Atribuído'}</span>
              <span className="text-xs text-text-secondary">{conversation.assignedToName}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{isEnglish ? 'Started at' : 'Iniciado em'}</span>
            <span className="text-xs text-text-secondary">
              {format(
                new Date(conversation.createdAt),
                isEnglish ? "MM/dd/yy 'at' HH:mm" : "dd/MM/yy 'às' HH:mm",
                { locale: dateFnsLocale }
              )}
            </span>
          </div>
        </div>
      </Section>

      {/* Contact Details */}
      <Section title={isEnglish ? 'Contact' : 'Contato'}>
        <div className="space-y-2">
          {contact.email && (
            <div className="flex items-start gap-2">
              <Mail size={13} className="text-text-muted mt-0.5 shrink-0" />
              <span className="text-xs text-text-secondary break-all">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-text-muted shrink-0" />
              <span className="text-xs text-text-secondary">{contact.phone}</span>
            </div>
          )}
          {username && (
            <div className="flex items-center gap-2">
              <User size={13} className="text-text-muted shrink-0" />
              <span className="text-xs text-text-secondary">@{username}</span>
            </div>
          )}
          {!contact.email && !contact.phone && !username && (
            <p className="text-xs text-text-muted">{isEnglish ? 'No additional information' : 'Sem informações adicionais'}</p>
          )}
          <button className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-light transition-colors mt-2">
            <Plus size={12} />
            {isEnglish ? 'Add information' : 'Adicionar informação'}
          </button>
        </div>
      </Section>

      {/* Tags */}
      <Section title={isEnglish ? 'Tags' : 'Etiquetas'} defaultOpen={true}>
        <div className="flex flex-wrap gap-1.5">
          {conversation.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              <Tag size={9} />
              {tag.label}
            </span>
          ))}
          <button className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors px-2 py-0.5 border border-border border-dashed rounded-full">
            <Plus size={10} />
            {isEnglish ? 'Tag' : 'Tag'}
          </button>
        </div>
      </Section>

      {/* Notes */}
      <Section title={isEnglish ? 'Notes' : 'Notas'} defaultOpen={false}>
        {conversation.notes ? (
          <p className="text-xs text-text-secondary">{conversation.notes}</p>
        ) : (
          <button className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors">
            <Plus size={12} />
            {isEnglish ? 'Add note' : 'Adicionar nota'}
          </button>
        )}
      </Section>

      {/* Previous Conversations */}
      <Section title={isEnglish ? 'History' : 'Histórico'} defaultOpen={false}>
        <p className="text-xs text-text-muted">{isEnglish ? 'No previous conversations' : 'Nenhuma conversa anterior'}</p>
      </Section>
    </div>
  );
}

export default ContactPanel;
