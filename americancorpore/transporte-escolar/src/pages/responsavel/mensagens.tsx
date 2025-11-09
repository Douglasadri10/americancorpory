import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import ParentLayout from "@/components/ParentLayout";

type Msg = {
  id: string;
  subject: string;
  text: string;
  status: "open" | "closed";
  createdAt?: Timestamp | null;
};

export default function MensagensPage() {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Msg[]>([]);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const q = query(
      collection(db, "messages"),
      where("userId", "==", u.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => {
        const data = d.data() as Omit<Msg, "id">;
        return { id: d.id, ...data };
      });
      setItems(docs);
    });
    return () => unsub();
  }, []);

  async function handleSend() {
    const u = auth.currentUser;
    if (!u) return alert("Faça login novamente.");
    if (!subject.trim() || !text.trim())
      return alert("Preencha o assunto e a mensagem.");
    setSending(true);
    try {
      await addDoc(collection(db, "messages"), {
        userId: u.uid,
        userEmail: u.email || "",
        userName: u.displayName || "",
        subject: subject.trim(),
        text: text.trim(),
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSubject("");
      setText("");
      alert("Mensagem enviada!");
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Erro ao enviar";
      alert(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <ParentLayout title="Mensagens">
      <section className="card">
        <h2 className="title">Nova mensagem</h2>
        <div className="grid gap">
          <input
            className="input"
            placeholder="Assunto"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending}
          />
          <textarea
            className="textarea"
            placeholder="Escreva sua mensagem..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          <div>
            <button
              className="btn primary"
              onClick={handleSend}
              disabled={sending}
            >
              Enviar
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="title">Minhas mensagens</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Assunto</th>
                <th>Status</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>{m.subject}</td>
                  <td>
                    <span
                      className={
                        m.status === "open" ? "badge ok" : "badge muted"
                      }
                    >
                      {m.status === "open" ? "Aberta" : "Fechada"}
                    </span>
                  </td>
                  <td>
                    {m.createdAt?.toDate
                      ? m.createdAt.toDate().toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="center muted"
                    style={{ padding: 18 }}
                  >
                    Nenhuma mensagem.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ParentLayout>
  );
}
