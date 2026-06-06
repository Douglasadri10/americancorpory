import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Triggered when a new message is created in Firestore.
 * Processes the message: runs automations, updates conversation stats.
 */
export const processIncomingMessage = functions
  .region('us-central1')
  .firestore.document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();

    // Only process inbound messages
    if (message.direction !== 'inbound') return;

    const { workspaceId, conversationId } = message;

    try {
      // Get the conversation
      const convDoc = await db.collection('conversations').doc(conversationId).get();
      if (!convDoc.exists) return;

      const conversation = convDoc.data()!;

      // Update workspace usage counter
      await db.collection('workspaces').doc(workspaceId).update({
        'usage.conversationsThisMonth': admin.firestore.FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });

      // Skip all automations if the user disabled them for this conversation
      if (conversation.aiHandoffRequested === true) {
        functions.logger.info(`Automations skipped for conversation ${conversationId}: disabled by user`);
        return;
      }

      // Check and run automations
      await runAutomationsForMessage(workspaceId, conversation, message);

      functions.logger.info(`Processed message ${context.params.messageId} for conversation ${conversationId}`);
    } catch (error) {
      functions.logger.error(`Error processing message ${context.params.messageId}:`, error);
    }
  });

/**
 * Triggered when a message document is updated.
 * Handles status updates (delivered, read, etc.)
 */
export const updateMessageStatus = functions
  .region('us-central1')
  .firestore.document('messages/{messageId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only handle status changes
    if (before.status === after.status) return;

    functions.logger.info(
      `Message ${context.params.messageId} status: ${before.status} -> ${after.status}`
    );
  });

async function runAutomationsForMessage(
  workspaceId: string,
  conversation: admin.firestore.DocumentData,
  message: admin.firestore.DocumentData
): Promise<void> {
  // Get active automations for this workspace
  const automationsSnap = await db
    .collection('automations')
    .where('workspaceId', '==', workspaceId)
    .where('isActive', '==', true)
    .get();

  if (automationsSnap.empty) return;

  const context = {
    message: {
      text: message.text ?? '',
      type: message.type,
      direction: message.direction,
    },
    conversation: {
      channel: conversation.channel,
      status: conversation.status,
      assignedTo: conversation.assignedTo,
    },
    contact: {
      id: conversation.contact?.id,
      name: conversation.contact?.name,
    },
  };

  for (const doc of automationsSnap.docs) {
    const automation = doc.data();

    // Check if trigger matches
    if (!triggerMatches(automation.trigger, context, 'new_message')) continue;

    // Evaluate conditions
    if (!evaluateConditions(automation.trigger.conditions ?? [], context)) continue;

    // Queue automation execution
    await db.collection('automationQueue').add({
      automationId: doc.id,
      workspaceId,
      conversationId: conversation.id ?? message.conversationId,
      messageId: message.id,
      context,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

function triggerMatches(
  trigger: Record<string, unknown>,
  context: Record<string, unknown>,
  eventType: string
): boolean {
  return trigger.type === eventType;
}

function evaluateConditions(
  conditions: Array<{
    field: string;
    operator: string;
    value?: unknown;
    logicalOperator?: 'AND' | 'OR';
  }>,
  context: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true;

  let result = true;
  let logicalOp: 'AND' | 'OR' = 'AND';

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const fieldValue = getFieldValue(context, condition.field);
    const matches = evaluateCondition(fieldValue, condition.operator, condition.value);

    if (i === 0) {
      result = matches;
    } else {
      if (logicalOp === 'AND') {
        result = result && matches;
      } else {
        result = result || matches;
      }
    }

    logicalOp = condition.logicalOperator ?? 'AND';
  }

  return result;
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
    case 'equals': return strValue === strCondition;
    case 'not_equals': return strValue !== strCondition;
    case 'contains': return strValue.includes(strCondition);
    case 'not_contains': return !strValue.includes(strCondition);
    case 'starts_with': return strValue.startsWith(strCondition);
    case 'ends_with': return strValue.endsWith(strCondition);
    case 'is_empty': return !value || strValue === '';
    case 'is_not_empty': return !!value && strValue !== '';
    default: return false;
  }
}
