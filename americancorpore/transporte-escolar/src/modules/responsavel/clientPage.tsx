import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import MessagesModal from "@/components/MessagesModal";

type ChildForResponsavel = {
  id: string;
  nome: string;
  idNumerico?: number;
  schoolName?: string;
  responsavelId?: string;
  valor?: number;
  valorSemanalCents?: number;
};

type CheckoutSessionResponse = {
  url?: string;
  error?: string;
};

export default function ClientPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [payingId, setPayingId] = useState<string | null>(null);

  const [criancas, setCriancas] = useState<ChildForResponsavel[]>([]);
  const [err, setErr] = useState<string>("");
  const [fetching, setFetching] = useState(false);
  const [showMessages, setShowMessages] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const pagar = async (child: ChildForResponsavel) => {
    try {
      setPayingId(child.id);

      const precoBase =
        typeof child.valor === "number"
          ? child.valor * 100
          : child.valorSemanalCents;
      const valorEmCentavos = Math.round(Number(precoBase ?? 0));

      if (!Number.isFinite(valorEmCentavos) || valorEmCentavos <= 0) {
        alert("Valor desta criança não está configurado.");
        setPayingId(null);
        return;
      }

      const res = await fetch("/api/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsavelNome: user?.nome ?? "",
          responsavelUid: user?.uid ?? "",
          responsavelEmail: user?.email ?? "",
          criancaNome: child.nome,
          criancaId: child.id,
          idUnico: child.idNumerico,
          valor: valorEmCentavos,
        }),
      });

      const data = (await res.json()) as CheckoutSessionResponse;
      if (!res.ok) throw new Error(data?.error || "Falha ao criar sessão");

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Sessão criada sem URL de checkout.");
      }
    } catch (error: unknown) {
      console.error("CLIENT pagar() error:", error);
      const message =
        error instanceof Error ? error.message : String(error);
      alert(`Erro ao iniciar pagamento: ${message}`);
    } finally {
      setPayingId(null);
    }
  };

  // 🔒 Protege a rota: só "pai" pode acessar
  useEffect(() => {
    if (loading || !user) return;

    if (user.tipo !== "pai") {
      // Redireciona conforme o tipo de usuário
      const destino =
        user.tipo === "admin"
          ? "/admin"
          : user.tipo === "motorista"
          ? "/motorista"
          : "/login";

      router.replace(destino);
    }
  }, [loading, user, router]);

  // Carrega crianças do responsável logado (apenas se for "pai")
  useEffect(() => {
    (async () => {
      try {
        if (loading || !user || user.tipo !== "pai") return;
        setFetching(true);

        const q = query(
          collection(db, "children"),
          where("responsavelId", "==", user.uid) // garante filtro por UID do responsável
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => {
          const data = d.data() as Omit<ChildForResponsavel, "id">;
          return { id: d.id, ...data };
        });
        setCriancas(docs);
      } catch (error: unknown) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : "Erro ao carregar crianças";
        setErr(message);
      } finally {
        setFetching(false);
      }
    })();
  }, [loading, user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  };

  if (loading) return <div className="p-6">Carregando usuário…</div>;
  if (!user)
    return <div className="p-6">Faça login para acessar o painel.</div>;
  if (user.tipo !== "pai") return null; // evita “flash” antes do redirect

  return (
    <>
      {showMessages && user && (
        <MessagesModal
          childId={showMessages.id}
          childName={showMessages.name}
          senderName={user.nome || "Responsável"}
          senderUid={user.uid}
          onClose={() => setShowMessages(null)}
        />
      )}

      <div className="p-6 max-w-4xl mx-auto">
        {/* Header com usuário logado + Sair */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-300">
            Logado como:{" "}
            <span className="font-semibold">{user.nome || "(sem nome)"}</span>
            {" — "}
            <span className="opacity-80">{user.email}</span>
            {" — "}
            <span className="uppercase">{user.tipo}</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm"
            title="Sair"
          >
            Sair
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-6">Painel do Responsável</h1>

        {err && <p className="text-red-500 mb-3">Erro: {err}</p>}
        {fetching && <p>Carregando filhos vinculados…</p>}

        <ul className="space-y-4">
          {criancas.map((c) => (
            <li
              key={c.id}
              className="border p-4 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div>
                <strong>{c.nome}</strong> (ID: {c.idNumerico})<br />
                Escola: {c.schoolName}
                {typeof c.valor === "number" && (
                  <>
                    <br />
                    Valor semanal: ${c.valor.toFixed(2)}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                {
                  <button
                    onClick={() =>
                      setShowMessages({ id: c.id, name: c.nome })
                    }
                    className="px-3 py-2 rounded border hover:bg-gray-100"
                  >
                    Mensagens
                  </button>
                }
                {
                  <button
                    onClick={() => pagar(c)}
                    disabled={payingId === c.id}
                    className={`px-3 py-2 rounded text-white ${
                      payingId === c.id
                        ? "bg-blue-400"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {payingId === c.id ? "Redirecionando…" : "Pagar agora"}
                  </button>
                }
              </div>
            </li>
          ))}
          {!fetching && criancas.length === 0 && (
            <li>Nenhuma criança vinculada à sua conta.</li>
          )}
        </ul>
      </div>
    </>
  );
}
