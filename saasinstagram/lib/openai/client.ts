import OpenAI, { toFile } from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Multimodal content: a message can be plain text OR an array of parts
// (text + image_url blocks). Used for vision-capable models.
export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export type MessageContent = string | MessageContentPart[];

export interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: MessageContent }>;
}

export interface ChatCompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  finishReason: string;
}

export interface AudioTranscriptionOptions {
  audio: ArrayBuffer | Buffer | Uint8Array;
  fileName?: string;
  mimeType?: string | null;
  model?: string;
}

export interface AudioTranscriptionResult {
  duration?: number;
  language?: string;
  model: string;
  text: string;
}

function getAudioFileExtension(mimeType?: string | null) {
  const normalized = mimeType?.toLowerCase() ?? '';

  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('aac')) return 'aac';

  return 'mp3';
}

/**
 * Generate a chat completion using OpenAI.
 */
export async function generateChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const client = getOpenAIClient();

  // Auto-upgrade to gpt-4o when any message contains image_url parts —
  // gpt-4o-mini supports vision too and is cheaper for routine tasks.
  const hasImages = options.messages.some(
    (m) => Array.isArray(m.content) && (m.content as MessageContentPart[]).some((p) => p.type === 'image_url')
  );
  const model = hasImages
    ? (options.model?.startsWith('gpt-4o') ? options.model : 'gpt-4o-mini')
    : (options.model ?? 'gpt-4o-mini');

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  for (const msg of options.messages) {
    // Cast to any to avoid complex union narrowing — the SDK accepts both string
    // and content-part arrays at runtime regardless of TypeScript's strict unions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages.push({ role: msg.role, content: msg.content } as any);
  }

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: options.maxTokens ?? 500,
    temperature: options.temperature ?? 0.7,
  });

  const choice = response.choices[0];

  return {
    content: choice.message.content ?? '',
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
    model: response.model,
    finishReason: choice.finish_reason,
  };
}

/**
 * Transcribe an audio file into text using OpenAI.
 */
export async function transcribeAudio(
  options: AudioTranscriptionOptions
): Promise<AudioTranscriptionResult> {
  const client = getOpenAIClient();
  const model = options.model ?? 'gpt-4o-mini-transcribe';
  const bytes = options.audio instanceof ArrayBuffer
    ? Buffer.from(options.audio)
    : Buffer.from(options.audio);

  const file = await toFile(
    bytes,
    options.fileName ?? `audio.${getAudioFileExtension(options.mimeType)}`,
    options.mimeType ? { type: options.mimeType } : undefined
  );

  const response = await client.audio.transcriptions.create({
    file,
    model,
    response_format: 'verbose_json',
  });

  return {
    duration: response.duration,
    language: response.language,
    model,
    text: response.text.trim(),
  };
}

/**
 * Generate a streaming chat completion.
 */
export async function* streamChatCompletion(
  options: ChatCompletionOptions
): AsyncGenerator<string> {
  const client = getOpenAIClient();
  const model = options.model ?? 'gpt-4o-mini';

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  for (const msg of options.messages) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages.push({ role: msg.role, content: msg.content } as any);
  }

  const stream = await client.chat.completions.create({
    model,
    messages,
    max_tokens: options.maxTokens ?? 500,
    temperature: options.temperature ?? 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * Classify the intent of a message.
 */
export async function classifyIntent(
  message: string,
  possibleIntents: string[]
): Promise<{ intent: string; confidence: number }> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Classify the user message into one of these intents: ${possibleIntents.join(', ')}.
        Respond with JSON: { "intent": "intent_name", "confidence": 0.95 }`,
      },
      { role: 'user', content: message },
    ],
    max_tokens: 100,
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  try {
    const result = JSON.parse(response.choices[0].message.content ?? '{}') as {
      intent: string;
      confidence: number;
    };
    return result;
  } catch {
    return { intent: possibleIntents[0], confidence: 0 };
  }
}

/**
 * Extract structured information from a message (e.g., lead data).
 */
export async function extractLeadInfo(message: string): Promise<{
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  interest?: string;
}> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Extract contact information from the message.
        Respond with JSON: { "name": "...", "email": "...", "phone": "...", "company": "...", "interest": "..." }
        Use null for fields not found.`,
      },
      { role: 'user', content: message },
    ],
    max_tokens: 200,
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(response.choices[0].message.content ?? '{}');
  } catch {
    return {};
  }
}
