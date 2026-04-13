import React from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { Check, CheckCheck, Clock, AlertCircle, Sparkles, Image, Video, FileText, MapPin, Mic } from 'lucide-react';
import type { Message } from '@/types/message';
import { useWorkspaceLocale } from '@/components/providers/WorkspaceLocaleProvider';

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  contactName?: string;
  contactAvatar?: string;
}

const StatusIcon = ({ status }: { status: Message['status'] }) => {
  switch (status) {
    case 'sending':
      return <Clock size={10} className="text-text-muted" />;
    case 'sent':
      return <Check size={10} className="text-text-muted" />;
    case 'delivered':
      return <CheckCheck size={10} className="text-text-muted" />;
    case 'read':
      return <CheckCheck size={10} className="text-accent" />;
    case 'failed':
      return <AlertCircle size={10} className="text-danger" />;
    default:
      return null;
  }
};

const MediaPreview = ({ message }: { message: Message }) => {
  if (!message.media) return null;

  switch (message.type) {
    case 'image':
      return (
        <div className="max-w-[240px] rounded-lg overflow-hidden mb-1">
          {message.media.url ? (
            <img
              src={message.media.url}
              alt={message.media.caption ?? 'Imagem'}
              className="w-full object-cover"
            />
          ) : (
            <div className="w-48 h-36 bg-surface flex items-center justify-center rounded-lg">
              <Image size={32} className="text-text-muted" />
            </div>
          )}
          {message.media.caption && (
            <p className="text-xs mt-1 text-text-secondary">{message.media.caption}</p>
          )}
        </div>
      );
    case 'video':
      return (
        <div className="max-w-[240px] rounded-lg overflow-hidden mb-1">
          {message.media.url ? (
            <video
              src={message.media.url}
              controls
              className="w-full rounded-lg"
            />
          ) : (
            <div className="w-48 h-36 bg-surface flex items-center justify-center rounded-lg">
              <Video size={32} className="text-text-muted" />
            </div>
          )}
          {message.media.caption && (
            <p className="text-xs mt-1 text-text-secondary">{message.media.caption}</p>
          )}
        </div>
      );
    case 'audio':
      return (
        <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 mb-1">
          <Mic size={16} className="text-text-secondary" />
          {message.media.url ? (
            <audio src={message.media.url} controls className="h-8 w-40" />
          ) : (
            <span className="text-xs text-text-muted">Áudio</span>
          )}
        </div>
      );
    case 'file':
      return (
        <a
          href={message.media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 mb-1 hover:bg-surface transition-colors"
        >
          <FileText size={16} className="text-accent" />
          <div>
            <p className="text-xs font-medium text-text-primary">
              {message.media.fileName ?? 'Arquivo'}
            </p>
            {message.media.fileSize && (
              <p className="text-xs text-text-muted">
                {Math.round(message.media.fileSize / 1024)} KB
              </p>
            )}
          </div>
        </a>
      );
    case 'location':
      return (
        <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 mb-1">
          <MapPin size={16} className="text-danger" />
          <div>
            <p className="text-xs font-medium text-text-primary">Localização</p>
            {message.location?.address && (
              <p className="text-xs text-text-muted">{message.location.address}</p>
            )}
          </div>
        </div>
      );
    default:
      return null;
  }
};

export function MessageBubble({
  message,
  showAvatar = true,
  contactName,
  contactAvatar,
}: MessageBubbleProps) {
  const { isEnglish, dateFnsLocale } = useWorkspaceLocale();
  const isOutbound = message.direction === 'outbound';
  const isBot = message.senderType === 'bot';

  const timestamp = message.createdAt
    ? format(new Date(message.createdAt), 'HH:mm', { locale: dateFnsLocale })
    : '';

  return (
    <div
      className={clsx(
        'flex gap-2 group',
        isOutbound ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {showAvatar && !isOutbound ? (
        <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 self-end overflow-hidden">
          {contactAvatar ? (
            <img
              src={contactAvatar}
              alt={contactName ?? (isEnglish ? 'Contact' : 'Contato')}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-medium text-text-secondary">
              {(contactName ?? 'C')[0].toUpperCase()}
            </span>
          )}
        </div>
      ) : showAvatar && isOutbound ? (
        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 self-end">
          {isBot ? (
            <Sparkles size={12} className="text-accent" />
          ) : (
            <span className="text-xs font-medium text-accent">
              {message.senderName[0]?.toUpperCase() ?? 'A'}
            </span>
          )}
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      {/* Bubble */}
      <div className={clsx('flex flex-col max-w-[70%]', isOutbound ? 'items-end' : 'items-start')}>
        {/* Sender name (for inbound) */}
        {!isOutbound && showAvatar && (
          <span className="text-xs text-text-muted mb-1 px-1">{contactName ?? (isEnglish ? 'Contact' : 'Contato')}</span>
        )}

        {/* AI indicator */}
        {isBot && isOutbound && (
          <div className="flex items-center gap-1 mb-1 px-1">
            <Sparkles size={10} className="text-accent" />
            <span className="text-xs text-accent">{isEnglish ? 'AI reply' : 'Resposta IA'}</span>
          </div>
        )}

        {/* Message content */}
        <div
          className={clsx(
            'rounded-2xl px-3 py-2 text-sm',
            isOutbound
              ? isBot
                ? 'bg-accent/80 text-white rounded-br-sm'
                : 'bg-accent text-white rounded-br-sm'
              : 'bg-surface text-text-primary rounded-bl-sm',
            message.type === 'unsupported' && 'opacity-60 italic'
          )}
        >
          {/* Media preview */}
          <MediaPreview message={message} />

          {/* Text */}
          {message.text && (
            <p className="whitespace-pre-wrap break-words leading-relaxed">
              {message.type === 'unsupported' ? (isEnglish ? 'Unsupported message type' : 'Tipo de mensagem não suportado') : message.text}
            </p>
          )}

          {/* Reaction */}
          {message.type === 'reaction' && message.reaction && (
            <p className="text-2xl">{message.reaction.emoji}</p>
          )}
        </div>

        {/* Timestamp + Status */}
        <div
          className={clsx(
            'flex items-center gap-1 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity',
            isOutbound ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <span className="text-xs text-text-muted">{timestamp}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
