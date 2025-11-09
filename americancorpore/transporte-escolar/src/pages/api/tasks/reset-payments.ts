import type { NextApiRequest, NextApiResponse } from "next";
import { collection, doc, getDocs, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type PaymentStatus = "pending" | "paid";

type ChildDoc = {
  ativo?: boolean;
  paymentStatus?: PaymentStatus;
  paymentCycleId?: string;
  paymentCycleStartAt?: Timestamp | null;
};

function computeCurrentCycle(nowInput?: Date) {
  const now = nowInput ? new Date(nowInput) : new Date();
  const day = now.getUTCDay();
  const hours = now.getUTCHours();

  // Consider America/New_York (Eastern) shifting to 17:00 -> 21:00 UTC (approx).
  const cycleStart = new Date(now);

  const diffToFriday = (day + 7 - 5) % 7;
  cycleStart.setUTCDate(cycleStart.getUTCDate() - diffToFriday);

  const isFridayBeforeReset = day === 5 && hours < 21; // 17h ET ~= 21h UTC
  if (isFridayBeforeReset) {
    cycleStart.setUTCDate(cycleStart.getUTCDate() - 7);
  }

  cycleStart.setUTCHours(21, 0, 0, 0); // 17h ET em UTC.

  return {
    id: cycleStart.toISOString(),
    start: cycleStart,
  };
}

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
    const cycle = computeCurrentCycle();
    const childrenSnap = await getDocs(collection(db, "children"));

    const updates = childrenSnap.docs
      .map((docSnap) => {
        const data = docSnap.data() as ChildDoc;
        const needsReset =
          data.paymentCycleId !== cycle.id || data.paymentStatus !== "pending";
        if (!needsReset) return null;

        return updateDoc(doc(db, "children", docSnap.id), {
          paymentStatus: "pending",
          paymentCycleId: cycle.id,
          paymentCycleStartAt: Timestamp.fromDate(cycle.start),
          paymentResetAt: serverTimestamp(),
        });
      })
      .filter(Boolean) as Promise<unknown>[];

    await Promise.all(updates);

    return res.status(200).json({
      ok: true,
      resets: updates.length,
      cycleId: cycle.id,
    });
  } catch (error) {
    console.error("reset-payments error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
