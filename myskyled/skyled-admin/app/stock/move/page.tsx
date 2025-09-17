"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  orderBy,
  limit as fblimit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

export default function StockMovePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // form state
  const [type, setType] = useState<"in" | "out" | "transfer" | "adjust">("in");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [warehouseFrom, setWarehouseFrom] = useState("");
  const [warehouseTo, setWarehouseTo] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  type Move = {
    id: string;
    createdAt?: Timestamp;
    type: "in" | "out" | "transfer" | "adjust";
    itemSku: string;
    qty: number;
    unitCost?: number;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    createdByUid?: string;
  };
  const [moves, setMoves] = useState<Move[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/auth/login");
      } else {
        setUser(u);
        // subscribe recent moves (last 20)
        const q = query(
          collection(db, "stockMoves"),
          orderBy("createdAt", "desc"),
          fblimit(20)
        );
        const unsubMoves = onSnapshot(q, (snap) => {
          const rows: Move[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setMoves(rows);
        });
        // merge unsubscribers
        return () => {
          unsub();
          unsubMoves();
        };
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

  const resetForm = () => {
    setType("in");
    setSku("");
    setQty("");
    setUnitCost("");
    setWarehouseFrom("");
    setWarehouseTo("");
    setReason("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // validations
    if (!sku.trim()) return setError("Informe o SKU do item.");
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0)
      return setError("Quantidade inválida.");
    const unitCostNum = unitCost.trim() ? Number(unitCost) : undefined;
    if (
      unitCost.trim() &&
      (!Number.isFinite(Number(unitCost)) || Number(unitCost) < 0)
    )
      return setError("Custo unitário inválido.");

    if (type === "transfer") {
      if (!warehouseFrom.trim() || !warehouseTo.trim())
        return setError(
          "Informe depósito de origem e destino para transferência."
        );
      if (warehouseFrom.trim() === warehouseTo.trim())
        return setError("Origem e destino não podem ser iguais.");
    } else if (type === "in" || type === "out" || type === "adjust") {
      if (!warehouseFrom.trim())
        return setError("Informe o depósito de referência (campo Depósito).");
    }

    setSubmitting(true);
    try {
      const payload: any = {
        type,
        itemSku: sku.trim(),
        qty: qtyNum,
        unitCost: unitCostNum,
        fromWarehouseId:
          type === "transfer" || type === "out" || type === "adjust"
            ? warehouseFrom.trim()
            : undefined,
        toWarehouseId: type === "transfer" ? warehouseTo.trim() : undefined,
        reason: reason.trim() || undefined,
        createdAt: serverTimestamp(),
        createdByUid: user?.uid,
      };

      await addDoc(collection(db, "stockMoves"), payload);
      setMessage("Movimentação registrada com sucesso!");
      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Erro ao salvar movimentação.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = {
    date(ts?: Timestamp) {
      return ts?.toDate().toLocaleString() ?? "-";
    },
    money(v?: number) {
      return (v ?? 0).toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      });
    },
  };

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">Movimentar Estoque</h1>
      <p className="text-sm opacity-70">Bem-vindo, {user?.email}</p>
      <button className="btn" onClick={handleLogout}>
        Logout
      </button>

      <form className="card space-y-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm opacity-80">Tipo de movimentação</span>
          <select
            className="input mt-1"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            <option value="in">Entrada</option>
            <option value="out">Saída</option>
            <option value="transfer">Transferência</option>
            <option value="adjust">Ajuste</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm opacity-80">Item (SKU)</span>
          <input
            className="input mt-1"
            placeholder="Ex.: panel_p39_out"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm opacity-80">Quantidade</span>
            <input
              className="input mt-1"
              inputMode="decimal"
              placeholder="Ex.: 10"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm opacity-80">
              Custo Unitário (opcional)
            </span>
            <input
              className="input mt-1"
              inputMode="decimal"
              placeholder="Ex.: 120.50"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </label>
        </div>

        {type === "transfer" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm opacity-80">Depósito Origem (ID)</span>
              <input
                className="input mt-1"
                placeholder="ex.: main"
                value={warehouseFrom}
                onChange={(e) => setWarehouseFrom(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm opacity-80">Depósito Destino (ID)</span>
              <input
                className="input mt-1"
                placeholder="ex.: van-1"
                value={warehouseTo}
                onChange={(e) => setWarehouseTo(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <label className="block">
            <span className="text-sm opacity-80">Depósito (ID)</span>
            <input
              className="input mt-1"
              placeholder="ex.: main"
              value={warehouseFrom}
              onChange={(e) => setWarehouseFrom(e.target.value)}
            />
          </label>
        )}

        <label className="block">
          <span className="text-sm opacity-80">
            Motivo/Observação (opcional)
          </span>
          <input
            className="input mt-1"
            placeholder="ex.: compra fornecedor, baixa por uso em projeto X"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Salvar movimentação"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && <p className="text-green-400 text-sm">{message}</p>}
      </form>

      <p className="text-xs opacity-70">
        Esta é a gravação direta em <code>stockMoves</code>. Na próxima etapa
        ligamos um consolidado de <code>stocks</code> via Cloud Function.
      </p>

      <div className="card overflow-x-auto">
        <div className="mb-2 font-medium">Movimentações recentes</div>
        <table className="table text-sm">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>SKU</th>
              <th>Qtd</th>
              <th>Depósito</th>
              <th>Custo Unit.</th>
            </tr>
          </thead>
          <tbody>
            {moves.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 opacity-70">
                  Nenhuma movimentação ainda.
                </td>
              </tr>
            )}
            {moves.map((m) => (
              <tr key={m.id}>
                <td>{fmt.date(m.createdAt)}</td>
                <td className="uppercase">{m.type}</td>
                <td>{m.itemSku}</td>
                <td>{m.qty}</td>
                <td>
                  {m.type === "transfer"
                    ? `${m.fromWarehouseId ?? "-"} → ${m.toWarehouseId ?? "-"}`
                    : m.fromWarehouseId ?? "-"}
                </td>
                <td>{m.unitCost != null ? fmt.money(m.unitCost) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
