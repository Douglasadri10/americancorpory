import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { formatUSDFromCents } from "../../utils/money";
import StatsCard from "@/components/StatsCard";

type PaymentStatus = "paid" | "pending";

type PaymentRow = {
  id: string;
  nome: string;
  responsavelNome: string;
  valorSemanalCents: number;
  ativo: boolean;
  paymentStatus: PaymentStatus;
  paymentCycleId: string | null;
  paymentCycleStartAt: Date | null;
  paymentResetAt: Date | null;
  paymentPaidAt: Date | null;
};

type PaymentCycle = {
  id: string;
  start: Date;
};

type RawChildDoc = {
  nome?: string;
  responsavelNome?: string;
  responsavel?: { nome?: string | null } | null;
  responsavelName?: string;
  valorSemanalCents?: number;
  valor?: number;
  ativo?: boolean;
  paymentStatus?: string;
  paymentCycleId?: string;
  paymentCycleStartAt?: Timestamp | null;
  paymentResetAt?: Timestamp | null;
  paymentPaidAt?: Timestamp | null;
};

function computeCurrentCycle(nowInput?: Date): PaymentCycle {
  const now = nowInput ? new Date(nowInput) : new Date();
  const day = now.getDay(); // 0 (Sun) - 6 (Sat); Friday === 5
  const hours = now.getHours();

  const diffToFriday = (day + 7 - 5) % 7;
  const cycleStart = new Date(now);
  cycleStart.setDate(cycleStart.getDate() - diffToFriday);

  const isFridayBeforeReset = day === 5 && hours < 17;
  if (isFridayBeforeReset) {
    cycleStart.setDate(cycleStart.getDate() - 7);
  }

  cycleStart.setHours(17, 0, 0, 0);

  const id = cycleStart.toISOString();
  return { id, start: cycleStart };
}

function formatDateTime(date?: Date | null) {
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AdminPagamentosPage() {
  const { user: authUser } = useAuth();
  const { loading, ok } = useRequireAuth({ role: "admin" });

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const resetInFlight = useRef(false);

  useEffect(() => {
    if (loading || !ok) return;

    const q = query(collection(db, "children"), orderBy("nome"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((docSnap) => {
          const data = docSnap.data() as RawChildDoc;

          const cents =
            typeof data.valorSemanalCents === "number"
              ? data.valorSemanalCents
              : typeof data.valor === "number"
              ? Math.round(data.valor * 100)
              : 0;

          const status: PaymentStatus =
            data.paymentStatus === "paid" ? "paid" : "pending";

          return {
            id: docSnap.id,
            nome: data.nome || "—",
            responsavelNome:
              data.responsavelNome ||
              data.responsavel?.nome ||
              data.responsavelName ||
              "—",
            valorSemanalCents: cents,
            ativo: data.ativo !== false,
            paymentStatus: status,
            paymentCycleId: data.paymentCycleId || null,
            paymentCycleStartAt:
              data.paymentCycleStartAt?.toDate?.() ?? null,
            paymentResetAt: data.paymentResetAt?.toDate?.() ?? null,
            paymentPaidAt: data.paymentPaidAt?.toDate?.() ?? null,
          } as PaymentRow;
        });

        setRows(mapped);
        setLoadingRows(false);
      },
      (err) => {
        console.error("onSnapshot(children) error:", err);
        setLoadingRows(false);
      }
    );

    return () => unsub();
  }, [loading, ok]);

  useEffect(() => {
    if (loadingRows || !ok || !rows.length) return;
    const cycle = computeCurrentCycle();

    const needsReset = rows.filter(
      (row) => row.paymentCycleId !== cycle.id || !row.paymentCycleId
    );

    if (!needsReset.length || resetInFlight.current) return;

    resetInFlight.current = true;
    setResetting(true);
    setResetError(null);

    const cycleStartTimestamp = Timestamp.fromDate(cycle.start);
    const payloadBase = {
      paymentStatus: "pending" as PaymentStatus,
      paymentCycleId: cycle.id,
      paymentCycleStartAt: cycleStartTimestamp,
      paymentResetAt: serverTimestamp(),
      paymentResetBy: authUser?.uid || null,
      paymentPaidAt: null,
      paymentPaidBy: null,
    };

    Promise.all(
      needsReset.map((row) =>
        updateDoc(doc(db, "children", row.id), payloadBase).catch((err) => {
          console.error("reset payment status error:", row.id, err);
          setResetError("Não foi possível atualizar alguns registros.");
        })
      )
    )
      .catch((err) => {
        console.error("reset payments batch error:", err);
        setResetError("Falha ao aplicar reset automático desta semana.");
      })
      .finally(() => {
        setResetting(false);
        resetInFlight.current = false;
      });
  }, [rows, loadingRows, ok, authUser?.uid]);

  const cycle = computeCurrentCycle();

  const onlyActive = useMemo(
    () => rows.filter((row) => row.ativo),
    [rows]
  );

  const paidCount = useMemo(
    () => onlyActive.filter((row) => row.paymentStatus === "paid").length,
    [onlyActive]
  );

  const pendingCount = useMemo(
    () => onlyActive.filter((row) => row.paymentStatus !== "paid").length,
    [onlyActive]
  );

  const pendingTotal = useMemo(
    () =>
      onlyActive
        .filter((row) => row.paymentStatus !== "paid")
        .reduce((acc, row) => acc + (row.valorSemanalCents || 0), 0),
    [onlyActive]
  );

  const markPaid = async (row: PaymentRow, paid: boolean) => {
    setUpdating((prev) => ({ ...prev, [row.id]: true }));
    setResetError(null);
    try {
      const ref = doc(db, "children", row.id);
      if (paid) {
        await updateDoc(ref, {
          paymentStatus: "paid",
          paymentPaidAt: serverTimestamp(),
          paymentPaidBy: authUser?.uid || null,
        });
      } else {
        await updateDoc(ref, {
          paymentStatus: "pending",
          paymentPaidAt: null,
          paymentPaidBy: null,
        });
      }
    } catch (err: unknown) {
      console.error("update payment status error:", err);
      const message =
        err instanceof Error ? err.message : "Não foi possível atualizar o status.";
      alert(message);
    } finally {
      setUpdating((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  if (loading || !ok) return null;

  return (
    <AdminLayout title="Pagamentos semanais">
      <div className="admin-page">
        <section className="admin-hero">
          <div className="admin-hero-copy">
            <span className="admin-hero-kicker">Ciclo em vigor</span>
            <h2>Controle de pagamentos</h2>
            <p>
              Semana iniciada em{" "}
              <strong>
                {new Date(cycle.start).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </strong>{" "}
              — itens são resetados automaticamente toda sexta-feira às 17h.
            </p>
          </div>
          <div className="admin-hero-actions">
            <StatsCard title="Total pagos" value={paidCount} />
            <StatsCard title="Em aberto" value={pendingCount} />
            <StatsCard
              title="Valor pendente"
              value={formatUSDFromCents(pendingTotal)}
            />
          </div>
        </section>

        {resetting && (
          <div className="alert warn">
            Recalculando a semana corrente e sincronizando status…
          </div>
        )}
        {resetError && <div className="alert error">{resetError}</div>}

        <section className="admin-section">
          <header className="admin-section-header">
            <div>
              <h2>Registro semanal</h2>
              <p className="muted">
                Marque os pagamentos recebidos manualmente. O status volta para{" "}
                &quot;A pagar&quot; na sexta-feira às 17h.
              </p>
            </div>
          </header>

          <div className="admin-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Criança</th>
                  <th>Responsável</th>
                  <th className="right">Valor semanal</th>
                  <th className="center">Status</th>
                  <th className="center">Última ação</th>
                  <th className="center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loadingRows && (
                  <tr>
                    <td colSpan={6} className="center muted" style={{ padding: 18 }}>
                      Carregando registros…
                    </td>
                  </tr>
                )}

                {!loadingRows && onlyActive.length === 0 && (
                  <tr>
                    <td colSpan={6} className="center muted" style={{ padding: 18 }}>
                      Nenhuma criança ativa cadastrada.
                    </td>
                  </tr>
                )}

                {onlyActive.map((row) => {
                  const isPaid = row.paymentStatus === "paid";
                  const lastAction = isPaid ? row.paymentPaidAt : row.paymentResetAt;
                  return (
                    <tr key={row.id}>
                      <td>{row.nome}</td>
                      <td>{row.responsavelNome || "—"}</td>
                      <td className="right">
                        {formatUSDFromCents(row.valorSemanalCents)}
                      </td>
                      <td className="center">
                        <span className={isPaid ? "badge ok" : "badge warn"}>
                          {isPaid ? "Pago" : "A pagar"}
                        </span>
                      </td>
                      <td className="center">{formatDateTime(lastAction)}</td>
                      <td className="center">
                        {isPaid ? (
                          <button
                            className="btn ghost"
                            disabled={!!updating[row.id]}
                            onClick={() => markPaid(row, false)}
                          >
                            Marcar como pendente
                          </button>
                        ) : (
                          <button
                            className="btn primary"
                            disabled={!!updating[row.id]}
                            onClick={() => markPaid(row, true)}
                          >
                            {updating[row.id] ? "Salvando…" : "Marcar como pago"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
