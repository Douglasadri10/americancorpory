import type { ConversationParticipant } from '@/types/conversation';

const PLACEHOLDER_PATTERNS = [
  /^contact\s+/i,
  /^contato\s+/i,
  /^user_[a-z0-9]+$/i,
];

// Instagram/Facebook IDs are always numeric. Alphabetic-only IDs are template placeholders.
function isPlaceholderContactId(id?: string | null): boolean {
  if (!id) return true;
  return /^[a-z_{}#]+$/i.test(id);
}

export function isPlaceholderContactName(name?: string | null) {
  const normalized = name?.trim();
  if (!normalized) {
    return true;
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function normalizeContactUsername(username?: string | null) {
  const normalized = username?.trim().replace(/^@+/, '');
  return normalized || undefined;
}

export function getContactDisplayName(contact?: Partial<ConversationParticipant> | null) {
  if (!contact) {
    return 'Contato';
  }

  const normalizedName = contact.name?.trim();
  if (normalizedName && !isPlaceholderContactName(normalizedName)) {
    return normalizedName;
  }

  const username = normalizeContactUsername(contact.username);
  if (username) {
    return `@${username}`;
  }

  const shortId = contact.id?.slice(-6);
  if (shortId && !isPlaceholderContactId(contact.id)) {
    return `#${shortId}`;
  }

  return 'Contato';
}

export function getContactInitial(contact?: Partial<ConversationParticipant> | null) {
  const displayName = getContactDisplayName(contact);
  return displayName.charAt(0).toUpperCase();
}
