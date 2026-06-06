import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Automation engine - processes automation queue.
 * Triggered when a new item is added to the automationQueue collection.
 */
export const runAutomation = functions
  .region('us-central1')
  .firestore.document('automationQueue/{queueId}')
  .onCreate(async (snap, context) => {
    const queueItem = snap.data();
    const { automationId, workspaceId, conversationId, messageId } = queueItem;

    try {
      // Mark as processing
      await snap.ref.update({ status: 'processing', startedAt: admin.firestore.FieldValue.serverTimestamp() });

      // Get automation
      const automationDoc = await db.collection('automations').doc(automationId).get();
      if (!automationDoc.exists || !automationDoc.data()?.isActive) {
        await snap.ref.update({ status: 'skipped', reason: 'automation_not_active' });
        return;
      }

      const automation = automationDoc.data()!;
      const actions = automation.actions as Array<Record<string, unknown>>;

      const actionsExecuted: Array<{
        actionId: string;
        actionType: string;
        success: boolean;
        errorMessage?: string;
        executedAt: string;
      }> = [];

      // Execute actions in order
      for (const action of actions) {
        const result = await executeAction(
          action,
          workspaceId,
          conversationId,
          queueItem.context
        );
        actionsExecuted.push({
          actionId: action.id as string,
          actionType: action.type as string,
          success: result.success,
          errorMessage: result.error,
          executedAt: new Date().toISOString(),
        });

        // If action has a wait, handle it
        if (action.type === 'wait' && typeof action.waitSeconds === 'number') {
          await sleep(Math.min((action.waitSeconds as number) * 1000, 540000)); // Max 9 minutes
        }
      }

      // Update automation stats
      await db.collection('automations').doc(automationId).update({
        'stats.totalTriggered': admin.firestore.FieldValue.increment(1),
        'stats.totalActionsExecuted': admin.firestore.FieldValue.increment(actionsExecuted.filter((a) => a.success).length),
        'stats.lastTriggeredAt': new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create log
      await db.collection('automationLogs').add({
        automationId,
        workspaceId,
        conversationId,
        triggeredAt: new Date().toISOString(),
        actionsExecuted,
        status: actionsExecuted.every((a) => a.success)
          ? 'success'
          : actionsExecuted.some((a) => a.success)
          ? 'partial'
          : 'failed',
      });

      // Mark queue item as completed
      await snap.ref.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        actionsExecuted,
      });

      functions.logger.info(`Automation ${automationId} executed for conversation ${conversationId}`);
    } catch (error) {
      functions.logger.error(`Automation ${automationId} failed:`, error);
      await snap.ref.update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

async function executeAction(
  action: Record<string, unknown>,
  workspaceId: string,
  conversationId: string,
  context: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'send_message': {
        if (!action.message) return { success: false, error: 'No message configured' };
        const text = interpolateVariables(action.message as string, context);
        await sendMessageToConversation(workspaceId, conversationId, text);
        return { success: true };
      }

      case 'ai_reply': {
        // This Cloud Functions path (automationQueue → aiQueue → aiResponder) is intentionally
        // disabled. aiResponder.ts never sends messages to customers (TODO: Send via Meta API).
        // The production AI path is: webhook → app/api/webhooks/meta/route.ts → runAiAutomationReply()
        return { success: true };
      }

      case 'assign_agent': {
        if (!action.agentUid) return { success: false, error: 'No agent configured' };

        // Get agent info
        const agentDoc = await admin.auth().getUser(action.agentUid as string).catch(() => null);
        const agentName = agentDoc?.displayName ?? agentDoc?.email ?? 'Agent';

        await db.collection('conversations').doc(conversationId).update({
          assignedTo: action.agentUid,
          assignedToName: agentName,
          updatedAt: new Date().toISOString(),
        });
        return { success: true };
      }

      case 'change_status': {
        if (!action.status) return { success: false, error: 'No status configured' };
        await db.collection('conversations').doc(conversationId).update({
          status: action.status,
          updatedAt: new Date().toISOString(),
          ...(action.status === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}),
        });
        return { success: true };
      }

      case 'add_tag': {
        if (!action.tagId) return { success: false, error: 'No tag configured' };
        const convDoc = await db.collection('conversations').doc(conversationId).get();
        const tags = convDoc.data()?.tags ?? [];
        if (!tags.find((t: Record<string, string>) => t.id === action.tagId)) {
          tags.push({ id: action.tagId, label: action.tagLabel ?? action.tagId, color: '#7c3aed' });
          await db.collection('conversations').doc(conversationId).update({
            tags,
            updatedAt: new Date().toISOString(),
          });
        }
        return { success: true };
      }

      case 'create_lead': {
        const convDoc = await db.collection('conversations').doc(conversationId).get();
        const conv = convDoc.data();
        if (!conv) return { success: false, error: 'Conversation not found' };

        const leadRef = db.collection('leads').doc();
        await leadRef.set({
          id: leadRef.id,
          workspaceId,
          name: conv.contact?.name ?? 'Novo Lead',
          status: 'new',
          source: conv.channel,
          conversationIds: [conversationId],
          tags: [],
          customFields: [],
          activities: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Link lead to conversation
        await db.collection('conversations').doc(conversationId).update({
          leadId: leadRef.id,
          updatedAt: new Date().toISOString(),
        });

        return { success: true };
      }

      case 'webhook': {
        if (!action.webhookUrl) return { success: false, error: 'No webhook URL' };

        const fetch = (await import('node-fetch')).default;
        const payload = {
          workspaceId,
          conversationId,
          event: 'automation_triggered',
          context,
          timestamp: new Date().toISOString(),
        };

        const response = await fetch(action.webhookUrl as string, {
          method: (action.webhookMethod as string) ?? 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(action.webhookHeaders as Record<string, string> ?? {}),
          },
          body: JSON.stringify(payload),
        });

        return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
      }

      case 'wait': {
        // Already handled in the main loop
        return { success: true };
      }

      default:
        functions.logger.warn(`Unknown action type: ${action.type}`);
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Execution failed';
    functions.logger.error(`Action ${action.type} failed:`, error);
    return { success: false, error: msg };
  }
}

async function sendMessageToConversation(
  workspaceId: string,
  conversationId: string,
  text: string
): Promise<void> {
  const msgRef = db.collection('messages').doc();
  const now = new Date().toISOString();

  const message = {
    id: msgRef.id,
    workspaceId,
    conversationId,
    direction: 'outbound',
    type: 'text',
    text,
    senderId: 'automation',
    senderName: 'Bot',
    senderType: 'bot',
    status: 'sent',
    generatedByAI: false,
    createdAt: now,
    sentAt: now,
  };

  await msgRef.set(message);

  // Update conversation
  await db.collection('conversations').doc(conversationId).update({
    lastMessage: {
      id: msgRef.id,
      text,
      timestamp: now,
      fromAgent: true,
      read: true,
    },
    updatedAt: now,
  });

  // TODO: Actually send via Meta API
  // This would require loading the channel access token and calling the Graph API
}

function interpolateVariables(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = path.split('.').reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, context);
    return value !== undefined ? String(value) : match;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
