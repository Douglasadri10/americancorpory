// src/contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
  getIdTokenResult,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export type Role = "admin" | "pai" | "motorista" | null;

export interface UserData {
  uid: string;
  email: string;
  nome: string;
  tipo: Role;
  primeiroAcesso?: boolean;
}

type UserDoc = {
  nome?: string | null;
  email?: string | null;
  tipo?: Role;
  primeiroAcesso?: boolean;
};

interface AuthContextType {
  user: UserData | null;
  fbUser: FirebaseUser | null;
  role: Role;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  markFirstAccessDone: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // precisa de valor inicial em TS
  const profileUnsubRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    // mantém sessão após refresh (ignora erro se ambiente não suportar)
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    const unsubAuth = onAuthStateChanged(auth, async (current) => {
      // limpa snapshot anterior
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      setFbUser(current);

      if (!current) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      // tenta pegar custom claims (opcional)
      let claimsRole: Role = null;
      try {
        const token = await getIdTokenResult(current, true);
        const maybe = token.claims?.role as Role | undefined;
        if (maybe === "admin" || maybe === "pai" || maybe === "motorista") {
          claimsRole = maybe;
        }
      } catch {}

      // escuta perfil em tempo real
      const ref = doc(db, "users", current.uid);
      profileUnsubRef.current = onSnapshot(ref, async (snap) => {
        const data = snap.data() as UserDoc | undefined;

        // se não existe doc, cria esqueleto para evitar nulls
        if (!data) {
          const seed = {
            nome: current.displayName || "",
            email: current.email || "",
            tipo: (claimsRole || "pai") as Role,
            primeiroAcesso: true,
          };
          await setDoc(ref, seed, { merge: true });
          setUser({
            uid: current.uid,
            email: seed.email,
            nome: seed.nome,
            tipo: seed.tipo,
            primeiroAcesso: seed.primeiroAcesso,
          });
          setRole(seed.tipo);
          setLoading(false);
          return;
        }

        const fsRole = data?.tipo ?? null;
        const finalRole: Role = claimsRole || fsRole;

        setUser({
          uid: current.uid,
          email: current.email ?? data?.email ?? "",
          nome: data?.nome ?? "",
          tipo: finalRole,
          primeiroAcesso: Boolean(data?.primeiroAcesso),
        });
        setRole(finalRole);
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
    };
  }, []);

  // ações
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      // loading volta no snapshot
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fbSignOut(auth); // encerra no Firebase
      router.push("/login"); // volta para login
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  }, [router]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const markFirstAccessDone = useCallback(async () => {
    if (!fbUser) return;
    await setDoc(
      doc(db, "users", fbUser.uid),
      { primeiroAcesso: false },
      { merge: true }
    );
  }, [fbUser]);

  const value = useMemo(
    () => ({
      user,
      fbUser,
      role,
      loading,
      login,
      logout,
      resetPassword,
      markFirstAccessDone,
    }),
    [user, fbUser, role, loading, login, logout, resetPassword, markFirstAccessDone]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
