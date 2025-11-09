import type { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatReminderMessage, sendWhatsAppMessage } from "@/services/twilio";

type PaymentStatus = "pending" | "paid";

type ChildDoc = {
  nome?: string;
  responsavelUid?: string;
  responsavelNome?: string;
  responsavelTelefone?: string;
  paymentStatus?: PaymentStatus;
  ativo?: boolean;
};

type UserDoc = {
  nome?: string;
  telefone?: string;
};

function verifyCronSecret(req: NextApiRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const provided = req.headers["x-cron-secret"];
  return provided === expected;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyCronSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const templateSid =
      process.env.TWILIO_TEMPLATE_SID ||
      process.env.TWILIO_REMINDER_TEMPLATE_SID;

    const childrenSnap = await getDocs(collection(db, "children"));
    const reminders: Promise<unknown>[] = [];
    let totalCandidates = 0;
    let totalSent = 0;

    const responsavelCache: Record<string, UserDoc | null> = {};

    for (const docSnap of childrenSnap.docs) {
      const data = docSnap.data() as ChildDoc;
      if (data.ativo === false) continue;
      if (data.paymentStatus === "paid") continue;

      totalCandidates += 1;

      const childName = data.nome || "sua criança";
      const responsavelUid = data.responsavelUid;
      let responsavelNome = data.responsavelNome || "";
      let responsavelTelefone = data.responsavelTelefone || "";

      if ((!responsavelNome || !responsavelTelefone) && responsavelUid) {
        if (!(responsavelUid in responsavelCache)) {
          const userSnap = await getDoc(doc(db, "users", responsavelUid));
          responsavelCache[responsavelUid] = (userSnap.data() as UserDoc | undefined) ?? null;
        }
        const cached = responsavelCache[responsavelUid];
        if (cached) {
          responsavelNome = responsavelNome || cached.nome || "";
          responsavelTelefone = responsavelTelefone || cached.telefone || "";
        }
      }

      if (!responsavelTelefone) {
        continue;
      }

      const safeResponsavelNome = responsavelNome || "responsável";

      const message = formatReminderMessage({
        responsavelNome: safeResponsavelNome,
        criancaNome: childName,
      });

      reminders.push(
        sendWhatsAppMessage({
          to: responsavelTelefone,
          ...(templateSid
            ? {
                contentSid: templateSid,
                contentVariables: {
                  responsavel: safeResponsavelNome,
                  crianca: childName,
                },
              }
            : { body: message }),
        })
          .then(() => {
            totalSent += 1;
            return updateDoc(doc(db, "children", docSnap.id), {
              paymentReminderAt: serverTimestamp(),
            });
          })
          .catch((error) => {
            console.error("twilio reminder error:", docSnap.id, error);
          })
      );
    }

    await Promise.all(reminders);

    return res.status(200).json({
      ok: true,
      totalCandidates,
      sent: totalSent,
    });
  } catch (error) {
    console.error("payment-reminders error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
