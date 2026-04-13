import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL_APP_NAME, LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from '@/lib/legal';

interface LegalSection {
  title: string;
  content: ReactNode;
}

interface LegalDocumentProps {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSection[];
}

function LegalSectionBlock({ title, content }: LegalSection) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-text-secondary">{content}</div>
    </section>
  );
}

export function LegalDocument({ eyebrow, title, summary, sections }: LegalDocumentProps) {
  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 md:px-8 md:py-16">
        <header className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-[#171717] p-8">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-text-muted">
            <span>{LEGAL_APP_NAME}</span>
            <span className="h-1 w-1 rounded-full bg-text-muted" />
            <span>{eyebrow}</span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
            {title}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary md:text-base">
            {summary}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-xs text-text-muted">
            <span className="rounded-full border border-border px-3 py-1.5">
              Última atualização: {LEGAL_EFFECTIVE_DATE}
            </span>
            <a
              href={`mailto:${LEGAL_CONTACT_EMAIL}`}
              className="rounded-full border border-border px-3 py-1.5 transition-colors hover:border-border-hover hover:text-text-primary"
            >
              Contato: {LEGAL_CONTACT_EMAIL}
            </a>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/privacy-policy"
            className="rounded-full border border-border px-4 py-2 text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
          >
            Política de Privacidade
          </Link>
          <Link
            href="/terms-of-service"
            className="rounded-full border border-border px-4 py-2 text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
          >
            Termos de Serviço
          </Link>
          <Link
            href="/data-deletion"
            className="rounded-full border border-border px-4 py-2 text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
          >
            Data Deletion
          </Link>
        </nav>

        <div className="space-y-5">
          {sections.map((section) => (
            <LegalSectionBlock key={section.title} {...section} />
          ))}
        </div>

        <footer className="rounded-2xl border border-border bg-card/60 p-5 text-sm leading-7 text-text-secondary">
          <p>
            Estes documentos descrevem as práticas e os termos aplicáveis à versão atual do {LEGAL_APP_NAME}.
            Em caso de divergência entre este texto e obrigações legais imperativas do país aplicável, prevalecerá a
            legislação obrigatória correspondente.
          </p>
        </footer>
      </div>
    </main>
  );
}

