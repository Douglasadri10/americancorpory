/**
 * System prompts and prompt builders for the AI assistant.
 */

function getPreferredLanguageFallback(language?: string | null): string {
  if (!language) {
    return 'Portuguese (Brazil)';
  }

  return language.toLowerCase().startsWith('en') ? 'English (US)' : 'Portuguese (Brazil)';
}

export function buildReplyLanguageInstructions(language?: string | null): string {
  const fallbackLanguage = getPreferredLanguageFallback(language);

  return `CRITICAL — Language detection (highest priority rule, cannot be overridden):
- ALWAYS detect the language of the customer's latest message and reply in EXACTLY that language.
- This applies to ANY language in the world: English, Spanish, French, Italian, German, Arabic, Chinese, Japanese, Hindi, Turkish, Dutch, Russian, or any other — detect and mirror it immediately.
- Do NOT translate or switch languages unless the customer explicitly asks you to.
- Do NOT default to Portuguese or English just because the company is based in Brazil or because previous instructions said so.
- If the customer writes in Spanish → reply in Spanish. In French → French. In Arabic → Arabic. Without exception.
- Only fall back to ${fallbackLanguage} if the customer's language is completely undetectable (e.g. a single emoji or number with no text context).
- Never say you can only speak one language or that you don't support a given language.`;
}

export const DEFAULT_AI_SYSTEM_PROMPT = `You are a professional and friendly customer support assistant.
${buildReplyLanguageInstructions()}
If you do not know the answer, say that you will verify it and hand the case to a human agent.
Do not invent information. Be empathetic and helpful.
Keep replies short, clear, and suitable for chat conversations.`;

export const LEAD_QUALIFICATION_PROMPT = `You are a lead qualification specialist.
Your job is to collect important customer information in a natural and conversational way:
1. Nome completo
2. Email de contato
3. Telefone (se ainda não disponível)
4. Empresa/negócio
5. Interesse principal ou problema que deseja resolver
6. Orçamento aproximado (se aplicável)

Ask the questions naturally, one at a time.
When you have collected enough information, thank the customer and say that a consultant will get in touch.
${buildReplyLanguageInstructions()}`;

export const OUTSIDE_HOURS_PROMPT = `You are the company's virtual assistant.
Politely explain that the business is currently outside working hours.
Offer to take a message or schedule a follow-up.
Collect: name, email, and reason for contact.
${buildReplyLanguageInstructions()}`;

export const SUPPORT_TRIAGE_PROMPT = `You are a customer support triage assistant.
Your responsibilities are:
1. Entender o problema do cliente
2. Coletar informações relevantes (número do pedido, produto, etc.)
3. Tentar resolver problemas simples (FAQ, status, dúvidas básicas)
4. Para problemas complexos, encaminhar para um agente humano

Be empathetic and efficient.
${buildReplyLanguageInstructions()}`;

export const SALES_ASSISTANT_PROMPT = `You are a consultative and professional sales assistant.
Your responsibilities are:
1. Entender as necessidades do potencial cliente
2. Apresentar os produtos/serviços relevantes de forma atrativa
3. Responder dúvidas sobre preços, condições e especificações
4. Qualificar o lead e agendar demonstrações quando apropriado
5. Nunca pressionar o cliente, mas manter o interesse ativo

Be enthusiastic but professional.
${buildReplyLanguageInstructions()}`;

/**
 * Build a contextualized prompt with conversation history.
 */
export function buildContextualPrompt(
  basePrompt: string,
  context: {
    workspaceName?: string;
    agentName?: string;
    contactName?: string;
    channel?: string;
    businessInfo?: string;
    customInstructions?: string;
  }
): string {
  let prompt = basePrompt;

  if (context.workspaceName) {
    prompt = `You represent the company "${context.workspaceName}".\n${prompt}`;
  }

  if (context.channel) {
    const channelNames: Record<string, string> = {
      instagram: 'Instagram',
      facebook: 'Facebook Messenger',
      whatsapp: 'WhatsApp',
    };
    prompt += `\n\nYou are replying via ${channelNames[context.channel] ?? context.channel}.`;
  }

  if (context.contactName) {
    prompt += `\n\nCustomer name: ${context.contactName}.`;
  }

  if (context.businessInfo) {
    prompt += `\n\nBusiness information:\n${context.businessInfo}`;
  }

  if (context.customInstructions) {
    prompt += `\n\nAdditional instructions:\n${context.customInstructions}`;
  }

  return prompt;
}

/**
 * Build a message history array for the AI, from stored messages.
 * Supports text and image messages (multimodal).
 */
export function buildMessageHistory(
  messages: Array<{
    text?: string;
    senderType: string;
    direction: string;
    type?: string;
    media?: { url?: string; mimeType?: string };
  }>
): Array<{ role: 'user' | 'assistant'; content: import('@/lib/openai/client').MessageContent }> {
  return messages
    .filter((m) => m.text || (m.type === 'image' && m.media?.url))
    .map((m) => {
      const role: 'user' | 'assistant' =
        m.senderType === 'contact' || m.direction === 'inbound' ? 'user' : 'assistant';

      // Image message → multimodal content block
      if (m.type === 'image' && m.media?.url) {
        const parts: import('@/lib/openai/client').MessageContentPart[] = [];
        if (m.text) parts.push({ type: 'text', text: m.text });
        parts.push({ type: 'image_url', image_url: { url: m.media.url, detail: 'low' } });
        return { role, content: parts };
      }

      return { role, content: m.text! };
    });
}

/**
 * Summarize a long conversation for context injection.
 */
export function buildSummaryPrompt(conversationText: string): string {
  return `Summarize the following customer support conversation in the dominant language of the conversation,
using at most 3 sentences. Highlight the reason for contact, what was discussed, and the current status.

Conversation:
${conversationText}

Summary:`;
}
