"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/auth/login");
      } else {
        setUser(u);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm opacity-70">Bem-vindo, {user?.email}</p>
      <button className="btn" onClick={handleLogout}>
        Logout
      </button>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          Receita (mês)
          <div className="text-2xl mt-2">$ 0.00</div>
        </div>
        <div className="card">
          Despesas (mês)
          <div className="text-2xl mt-2">$ 0.00</div>
        </div>
        <div className="card">
          Projetos ativos
          <div className="text-2xl mt-2">0</div>
        </div>
      </div>
    </div>
  );
}
