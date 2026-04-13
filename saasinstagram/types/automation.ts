export type AutomationTriggerType =
  | 'new_conversation'
  | 'new_message'
  | 'keyword_match'
  | 'conversation_assigned'
  | 'conversation_resolved'
  | 'lead_status_change'
  | 'time_based'
  | 'no_agent_reply'
  | 'outside_business_hours';

export type AutomationActionType =
  | 'send_message'
  | 'send_template'
  | 'assign_agent'
  | 'add_tag'
  | 'remove_tag'
  | 'change_status'
  | 'create_lead'
  | 'update_lead'
  | 'ai_reply'
  | 'webhook'
  | 'wait'
  | 'notify_agent';

export type AutomationConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface AutomationCondition {
  id: string;
  field: string;       // e.g. "message.text", "contact.name", "conversation.channel"
  operator: AutomationConditionOperator;
  value?: string | number | boolean | string[];
  logicalOperator?: 'AND' | 'OR'; // how this condition connects to the next
}

export interface AutomationTrigger {
  type: AutomationTriggerType;
  conditions: AutomationCondition[];
  // For time_based triggers
  schedule?: {
    type: 'interval' | 'cron';
    interval?: number; // minutes
    cron?: string;
  };
  // For no_agent_reply
  delayMinutes?: number;
  // Channels this trigger applies to
  channels?: Array<'instagram' | 'facebook' | 'whatsapp'>;
}

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  order: number;
  // send_message
  message?: string;
  // send_template
  templateName?: string;
  templateParams?: string[];
  // assign_agent
  agentUid?: string;
  // add_tag / remove_tag
  tagId?: string;
  // change_status
  status?: string;
  // ai_reply
  aiSystemPrompt?: string;
  aiModel?: string;
  aiMaxTokens?: number;
  // webhook
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookBody?: string;
  // wait
  waitSeconds?: number;
  // notify_agent
  notifyAgentUid?: string;
  notifyMessage?: string;
}

export interface AutomationStats {
  totalTriggered: number;
  totalActionsExecuted: number;
  lastTriggeredAt?: string;
  successRate?: number;
}

export interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  stats: AutomationStats;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  workspaceId: string;
  conversationId?: string;
  triggeredAt: string;
  actionsExecuted: Array<{
    actionId: string;
    actionType: AutomationActionType;
    success: boolean;
    errorMessage?: string;
    executedAt: string;
  }>;
  status: 'success' | 'partial' | 'failed';
}
