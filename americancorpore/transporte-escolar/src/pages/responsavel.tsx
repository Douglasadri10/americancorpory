import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import ParentLayout from "../components/ParentLayout";
import { useRouter } from "next/router";

import { useAuth } from "@/contexts/AuthContext"; // se já expõe user/nome/email

import { onAuthStateChanged, updatePassword } from "firebase/auth";
import RedefinirSenhaModal from "@/components/RedefinirSenhaModal";

type ChildRow = {
  id: string;
  nome: string;
  escola?: string;
  schoolId?: string;
  valorSemanalCents?: number;
  ativo?: boolean;
  valor?: number;
};

export default function ResponsavelPage() {
  const { user } = useAuth(); // opcional: pega nome/email do contexto
  const [payingId, setPayingId] = useState<string | null>(null);
  const router = useRouter();

  async function iniciarPagamento(child: ChildRow) {
    try {
      setPayingId(child.id);

      // 1) Resolve amount em CENTAVOS aceitando modelos antigos (valor) e novos (valorSemanalCents)
      let cents: number | null = null;

      if (typeof child.valorSemanalCents === "number") {
        cents = child.valorSemanalCents;
      } else if (typeof child.valor === "number") {
        // legado: valor em dólares -> converte para centavos
        cents = Math.round(child.valor * 100);
      }

      if (!Number.isFinite(cents) || (cents as number) <= 0) {
        alert("Valor desta criança não está configurado.");
        return;
      }

      // 2) Garante os dados do responsável
      const current = auth.currentUser;
      const responsavelUid = user?.uid || current?.uid;
      const responsavelEmail = user?.email || current?.email || "";
      const responsavelNome = user?.nome || current?.displayName || "";

      if (!responsavelUid) {
        alert("Sessão inválida. Faça login novamente.");
        return;
      }

      // 3) Chama a API
      const resp = await fetch("./api/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsavelNome,
          responsavelUid,
          responsavelEmail,
          criancaNome: child.nome,
          criancaId: child.id,
          valorSemanalCents: cents, // <<< sempre centavos
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data?.url) {
        throw new Error(data?.error || "Falha ao iniciar pagamento.");
      }

      window.location.href = data.url as string; // Stripe Checkout
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao iniciar pagamento.";
      alert(message);
    } finally {
      setPayingId(null);
    }
  }

  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);

  // controle do modal de redefinição
  const [mustReset, setMustReset] = useState(false);
  const [checkingReset, setCheckingReset] = useState(true);
  useEffect(() => {
    if (user === null) {
      router.replace("/login");
    }
  }, [user, router]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      if (!u) {
        setChildren([]);
        setLoading(false);
        return;
      }

      // 1) verifica flag mustResetPassword no users/{uid}
      // 1) verifica flags no users/{uid}
      try {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        const data = userSnap.data() || {};
        const needs = Boolean(data.mustResetPassword || data.primeiroAcesso);
        setMustReset(needs);
      } catch {
        setMustReset(false);
      } finally {
        setCheckingReset(false);
      }

      // 2) carrega as crianças deste responsável
      try {
        // se quiser ordenar por data e tiver createdAt, adicione orderBy("createdAt","desc")
        const q = query(
          collection(db, "children"),
          where("responsavelUid", "==", u.uid)
        );
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => {
          const data = d.data() as Omit<ChildRow, "id">;
          return { id: d.id, ...data };
        });
        setChildren(rows);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const totalSemanal = useMemo(() => {
    return children.reduce(
      (acc, c) => acc + (Number(c.valorSemanalCents) || 0),
      0
    );
  }, [children]);

  // callback do modal de reset
  async function handleResetPassword(newPass: string) {
    const user = auth.currentUser;
    if (!user) return;

    await updatePassword(user, newPass);

    await updateDoc(doc(db, "users", user.uid), {
      mustResetPassword: false, // 🔽 zera
      primeiroAcesso: false, // 🔽 zera
      passwordChangedAt: serverTimestamp(),
    });

    setMustReset(false);
  }

  return (
    <ParentLayout title="Painel do Responsável">
      {/* Modal bloqueante para primeiro acesso */}
      {!checkingReset && mustReset && (
        <RedefinirSenhaModal
          onClose={() => {
            setMustReset(false);
            window.location.reload(); // garante que recarregue o painel após redefinir
          }}
          onConfirm={handleResetPassword}
          obrigatorio={true} // força redefinição
        />
      )}

      <div className="card">
        <h2 className="title">Crianças vinculadas</h2>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{children.length}</div>
      </div>

      <div className="card">
        <h2 className="title">Total semanal (USD)</h2>
        <div style={{ fontSize: 32, fontWeight: 700 }}>
          {(totalSemanal / 100).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="title">Status</h2>
        <div className="muted">—</div>
      </div>

      <section className="section">
        <h2 className="title">Minhas crianças</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Escola</th>
                <th className="right">Valor semanal</th>
                <th className="center">Status</th>
                <th className="center">Ações</th> {/* NOVO */}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="center muted" style={{ padding: 18 }}>
                    Carregando crianças...
                  </td>
                </tr>
              )}
              {children.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.escola || c.schoolId || "—"}</td>
                  <td className="right">
                    {typeof c.valorSemanalCents === "number"
                      ? `$${(c.valorSemanalCents / 100).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="center">
                    <span
                      className={c.ativo !== false ? "badge ok" : "badge muted"}
                    >
                      {c.ativo !== false ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="center">
                    <button
                      className="btn primary"
                      onClick={() => iniciarPagamento(c)}
                      disabled={!c.valorSemanalCents || payingId === c.id}
                      title={
                        !c.valorSemanalCents
                          ? "Valor não configurado"
                          : "Pagar agora"
                      }
                    >
                      {payingId === c.id ? "Redirecionando..." : "Pagar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ParentLayout>
  );
}
