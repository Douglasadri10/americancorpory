"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMessageStatus = exports.processIncomingMessage = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Triggered when a new message is created in Firestore.
 * Processes the message: runs automations, updates conversation stats.
 */
exports.processIncomingMessage = functions
    .region('us-central1')
    .firestore.document('messages/{messageId}')
    .onCreate(async (snap, context) => {
    const message = snap.data();
    // Only process inbound messages
    if (message.direction !== 'inbound')
        return;
    const { workspaceId, conversationId } = message;
    try {
        // Get the conversation
        const convDoc = await db.collection('conversations').doc(conversationId).get();
        if (!convDoc.exists)
            return;
        const conversation = convDoc.data();
        // Update workspace usage counter
        await db.collection('workspaces').doc(workspaceId).update({
            'usage.conversationsThisMonth': admin.firestore.FieldValue.increment(1),
            updatedAt: new Date().toISOString(),
        });
        // Check and run automations
        await runAutomationsForMessage(workspaceId, conversation, message);
        functions.logger.info(`Processed message ${context.params.messageId} for conversation ${conversationId}`);
    }
    catch (error) {
        functions.logger.error(`Error processing message ${context.params.messageId}:`, error);
    }
});
/**
 * Triggered when a message document is updated.
 * Handles status updates (delivered, read, etc.)
 */
exports.updateMessageStatus = functions
    .region('us-central1')
    .firestore.document('messages/{messageId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Only handle status changes
    if (before.status === after.status)
        return;
    functions.logger.info(`Message ${context.params.messageId} status: ${before.status} -> ${after.status}`);
});
async function runAutomationsForMessage(workspaceId, conversation, message) {
    // Get active automations for this workspace
    const automationsSnap = await db
        .collection('automations')
        .where('workspaceId', '==', workspaceId)
        .where('isActive', '==', true)
        .get();
    if (automationsSnap.empty)
        return;
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
        if (!triggerMatches(automation.trigger, context, 'new_message'))
            continue;
        // Evaluate conditions
        if (!evaluateConditions(automation.trigger.conditions ?? [], context))
            continue;
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
function triggerMatches(trigger, context, eventType) {
    return trigger.type === eventType;
}
function evaluateConditions(conditions, context) {
    if (conditions.length === 0)
        return true;
    let result = true;
    let logicalOp = 'AND';
    for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        const fieldValue = getFieldValue(context, condition.field);
        const matches = evaluateCondition(fieldValue, condition.operator, condition.value);
        if (i === 0) {
            result = matches;
        }
        else {
            if (logicalOp === 'AND') {
                result = result && matches;
            }
            else {
                result = result || matches;
            }
        }
        logicalOp = condition.logicalOperator ?? 'AND';
    }
    return result;
}
function getFieldValue(context, field) {
    return field.split('.').reduce((obj, key) => {
        if (obj && typeof obj === 'object') {
            return obj[key];
        }
        return undefined;
    }, context);
}
function evaluateCondition(value, operator, conditionValue) {
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
//# sourceMappingURL=messageProcessor.js.map