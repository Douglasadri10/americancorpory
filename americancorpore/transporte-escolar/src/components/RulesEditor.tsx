import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function RulesEditor({
  initialValue,
}: {
  initialValue?: string;
}) {
  const [text, setText] = useState(initialValue || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const save = async () => {
    try {
      setSaving(true);
      await setDoc(
        doc(db, "settings", "app"),
        {
          regrasTransporte: text,
          regrasUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMsg("Salvo e propagado para todos os responsáveis.");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "desconhecido";
      setMsg("Erro ao salvar: " + message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 2500);
    }
  };

  return (
    <div className="card">
      <textarea
        className="textarea"
        placeholder="Escreva aqui as regras do transporte (horários, política de cancelamento, segurança, etc.)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row mt-3" style={{ gap: 10 }}>
        <button className="btn primary" disabled={saving} onClick={save}>
          {saving ? "Salvando..." : "Salvar regras"}
        </button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </div>
  );
}
