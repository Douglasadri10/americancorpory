import type { Metadata } from 'next';
import { headers } from 'next/headers';
import LandingPageClient from '@/components/landing/LandingPageClient';
import { type AppLanguage, normalizeBrowserLanguage } from '@/lib/i18n';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';

const metadataCopy: Record<AppLanguage, { title: string; description: string }> = {
  'pt-BR': {
    title: 'HannaAI - Atendimento omnichannel para equipes que vendem por DM',
    description:
      'Centralize Instagram, Facebook e operacoes via WhatsApp em um painel com IA, automacoes, agenda e acompanhamento comercial.',
  },
  'en-US': {
    title: 'HannaAI - Omnichannel support for teams that sell through DMs',
    description:
      'Centralize Instagram, Facebook, and WhatsApp workflows in one panel with AI, automation, scheduling, and sales follow-up.',
  },
};

function getRequestLanguage() {
  return normalizeBrowserLanguage(headers().get('accept-language'));
}

export function generateMetadata(): Metadata {
  const language = getRequestLanguage();
  return metadataCopy[language];
}

export default function RootPage() {
  const initialLanguage = getRequestLanguage();

  return (
    <LandingPageClient
      initialLanguage={initialLanguage}
      contactEmail={LEGAL_CONTACT_EMAIL}
    />
  );
}
