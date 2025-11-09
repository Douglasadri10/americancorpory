// src/hooks/useRequireAuth.ts
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
type Options = {
  role?: "admin" | "pai" | "motorista"; // esperado
  redirectTo?: string; // default auto
};

export function useRequireAuth(opts?: Options) {
  const { user, loading, role } = useAuth();
  const router = useRouter();
  const expected = opts?.role;

  useEffect(() => {
    if (loading) return;

    // não logado → manda pro login
    if (!user) {
      router.replace("/login");
      return;
    }

    // Se precisa de role específica e ela não bate, redireciona
    if (expected && role && role !== expected) {
      // se tentou admin sem ser admin → manda para "/responsavel"
      if (expected === "admin") router.replace("/responsavel");
      else router.replace("/admin");
    }
  }, [loading, user, role, expected, router]);

  return {
    user,
    loading,
    role,
    ok: !!user && (!expected || role === expected),
  };
}
