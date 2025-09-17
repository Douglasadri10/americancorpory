"use client";
import { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

type StockRow = {
  id: string;
  itemSku: string;
  warehouseId: string;
  qty: number;
  updatedAt?: Timestamp;
};

export default function EstoquePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [qSku, setQSku] = useState("");
  const [qWh, setQWh] = useState("");

  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/auth/login");
      } else {
        setUser(u);
        // subscribe to consolidated stocks
        const qStocks = query(
          collection(db, "stocks"),
          orderBy("updatedAt", "desc")
        );
        const unsubStocks = onSnapshot(qStocks, (snap) => {
          setRows(
            snap.docs.map((d) => {
              const data = d.data() as any;
              return { id: d.id, ...data };
            })
          );
        });
        // cleanup
        return () => unsubStocks();
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth/login");
  };

  const fmtDate = (ts?: Timestamp) => ts?.toDate().toLocaleString() ?? "-";

  const filtered = useMemo(() => {
    const s = qSku.trim().toLowerCase();
    const w = qWh.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (s ? r.itemSku.toLowerCase().includes(s) : true) &&
        (w ? r.warehouseId.toLowerCase().includes(w) : true)
    );
  }, [rows, qSku, qWh]);

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estoque (Consolidado)</h1>
          <p className="text-sm opacity-70">Bem-vindo, {user?.email}</p>
        </div>
        <button className="btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          className="input"
          placeholder="Filtrar por SKU"
          value={qSku}
          onChange={(e) => setQSku(e.target.value)}
        />
        <input
          className="input"
          placeholder="Filtrar por Depósito (ID)"
          value={qWh}
          onChange={(e) => setQWh(e.target.value)}
        />
        <div className="text-sm opacity-70 self-center">
          Itens: {filtered.length}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table text-sm">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Depósito</th>
              <th className="text-right">Quantidade</th>
              <th>Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 opacity-70">
                  Nenhum registro.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.itemSku}</td>
                <td>{r.warehouseId}</td>
                <td className="text-right">{r.qty}</td>
                <td>{fmtDate(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
