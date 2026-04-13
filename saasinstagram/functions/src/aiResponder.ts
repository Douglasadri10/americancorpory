import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

const db = admin.firestore();

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = functions.config().openai?.api_key ?? process.env.OPENAI_API_KEY;
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getPreferredLanguageFallback(language?: unknown): string {
  if (typeof language === 'string' && language.toLowerCase().startsWith('en')) {
    return 'English (US)';
  }

  return 'Portuguese (Brazil)';
}

function buildReplyLanguageInstructions(language?: unknown): string {
  const fallbackLanguage = getPreferredLanguageFallback(language);

  return `Language rules:
- Detect the customer's preferred language from the conversation history, prioritizing the latest inbound message.
- Reply in the same language used by the customer.
- Preserve the language established by the customer's first message unless the customer clearly switches language or explicitly asks to use another language.
- Ignore any earlier instruction that tells you to always reply in a fixed language.
- Never say that you can only speak one language.
- If the customer's language is ambiguous, fall back to ${fallbackLanguage}.`;
}

/**
 * AI Responder - triggered when a new item is added to the aiQueue.
 * Generates an AI response and sends it to the conversation.
 */
export const generateAIResponse = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
  })
  .firestore.document('aiQueue/{queueId}')
  .onCreate(async (snap, context) => {
    const queueItem = snap.data();
    const { workspaceId, conversationId, systemPrompt, resolvedKnowledgeContext, model, maxTokens } = queueItem;

    try {
      await snap.ref.update({ status: 'processing', startedAt: admin.firestore.FieldValue.serverTimestamp() });

      // Get conversation
      const convDoc = await db.collection('conversations').doc(conversationId).get();
      if (!convDoc.exists) {
        await snap.ref.update({ status: 'failed', error: 'Conversation not found' });
        return;
      }

      const conversation = convDoc.data()!;

      // Get recent messages for context
      const messagesSnap = await db
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .orderBy('createdAt', 'asc')
        .limitToLast(20)
        .get();

      const messages = messagesSnap.docs.map((doc) => doc.data());

      // Build message history for OpenAI
      const messageHistory: OpenAI.Chat.ChatCompletionMessageParam[] = messages
        .filter((m) => m.text)
        .map((m) => ({
          role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text as string,
        }));

      // Get workspace settings for context
      const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
      const workspace = workspaceDoc.data();

      // Build system prompt
      const baseSystemPrompt = systemPrompt
        ?? workspace?.settings?.aiPersonality
        ?? workspace?.settings?.aiSystemPrompt
        ?? `You are a professional and friendly customer support assistant for ${workspace?.name ?? 'the company'}.
Be empathetic, helpful, and professional.
If you do not know the answer, say that you will verify it and hand the case to a human agent.`;

      const knowledgeSection = resolvedKnowledgeContext
        ? `\n\nRelevant knowledge for this conversation:\n${resolvedKnowledgeContext}`
        : '';

      const fullSystemPrompt = `${baseSystemPrompt}${knowledgeSection}

Mandatory language rules:
${buildReplyLanguageInstructions(workspace?.settings?.language)}

Topic guard and token efficiency:
- Stay within the scope of the company's products, services, and support topics.
- If the customer sends off-topic messages, respond briefly and redirect back to the business context.
- Never engage in extended off-topic exchanges — redirect after at most one brief acknowledgment.
- Keep replies concise; avoid repeating information already shared in the conversation.

Channel: ${conversation.channel}
Customer name: ${conversation.contact?.name ?? 'Customer'}
Conversation status: ${conversation.status}`;

      // Check AI usage limit
      const usage = workspace?.usage ?? {};
      const limits = workspace?.limits ?? {};
      if ((usage.aiMessagesThisMonth ?? 0) >= (limits.aiMessagesPerMonth ?? 0)) {
        functions.logger.warn(`AI limit reached for workspace ${workspaceId}`);
        await snap.ref.update({ status: 'failed', error: 'AI limit reached' });
        return;
      }

      // Generate response
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: model ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...messageHistory,
        ],
        max_tokens: maxTokens ?? 300,
        temperature: 0.7,
      });

      const aiText = response.choices[0]?.message?.content;
      if (!aiText) {
        await snap.ref.update({ status: 'failed', error: 'Empty AI response' });
        return;
      }

      const now = new Date().toISOString();

      // Save AI message
      const msgRef = db.collection('messages').doc();
      await msgRef.set({
        id: msgRef.id,
        workspaceId,
        conversationId,
        direction: 'outbound',
        type: 'text',
        text: aiText,
        senderId: 'ai',
        senderName: 'AI Assistant',
        senderType: 'bot',
        status: 'sent',
        generatedByAI: true,
        aiModelUsed: response.model,
        aiPromptTokens: response.usage?.prompt_tokens,
        aiCompletionTokens: response.usage?.completion_tokens,
        createdAt: now,
        sentAt: now,
      });

      // Update conversation
      await db.collection('conversations').doc(conversationId).update({
        lastMessage: {
          id: msgRef.id,
          text: aiText,
          timestamp: now,
          fromAgent: true,
          read: true,
        },
        updatedAt: now,
      });

      // Increment AI usage
      await db.collection('workspaces').doc(workspaceId).update({
        'usage.aiMessagesThisMonth': admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });

      // TODO: Send via Meta API

      await snap.ref.update({
        status: 'completed',
        messageId: msgRef.id,
        tokenUsage: response.usage?.total_tokens,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`AI response generated for conversation ${conversationId}`);
    } catch (error) {
      functions.logger.error(`AI response generation failed for ${conversationId}:`, error);
      await snap.ref.update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
