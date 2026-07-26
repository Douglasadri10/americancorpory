import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/apiAuth";
import { requireMethod, sendApiError } from "@/lib/apiResponse";
import { getAdminDb } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req.method, ["GET"], res)) return;

  try {
    const user = await requireRole(req, ["motorista", "admin"]);
    const db = getAdminDb();

    const snapshot = await db.collection("vehicles").orderBy("name").get();
    const isAdmin = user.role === "admin";

    const vehicles = snapshot.docs
      .map((vehicle) => {
        const data = vehicle.data();
        return {
          id: vehicle.id,
          name: data.name as string,
          driverUid: (data.driverUid as string) || "",
          active: data.active !== false,
          activeTripId: (data.activeTripId as string) || null,
        };
      })
      // A motorista só enxerga veículos ativos atribuídos a ela ou ainda sem
      // condutor definido — espelha a autorização de startTrip. Admin vê todos.
      .filter((vehicle) => {
        if (!vehicle.active) return false;
        if (isAdmin) return true;
        return !vehicle.driverUid || vehicle.driverUid === user.uid;
      });

    return res.status(200).json({ vehicles });
  } catch (error) {
    return sendApiError(res, error);
  }
}
