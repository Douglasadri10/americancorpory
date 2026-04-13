export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportTicketCategory = 'billing' | 'technical' | 'feature_request' | 'general';

export interface SupportMessage {
  id: string;
  text: string;
  senderType: 'user' | 'support';
  senderName: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  workspaceId: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}
