import type { Firestore } from 'firebase-admin/firestore';
import type { Conversation } from '@/types/conversation';
import type { Automation, AutomationAction, AutomationCondition } from '@/types/automation';
import {
  buildReplyLanguageInstructions,
  DEFAULT_AI_SYSTEM_PROMPT,
} from '@/lib/openai/prompts';

export interface AutomationRuntimeContext {
  contact: {
    id?: string;
    name?: string;
    username?: string;
  };
  conversation: {
    channel: Conversation['channel'];
    status: Conversation['status'];
  };
  message: {
    direction: 'inbound';
    text: string;
    type: 'text';
  };
}

export interface AiAutomationMatch {
  action: AutomationAction;
  automation: Automation;
  context: AutomationRuntimeContext;
}

function getFieldValue(context: Record<string, unknown>, field: string): unknown {
  return field.split('.').reduce((obj: unknown, key: string) => {
    if (obj && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

function evaluateCondition(value: unknown, operator: string, conditionValue: unknown): boolean {
  const strValue = String(value ?? '').toLowerCase();
  const strCondition = String(conditionValue ?? '').toLowerCase();

  switch (operator) {
    case 'equals':
      return strValue === strCondition;
    case 'not_equals':
      return strValue !== strCondition;
    case 'contains':
      return strValue.includes(strCondition);
    case 'not_contains':
      return !strValue.includes(strCondition);
    case 'starts_with':
      return strValue.startsWith(strCondition);
    case 'ends_with':
      return strValue.endsWith(strCondition);
    case 'is_empty':
      return !value || strValue === '';
    case 'is_not_empty':
      return !!value && strValue !== '';
    default:
      return false;
  }
}

function evaluateConditions(
  conditions: AutomationCondition[],
  context: AutomationRuntimeContext
) {
  if (conditions.length === 0) {
    return true;
  }

  let result = true;
  let logicalOp: 'AND' | 'OR' = 'AND';

  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index];
    const fieldValue = getFieldValue(context as unknown as Record<string, unknown>, condition.field);
    const matches = evaluateCondition(fieldValue, condition.operator, condition.value);

    if (index === 0) {
      result = matches;
    } else if (logicalOp === 'AND') {
      result = result && matches;
    } else {
      result = result || matches;
    }

    logicalOp = condition.logicalOperator ?? 'AND';
  }

  return result;
}

export function buildAutomationContext(params: {
  conversation: Conversation;
  incomingText: string;
}): AutomationRuntimeContext {
  return {
    message: {
      text: params.incomingText,
      type: 'text',
      direction: 'inbound',
    },
    conversation: {
      channel: params.conversation.channel,
      status: params.conversation.status,
    },
    contact: {
      id: params.conversation.contact.id,
      name: params.conversation.contact.name,
      username: params.conversation.contact.username,
    },
  };
}

export async function findMatchingAiAutomation(params: {
  channel: Conversation['channel'];
  conversation: Conversation;
  db: Firestore;
  incomingText: string;
  workspaceId: string;
}) {
  const snap = await params.db
    .collection('automations')
    .where('workspaceId', '==', params.workspaceId)
    .where('isActive', '==', true)
    .get();

  if (snap.empty) {
    return null;
  }

  const context = buildAutomationContext({
    conversation: params.conversation,
    incomingText: params.incomingText,
  });

  const automations = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Automation)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  for (const automation of automations) {
    if (automation.trigger.type !== 'new_message') {
      continue;
    }

    const channels = automation.trigger.channels ?? ['instagram', 'facebook', 'whatsapp'];
    if (!channels.includes(params.channel)) {
      continue;
    }

    if (!evaluateConditions(automation.trigger.conditions ?? [], context)) {
      continue;
    }

    const aiAction = [...automation.actions]
      .sort((left, right) => left.order - right.order)
      .find((action) => action.type === 'ai_reply');

    if (!aiAction) {
      continue;
    }

    return {
      automation,
      action: aiAction,
      context,
    } satisfies AiAutomationMatch;
  }

  return null;
}

export async function findMatchingSendMessageAutomation(params: {
  channel: Conversation['channel'];
  conversation: Conversation;
  db: Firestore;
  incomingText: string;
  workspaceId: string;
}) {
  const snap = await params.db
    .collection('automations')
    .where('workspaceId', '==', params.workspaceId)
    .where('isActive', '==', true)
    .get();

  if (snap.empty) {
    return null;
  }

  const context = buildAutomationContext({
    conversation: params.conversation,
    incomingText: params.incomingText,
  });

  const automations = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Automation)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  for (const automation of automations) {
    if (automation.trigger.type !== 'new_message') {
      continue;
    }

    const channels = automation.trigger.channels ?? ['instagram', 'facebook', 'whatsapp'];
    if (!channels.includes(params.channel)) {
      continue;
    }

    if (!evaluateConditions(automation.trigger.conditions ?? [], context)) {
      continue;
    }

    const sendAction = [...automation.actions]
      .sort((left, right) => left.order - right.order)
      .find((action) => action.type === 'send_message');

    if (!sendAction) {
      continue;
    }

    return { automation, action: sendAction, context };
  }

  return null;
}

export function buildAutomationSystemPrompt(params: {
  action?: AutomationAction;
  channel: Conversation['channel'];
  contactName?: string;
  fallbackPrompt?: string;
  knowledgeContext?: string;
  workspaceLanguage?: string;
  workspaceName?: string;
}) {
  const basePrompt =
    params.action?.aiSystemPrompt?.trim() ||
    params.fallbackPrompt?.trim() ||
    DEFAULT_AI_SYSTEM_PROMPT;

  const channelNames: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook Messenger',
    whatsapp: 'WhatsApp',
  };

  const sections = [
    // 1. Identidade da empresa
    params.workspaceName
      ? `You represent the company "${params.workspaceName}".`
      : '',

    // 2. Conhecimento — antes das regras, o LLM lê os fatos antes de "não invente"
    params.knowledgeContext?.trim()
      ? `## Knowledge base\nUse the information below to answer the customer. Do not invent facts not present here.\n\n${params.knowledgeContext.trim()}`
      : '',

    // 3. Persona / instruções base
    basePrompt,

    // 4. Regras comportamentais
    `## Conversation rules
- Do not repeat a greeting in every message.
- Do not send generic replies without moving the conversation forward.
- Ask at most one qualifying question per reply.
- If the conversation has already started, continue from the current point instead of restarting it.
- Stay strictly within the scope of the company's products, services, and support topics.
- If the customer sends off-topic messages, respond briefly and naturally redirect to the business context after at most one brief acknowledgment.
- Keep replies concise; avoid repeating information already shared.
- Do not speculate, invent facts, or go beyond what the company has authorized you to discuss.`,

    // 5. Linguagem — por último, recency bias garante que esta regra prevaleça
    buildReplyLanguageInstructions(params.workspaceLanguage),

    // 6. Metadata de sessão
    [
      `Channel: ${channelNames[params.channel] ?? params.channel}`,
      params.contactName ? `Customer name: ${params.contactName}` : '',
    ].filter(Boolean).join('\n'),
  ].filter(Boolean);

  return sections.join('\n\n');
}
