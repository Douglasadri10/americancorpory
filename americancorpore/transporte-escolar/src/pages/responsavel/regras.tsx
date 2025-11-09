import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ParentLayout from "@/components/ParentLayout";

export default function RegrasPage() {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    getDoc(doc(db, "settings", "app"))
      .then((d) => {
        const data = d.data() as { regrasTransporte?: string } | undefined;
        setText(data?.regrasTransporte || "");
      })
      .catch(() => setText(""));
  }, []);

  return (
    <ParentLayout title="Regras do Transporte">
      <section className="card">
        <h2 className="title">Regras do Transporte</h2>
        {text ? (
          <div className="prose" style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </div>
        ) : (
          <div className="muted">Nenhuma regra publicada ainda.</div>
        )}
      </section>
    </ParentLayout>
  );
}
