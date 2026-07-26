import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/apiAuth";
import { requireMethod, sendApiError } from "@/lib/apiResponse";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { TransportError } from "@/lib/transport";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req.method, ["GET", "POST"], res)) return;

  try {
    const user = await requireRole(req, ["motorista", "admin"]);
    const db = getAdminDb();

    if (req.method === "GET") {
      // A motorista só vê os próprios chamados (o admin responde pela Central).
      const snapshot = await db
        .collection("messages")
        .where("userId", "==", user.uid)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      return res.status(200).json({
        messages: snapshot.docs.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            senderName: data.userName || "Motorista",
            senderRole: data.userRole || "motorista",
            subject: data.subject || "Sem assunto",
            text: data.text || "",
            status: data.status || "open",
            createdAt: data.createdAt?.toDate?.().toISOString?.() ?? null,
          };
        }),
      });
    }

    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!subject || !text) {
      throw new TransportError("Informe o assunto e a descrição do problema.");
    }

    const profile = await db.collection("users").doc(user.uid).get();
    const profileName = (profile.data()?.nome as string) || "";

    const messageRef = db.collection("messages").doc();
    await messageRef.set({
      userId: user.uid,
      userEmail: user.email || "",
      userName: profileName,
      userRole: "motorista",
      subject,
      text,
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ ok: true, id: messageRef.id });
  } catch (error) {
    return sendApiError(res, error);
  }
}
