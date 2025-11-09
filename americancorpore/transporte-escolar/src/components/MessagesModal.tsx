import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

type Props = {
  childId: string;
  childName: string;
  onClose: () => void;
  senderName: string; // nome do responsável logado
  senderUid: string; // uid do responsável
};

type MessageDoc = {
  id: string;
  text?: string;
  senderUid?: string;
  senderName?: string;
};

export default function MessagesModal({
  childId,
  childName,
  onClose,
  senderName,
  senderUid,
}: Props) {
  const [msgs, setMsgs] = useState<MessageDoc[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    // Sugestão de estrutura: subcoleção em cada criança
    // /children/{childId}/messages
    const q = query(
      collection(db, "children", childId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => {
        const data = d.data() as Omit<MessageDoc, "id">;
        return { id: d.id, ...data };
      });
      setMsgs(docs);
    });
    return () => unsub();
  }, [childId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    await addDoc(collection(db, "children", childId, "messages"), {
      text: t,
      senderUid,
      senderName,
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-lg shadow p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Mensagens — {childName}</h2>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 border rounded"
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded p-3 bg-gray-50">
          {msgs.map((m) => (
            <div key={m.id} className="mb-2">
              <div className="text-xs text-gray-500">
                {m.senderName || "Usuário"}
              </div>
              <div className="px-2 py-1 bg-white rounded border inline-block">
                {m.text}
              </div>
            </div>
          ))}
          {msgs.length === 0 && (
            <div className="text-sm text-gray-500">Nenhuma mensagem ainda.</div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1"
            placeholder="Escreva uma mensagem…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? send() : undefined)}
          />
          <button
            onClick={send}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
