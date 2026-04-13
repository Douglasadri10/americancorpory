export const LEGAL_APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'HannaAI';

export const LEGAL_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || 'admin@usehanna.com';

export const LEGAL_EFFECTIVE_DATE = '19 de março de 2026';

export function getLegalBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured && !configured.includes('localhost')) {
    return configured.replace(/\/$/, '');
  }

  return 'https://saasinstagram.vercel.app';
}
