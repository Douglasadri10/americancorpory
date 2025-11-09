import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

import { auth, db, getSecondaryApp, disposeSecondary } from "@/lib/firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signOut,
} from "firebase/auth";

// Se você já usa este service centralizado, mantemos:
import { saveChild, type ChildInput } from "@/services/children";

type ChildRow = {
  id: string;
  nome: string;
  escola: string;
  valorSemanalCents: number;
  ativo: boolean;
  responsavelUid: string;
  responsavelNome?: string | null;
  responsavelEmail?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  schoolId?: string;
};

function usdToCents(v: string) {
  const n = Number(
    v
      .replace(/[^\d.,]/g, "")
      .replace(".", "")
      .replace(",", ".")
  );
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export default function AdminCriancasPage() {
  // form
  const [nome, setNome] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [valorUSD, setValorUSD] = useState("");
  const [emailResponsavel, setEmailResponsavel] = useState("");
  const [telefoneResponsavel, setTelefoneResponsavel] = useState("");
  const [senhaResponsavel, setSenhaResponsavel] = useState("");

  // estado
  const [criancas, setCriancas] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // escolas fixas (v1 – simples)
  const escolasFixas = [
    { id: "westpointe", nome: "Westpointe Elementary School" },
    { id: "gotha", nome: "Gotha Middle School" },
  ];
  const escolaSelecionada = escolasFixas.find((e) => e.id === schoolId);

  async function carregarCriancas() {
    setLoading(true);
    try {
      const q = query(collection(db, "children"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => {
        const data = d.data() as Omit<ChildRow, "id">;
        return { id: d.id, ...data };
      });
      setCriancas(rows);
    } catch (error: unknown) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarCriancas();
  }, []);

  /**
   * Cria o responsável usando um **app secundário** do Firebase,
   * para não trocar a sessão atual do admin.
   * - Se e-mail já existir, lança erro amigável.
   * - Retorna { uid, email } do novo usuário.
   */
  async function criarResponsavelSemTrocarSessao(
    email: string,
    senha: string
  ): Promise<{ uid: string; email: string }> {
    // Verifica se já existe método de login para este e‑mail
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods && methods.length > 0) {
      throw new Error(
        "E-mail do responsável já possui conta. Use outro e-mail ou vincule manualmente."
      );
    }

    // Garante que o admin está logado no app principal
    const admin = getAuth();
    if (!admin.currentUser) {
      throw new Error("Faça login como admin para continuar.");
    }

    // Usa app secundário para criar o novo usuário (sem afetar a sessão atual)
    const secondaryApp = getSecondaryApp();
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        senha
      );

      // Opcional: setar displayName via Admin API no backend (v2)
      return { uid: cred.user.uid, email: cred.user.email || email };
    } finally {
      // Encerra a sessão do app secundário e libera recursos
      try {
        await signOut(secondaryAuth);
      } catch {}
      await disposeSecondary();
    }
  }

  async function onSalvarCrianca() {
    if (
      !nome ||
      !responsavelNome ||
      !schoolId ||
      !telefoneResponsavel ||
      !valorUSD
    ) {
      setMsg(
        "Preencha os campos obrigatórios (nome, responsável, escola, telefone e valor semanal)."
      );
      return;
    }

    setSaving(true);
    setMsg("");

    let responsavelUid: string;

    if (emailResponsavel.trim() && senhaResponsavel.trim()) {
      // 1) cria a conta do responsável sem trocar a sessão do admin (opcional)
      const cred = await criarResponsavelSemTrocarSessao(
        emailResponsavel.trim(),
        senhaResponsavel.trim()
      );
      responsavelUid = cred.uid;
    } else {
      // Fluxo sem Auth: gera um ID de usuário "provisório" no Firestore
      // Observação: este UID não existe no Auth; a UI deverá tratar coleta de e-mail/senha depois.
      responsavelUid = doc(collection(db, "users")).id;
    }

    try {
      // 2) salva criança via service centralizado (mantemos seu fluxo)
      const input: ChildInput = {
        responsavelUid,
        responsavelNome: responsavelNome.trim(),
        responsavelEmail: emailResponsavel ? emailResponsavel.trim() : "",
        responsavelTelefone: telefoneResponsavel.trim(),
        nome: nome.trim(),
        escola: escolaSelecionada?.nome || schoolId, // fallback
        valorSemanalCents: usdToCents(valorUSD),
        ativo: true,
        schoolId, // guardamos também o id da escola
      };

      await saveChild(input);

      // 3) limpa form e recarrega
      setNome("");
      setResponsavelNome("");
      setSchoolId("");
      setValorUSD("");
      setEmailResponsavel("");
      setTelefoneResponsavel("");
      setSenhaResponsavel("");
      setMsg("Criança e responsável cadastrados com sucesso.");
      await carregarCriancas();
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Erro ao cadastrar.";
      setMsg(message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  async function removerCrianca(id: string) {
    if (!confirm("Deseja remover esta criança?")) return;
    try {
      await deleteDoc(doc(db, "children", id));
      // OBS: não removemos o vínculo em users/{uid}.filhos aqui
      // (precisamos do UID). Podemos marcar como inativa ou
      // implementar uma função de cleanup em v2.
      await carregarCriancas();
    } catch (error) {
      console.error(error);
      alert("Erro ao remover.");
    }
  }

  const totalSemanal = useMemo(
    () =>
      criancas.reduce((acc, c) => acc + (Number(c.valorSemanalCents) || 0), 0),
    [criancas]
  );

  return (
    <AdminLayout title="Crianças">
      <div className="grid cols-2">
        {/* FORM */}
        <div className="card">
          <h2 className="title">Cadastrar criança + responsável</h2>
          <div className="grid" style={{ gap: 12 }}>
            <input
              className="input"
              placeholder="Nome da criança"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <input
              className="input"
              placeholder="Nome do responsável"
              value={responsavelNome}
              onChange={(e) => setResponsavelNome(e.target.value)}
            />
            <select
              className="select"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
              <option value="">Selecione a escola</option>
              {escolasFixas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Valor semanal (USD)"
              value={valorUSD}
              onChange={(e) => setValorUSD(e.target.value)}
            />
            <input
              className="input"
              type="email"
              placeholder="E-mail do responsável"
              value={emailResponsavel}
              onChange={(e) => setEmailResponsavel(e.target.value)}
            />
            <input
              className="input"
              placeholder="Telefone do responsável"
              value={telefoneResponsavel}
              onChange={(e) => setTelefoneResponsavel(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="Senha inicial do responsável"
              value={senhaResponsavel}
              onChange={(e) => setSenhaResponsavel(e.target.value)}
            />
          </div>

          <div className="row mt-3">
            <button
              className="btn primary"
              disabled={saving}
              onClick={onSalvarCrianca}
            >
              {saving ? "Salvando..." : "Salvar criança"}
            </button>
            {msg && <span className="muted">{msg}</span>}
          </div>
        </div>

        {/* RESUMO */}
        <div className="card">
          <h2 className="title">Resumo</h2>
          <div className="grid">
            <div>
              <span className="muted">Total cadastradas:</span>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                {criancas.length}
              </div>
            </div>
            <div>
              <span className="muted">Total semanal:</span>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                {(totalSemanal / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LISTA */}
      <section className="section">
        <h2 className="title">Crianças cadastradas</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Escola</th>
                <th>Responsável</th>
                <th>E-mail</th>
                <th className="right">Valor semanal</th>
                <th className="center">Status</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="center muted"
                    style={{ padding: 18 }}
                  >
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && criancas.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="center muted"
                    style={{ padding: 18 }}
                  >
                    Nenhuma criança cadastrada.
                  </td>
                </tr>
              )}
              {criancas.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.escola || c.schoolId || "—"}</td>
                  <td>{c.responsavelNome || "—"}</td>
                  <td>{c.responsavelEmail || "—"}</td>
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
                  <td className="right">
                    <button
                      className="btn"
                      onClick={() => removerCrianca(c.id)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}
