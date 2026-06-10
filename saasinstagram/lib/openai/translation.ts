import { generateChatCompletion } from '@/lib/openai/client';

const LOCALE_NAMES: Record<string, string> = {
  'pt-BR': 'Brazilian Portuguese',
  'pt': 'Portuguese',
  'en-US': 'English',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'ja': 'Japanese',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'ru': 'Russian',
  'nl': 'Dutch',
  'tr': 'Turkish',
  'hi': 'Hindi',
};

function localeToName(locale: string): string {
  return LOCALE_NAMES[locale] ?? LOCALE_NAMES[locale.split('-')[0]] ?? locale;
}

export async function translateText(text: string, targetLocale: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    const result = await generateChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0,
      maxTokens: 1024,
      messages: [
        {
          role: 'system',
          content: `Translate the user message to ${localeToName(targetLocale)}. Return only the translated text, nothing else. If the text is already in ${localeToName(targetLocale)}, return it unchanged.`,
        },
        { role: 'user', content: text },
      ],
    });
    return result.content.trim() || text;
  } catch {
    return text;
  }
}

export async function detectLanguage(text: string): Promise<string | null> {
  if (text.trim().length < 3) return null;
  try {
    const result = await generateChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0,
      maxTokens: 10,
      messages: [
        {
          role: 'system',
          content: 'Detect the language of the user message. Reply with only the BCP-47 language tag (e.g. "pt-BR", "en", "es", "fr"). Nothing else.',
        },
        { role: 'user', content: text.slice(0, 500) },
      ],
    });
    const detected = result.content.trim();
    return /^[a-z]{2,3}(-[A-Z]{2,4})?$/.test(detected) ? detected : null;
  } catch {
    return null;
  }
}
