"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import TableShell from "@/components/TableShell";

export default function WarehousesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Depósitos</h1>
      <p className="text-sm opacity-70">Bem-vindo, {user?.email}</p>
      <button className="btn" onClick={handleLogout}>
        Logout
      </button>
      <TableShell headers={["Nome", "Tipo", "Endereço"]}>
        <tr>
          <td>Depósito Principal</td>
          <td>main</td>
          <td>Orlando, FL</td>
        </tr>
      </TableShell>
    </div>
  );
}
