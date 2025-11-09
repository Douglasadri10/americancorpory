import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminLayout from "@/components/AdminLayout";
import StatsCard from "@/components/StatsCard";
import RulesEditor from "@/components/RulesEditor";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type CriancaRow = {
  id: string;
  nome: string;
  responsavelUid?: string;
  responsavelNome?: string;
  escola?: string;
  valorSemanalCents: number; // sempre em cents
  ativo: boolean;
};

type FirestoreChildDoc = {
  nome?: string;
  responsavelUid?: string;
  responsavelNome?: string;
  escola?: string;
  schoolName?: string;
  valorSemanalCents?: number;
  valor?: number;
  ativo?: boolean;
};

type ResponsavelDoc = {
  nome?: string;
};

export default function AdminHome() {
  const { loading, ok } = useRequireAuth({ role: "admin" });
  const [criancas, setCriancas] = useState<CriancaRow[]>([]);
  const [regras, setRegras] = useState("");

  // ---- LISTA CRIANÇAS (coleção correta + fallbacks) ----
  useEffect(() => {
    if (loading || !ok) return;
    const q = query(collection(db, "children"), orderBy("nome"));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const base = snap.docs.map((d) => {
          const data = d.data() as FirestoreChildDoc;
          return { id: d.id, ...data };
        });

        // Busca nomes de responsáveis que não vierem denormalizados
        const uids = Array.from(
          new Set(base.map((b) => b.responsavelUid).filter(Boolean))
        ) as string[];

        const nomesMap: Record<string, string> = {};
        await Promise.all(
          uids.map(async (uid) => {
            try {
              const us = await getDoc(doc(db, "users", uid));
              if (us.exists()) {
                const data = us.data() as ResponsavelDoc | undefined;
                nomesMap[uid] = data?.nome || "";
              }
            } catch {}
          })
        );

        const rows: CriancaRow[] = base.map((b) => {
          // fallback de valores antigos
          const cents =
            typeof b.valorSemanalCents === "number"
              ? b.valorSemanalCents
              : typeof b.valor === "number"
              ? Math.round(b.valor * 100) // ex.: 80 -> 8000
              : 0;

          return {
            id: b.id,
            nome: b.nome || "—",
            responsavelUid: b.responsavelUid,
            responsavelNome:
              b.responsavelNome ||
              (b.responsavelUid && nomesMap[b.responsavelUid]) ||
              "—",
            escola: b.escola || b.schoolName || "—",
            valorSemanalCents: cents,
            ativo: b.ativo !== false,
          };
        });

        setCriancas(rows);
      },
      (err) => console.error("onSnapshot(children) error:", err)
    );

    return () => unsub();
  }, [loading, ok]);

  const totalSemanal = useMemo(
    () => criancas.reduce((acc, c) => acc + (c.valorSemanalCents || 0), 0),
    [criancas]
  );

  const escolasAtendidas = useMemo(() => {
    return new Set(criancas.map((c) => c.escola || "—")).size;
  }, [criancas]);

  // ---- LÊ REGRAS ----
  useEffect(() => {
    if (loading || !ok) return;
    getDoc(doc(db, "settings", "app"))
      .then((d) => {
        if (d.exists()) {
          const data = d.data() as { regrasTransporte?: string } | undefined;
          setRegras(data?.regrasTransporte || "");
        }
      })
      .catch((error) => console.error("get rules error:", error));
  }, [loading, ok]);

  if (loading || !ok) return null;

  return (
    <AdminLayout title="Painel Administrativo">
      <div className="admin-page">
        <section className="admin-hero">
          <div className="admin-hero-copy">
            <span className="admin-hero-kicker">Resumo em tempo real</span>
            <h2>Operação de transporte</h2>
            <p>
              {criancas.filter((c) => c.ativo).length} crianças ativas, atendendo{" "}
              {escolasAtendidas} escolas e gerando{" "}
              {(totalSemanal / 100).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
              {" por semana."}
            </p>
          </div>
          <div className="admin-hero-actions">
            <Link className="btn ghost" href="/admin/rota">
              Gerenciar rotas
            </Link>
            <Link className="btn ghost" href="/admin/pagamentos">
              Ver pagamentos
            </Link>
          </div>
        </section>

        <div className="stats-grid">
          <StatsCard
            title="Crianças ativas"
            value={criancas.filter((c) => c.ativo).length}
          />
          <StatsCard
            title="Total semanal"
            value={(totalSemanal / 100).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          />
          <StatsCard title="Escolas atendidas" value={escolasAtendidas} />
        </div>

        <section className="admin-section">
          <header className="admin-section-header">
            <div>
              <h2>Crianças</h2>
              <p className="muted">
                Detalhes dos estudantes vinculados ao serviço.
              </p>
            </div>
          </header>

          <div className="admin-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Responsável</th>
                  <th className="center">Escola</th>
                  <th className="right">Valor semanal</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {criancas.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome}</td>
                    <td>{c.responsavelNome || "—"}</td>
                    <td className="center">{c.escola || "—"}</td>
                    <td className="right">
                      {(c.valorSemanalCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td className="center">
                      <span className={c.ativo ? "badge ok" : "badge muted"}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
                {criancas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="center muted" style={{ padding: 18 }}>
                      Nenhuma criança cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <header className="admin-section-header">
            <div>
              <h2>Regras do Transporte</h2>
              <p className="muted">
                Edite as normas exibidas para responsáveis e motoristas.
              </p>
            </div>
          </header>

          <div className="admin-section-body">
            <RulesEditor initialValue={regras} />
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
