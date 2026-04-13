import { enUS, ptBR } from 'date-fns/locale';

export type AppLanguage = 'pt-BR' | 'en-US';

export function normalizeAppLanguage(value?: string | null): AppLanguage {
  if (!value) {
    return 'pt-BR';
  }

  return value.toLowerCase().startsWith('en') ? 'en-US' : 'pt-BR';
}

export function normalizeBrowserLanguage(value?: string | null): AppLanguage {
  if (!value) {
    return 'pt-BR';
  }

  const primaryLanguage = value.split(',')[0]?.trim().toLowerCase();

  return primaryLanguage?.startsWith('pt') ? 'pt-BR' : 'en-US';
}

export function getDateFnsLocale(language?: string | null) {
  return normalizeAppLanguage(language) === 'en-US' ? enUS : ptBR;
}

export function getIntlLocale(language?: string | null) {
  return normalizeAppLanguage(language);
}
