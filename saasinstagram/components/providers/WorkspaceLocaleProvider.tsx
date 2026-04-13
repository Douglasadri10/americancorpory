'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Workspace } from '@/types/workspace';
import { getDateFnsLocale, getIntlLocale, normalizeAppLanguage, type AppLanguage } from '@/lib/i18n';

interface WorkspaceLocaleContextValue {
  workspace: Workspace | null;
  setWorkspace: Dispatch<SetStateAction<Workspace | null>>;
  language: AppLanguage;
  setLanguage: (language: string) => void;
  isEnglish: boolean;
  dateFnsLocale: ReturnType<typeof getDateFnsLocale>;
  intlLocale: string;
}

const WorkspaceLocaleContext = createContext<WorkspaceLocaleContextValue | null>(null);

interface WorkspaceLocaleProviderProps {
  children: ReactNode;
  initialWorkspace?: Workspace | null;
}

export function WorkspaceLocaleProvider({
  children,
  initialWorkspace = null,
}: WorkspaceLocaleProviderProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(initialWorkspace);
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const workspaceLanguage = initialWorkspace?.settings?.language;
    if (workspaceLanguage) {
      return normalizeAppLanguage(workspaceLanguage);
    }

    if (typeof window !== 'undefined') {
      return normalizeAppLanguage(window.localStorage.getItem('workspaceLanguage'));
    }

    return 'pt-BR';
  });

  useEffect(() => {
    if (!initialWorkspace) {
      return;
    }

    setWorkspace(initialWorkspace);
  }, [initialWorkspace]);

  useEffect(() => {
    const workspaceLanguage = workspace?.settings?.language;
    if (!workspaceLanguage) {
      return;
    }

    setLanguageState(normalizeAppLanguage(workspaceLanguage));
  }, [workspace?.settings?.language]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('workspaceLanguage', language);
    }

    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<WorkspaceLocaleContextValue>(() => ({
    workspace,
    setWorkspace,
    language,
    setLanguage: (nextLanguage: string) => setLanguageState(normalizeAppLanguage(nextLanguage)),
    isEnglish: language === 'en-US',
    dateFnsLocale: getDateFnsLocale(language),
    intlLocale: getIntlLocale(language),
  }), [workspace, language]);

  return (
    <WorkspaceLocaleContext.Provider value={value}>
      {children}
    </WorkspaceLocaleContext.Provider>
  );
}

export function useWorkspaceLocale() {
  const context = useContext(WorkspaceLocaleContext);

  if (!context) {
    throw new Error('useWorkspaceLocale must be used within WorkspaceLocaleProvider');
  }

  return context;
}
