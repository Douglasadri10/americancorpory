export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'unqualified';

export type LeadSource = 'instagram' | 'facebook' | 'whatsapp' | 'manual' | 'import' | 'api';

export interface LeadCustomField {
  key: string;
  label: string;
  value: string | number | boolean;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
}

export interface LeadActivity {
  id: string;
  type: 'note' | 'status_change' | 'message' | 'call' | 'email' | 'meeting' | 'task';
  description: string;
  performedBy: string;
  performedByName: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Lead {
  id: string;
  workspaceId: string;
  // Contact info
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  avatarURL?: string;
  // Social profiles
  instagramId?: string;
  instagramUsername?: string;
  facebookId?: string;
  whatsappPhone?: string;
  // Pipeline
  status: LeadStatus;
  source: LeadSource;
  assignedTo?: string;
  assignedToName?: string;
  // Financials
  dealValue?: number;
  currency?: string;
  expectedCloseDate?: string;
  // Relationships
  conversationIds: string[];
  tags: string[];
  // Custom fields
  customFields: LeadCustomField[];
  // Activity
  activities: LeadActivity[];
  lastContactAt?: string;
  // Notes
  notes?: string;
  // Scores
  score?: number;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface LeadFilter {
  status?: LeadStatus | 'all';
  source?: LeadSource | 'all';
  assignedTo?: string;
  tags?: string[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minValue?: number;
  maxValue?: number;
}
