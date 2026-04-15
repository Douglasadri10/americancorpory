'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';

const SESSION_MAX_AGE = 5 * 24 * 60 * 60; // 5 days in seconds

/** Immediately sets a lightweight session flag so the middleware lets the request through
 *  while the httpOnly Firebase session cookie is being created server-side. */
function setClientSessionCookie() {
  document.cookie = `session=1; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax`;
}

function clearClientSessionCookie() {
  document.cookie = 'session=; path=/; max-age=0; SameSite=Lax';
}

/** Exchange a Firebase ID token for a proper httpOnly session cookie via the server.
 *  Falls back to the lightweight client cookie if the call fails. */
async function createServerSession(idToken: string): Promise<void> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) setClientSessionCookie();
  } catch {
    setClientSessionCookie();
  }
}

/** Delete the httpOnly session cookie via the server. */
async function deleteServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // best-effort
  }
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setClientSessionCookie();
      else clearClientSessionCookie();
      setState({ user, loading: false, error: null });
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      await createServerSession(idToken);
      localStorage.removeItem('currentWorkspaceId');

      setState({ user: result.user, loading: false, error: null });
      return result.user;
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error);
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw new Error(message);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const auth = getFirebaseAuth();
      const result = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(result.user, { displayName });
      const idToken = await result.user.getIdToken();
      await createServerSession(idToken);
      localStorage.removeItem('currentWorkspaceId');

      setState({ user: result.user, loading: false, error: null });
      return result.user;
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error);
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw new Error(message);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await createServerSession(idToken);
      localStorage.removeItem('currentWorkspaceId');

      setState({ user: result.user, loading: false, error: null });
      return result.user;
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error);
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw new Error(message);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
      await deleteServerSession();
      clearClientSessionCookie();
      localStorage.removeItem('currentWorkspaceId');

      setState({ user: null, loading: false, error: null });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
  };
}

function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    const messages: Record<string, string> = {
      'auth/user-not-found': 'Usuário não encontrado',
      'auth/wrong-password': 'Senha incorreta',
      'auth/invalid-email': 'Email inválido',
      'auth/user-disabled': 'Conta desativada',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
      'auth/email-already-in-use': 'Este email já está em uso',
      'auth/weak-password': 'Senha fraca. Use pelo menos 6 caracteres',
      'auth/invalid-credential': 'Credenciais inválidas',
      'auth/popup-closed-by-user': 'Login cancelado',
      'auth/cancelled-popup-request': 'Login cancelado',
      'auth/popup-blocked': 'Popup bloqueado pelo navegador. Permita popups para este site.',
      'auth/operation-not-allowed': 'Login com Google não está habilitado. Contate o suporte.',
      'auth/unauthorized-domain': 'Domínio não autorizado. Contate o suporte.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet',
    };
    return messages[code] ?? 'Erro de autenticação. Tente novamente';
  }
  return 'Erro inesperado. Tente novamente';
}
