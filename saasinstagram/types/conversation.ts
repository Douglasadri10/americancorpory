export type Channel = 'instagram' | 'facebook' | 'whatsapp';
export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'spam';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ConversationParticipant {
  id: string;           // External platform user ID
  name: string;
  username?: string;
  avatarURL?: string;
  profileURL?: string;
  phone?: string;
  email?: string;
}

export interface ConversationTag {
  id: string;
  label: string;
  color: string;
}

export interface ConversationLastMessage {
  id: string;
  text: string;
  timestamp: string;
  fromAgent: boolean;
  read: boolean;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  channel: Channel;
  // The channel account ID (e.g. Instagram Business Account ID)
  channelAccountId: string;
  // The page/account display info
  channelAccountName?: string;
  // External thread / conversation ID from Meta
  externalId?: string;
  // The contact on the other end
  contact: ConversationParticipant;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedTo?: string;       // agent uid
  assignedToName?: string;
  tags: ConversationTag[];
  lastMessage?: ConversationLastMessage;
  unreadCount: number;
  // AI automation
  aiEnabled: boolean;
  aiHandoffRequested: boolean;
  // Metadata
  source?: string;   // e.g. "comment_reply", "dm", "chatbot"
  notes?: string;
  customFields?: Record<string, string | number | boolean>;
  // Lead linkage
  leadId?: string;
  // AI interaction tracking — "YYYY-MM" of the last month where AI replied in this conversation
  // Used to count unique interactions per month without a monthly reset job
  aiInteractionMonth?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ConversationFilter {
  status?: ConversationStatus | 'all';
  channel?: Channel | 'all';
  assignedTo?: string | 'me' | 'unassigned';
  priority?: ConversationPriority;
  tags?: string[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
