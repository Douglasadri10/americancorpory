export type PlanId = 'free' | 'starter' | 'pro' | 'business';

export interface WorkspacePlan {
  id: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: string;
}

export interface WorkspaceLimits {
  maxChannels: number;
  maxAutomations: number;   // -1 = unlimited
  aiMessagesPerMonth: number;
  aiInteractionsPerMonth: number; // -1 = unlimited
}

export interface WorkspaceAlertChannels {
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
}

export interface WorkspaceAlertRecipients {
  email?: string;
  phone?: string;
}

export interface WorkspaceAlertEvents {
  accountCreated: boolean;
  leadWon: boolean;
  supportTicketOpened: boolean;
}

export interface WorkspaceNotificationSettings {
  newConversation: boolean;
  newMessage: boolean;
  alertChannels?: WorkspaceAlertChannels;
  alertRecipients?: WorkspaceAlertRecipients;
  alertEvents?: WorkspaceAlertEvents;
}

export interface WorkspaceSettings {
  timezone: string;
  language: string;
  aiEnabled?: boolean;
  translationEnabled?: boolean;
  aiPersonality?: string;
  aiModel?: string;
  businessHours?: {
    enabled: boolean;
    schedule: {
      [day: string]: { open: string; close: string; enabled: boolean };
    };
    outsideHoursMessage?: string;
  };
  notifications?: WorkspaceNotificationSettings;
}

export interface GoogleCalendarIntegration {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  calendarId: string;
  connectedEmail: string;
  connectedAt: string;
}

export interface WorkspaceIntegrations {
  googleCalendar?: GoogleCalendarIntegration | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoURL?: string;
  ownerUid: string;
  plan: WorkspacePlan;
  limits: WorkspaceLimits;
  settings: WorkspaceSettings;
  integrations?: WorkspaceIntegrations;
  createdAt: string;
  updatedAt: string;
  // Usage counters (reset monthly)
  usage: {
    conversationsThisMonth: number;
    aiMessagesThisMonth: number;
    aiInteractionsThisMonth: number;
    aiInputTokensTotal?: number;
    aiOutputTokensTotal?: number;
    aiTokensTotal?: number;
    aiLastTokenUsageAt?: string;
    lastResetAt: string;
  };
}
