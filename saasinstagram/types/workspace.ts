export type PlanId = 'free' | 'starter' | 'pro' | 'business';

export type WorkspaceMemberRole = 'owner' | 'admin' | 'agent' | 'viewer';

export interface WorkspaceMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: WorkspaceMemberRole;
  joinedAt: string; // ISO date string
  invitedBy?: string;
  isActive: boolean;
}

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

export interface WorkspaceSettings {
  timezone: string;
  language: string;
  aiEnabled?: boolean;
  aiPersonality?: string;
  aiModel?: string;
  businessHours?: {
    enabled: boolean;
    schedule: {
      [day: string]: { open: string; close: string; enabled: boolean };
    };
    outsideHoursMessage?: string;
  };
  autoAssignment?: {
    enabled: boolean;
    strategy: 'round_robin' | 'least_busy' | 'random';
  };
  notifications?: {
    newConversation: boolean;
    newMessage: boolean;
    assignedToMe: boolean;
  };
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
  members: WorkspaceMember[];
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
    lastResetAt: string;
  };
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: WorkspaceMemberRole;
  invitedBy: string;
  invitedByName: string;
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}
