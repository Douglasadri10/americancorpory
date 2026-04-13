/**
 * HannaAI Firebase Cloud Functions
 * Entry point - exports all functions
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export all functions
export { webhookMeta } from './webhookMeta';
export { processIncomingMessage, updateMessageStatus } from './messageProcessor';
export { runAutomation } from './automationEngine';
export { generateAIResponse } from './aiResponder';
export { stripeWebhook } from './stripeWebhook';
