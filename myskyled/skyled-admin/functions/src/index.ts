// Functions v2 + Admin SDK
import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions/v2/options";
import {onDocumentCreated} from "firebase-functions/v2/firestore";

// Configure global options (adjust region/timeout as needed)
setGlobalOptions({region: "us-central1", maxInstances: 10});

// Initialize Admin once
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

type MoveType = "in" | "out" | "transfer" | "adjust";

interface StockMove {
  type: MoveType;
  itemSku: string;
  qty: number;
  unitCost?: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  reason?: string;
  createdAt?: FirebaseFirestore.FieldValue;
  createdByUid?: string;
}

// Helper to build a safe doc id for stocks (sku__warehouse)
const stockDocId = (itemSku: string, warehouseId: string) =>
  `${itemSku.replace(/[^a-zA-Z0-9_-]/g, "_")}__${warehouseId.replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  )}`;

export const updateStocksOnMove = onDocumentCreated(
  "stockMoves/{moveId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const move = snap.data() as StockMove;
    const {type, itemSku} = move;

    // Basic validation
    if (!itemSku || !type) return;
    if (typeof move.qty !== "number" || isNaN(move.qty)) return;

    const qtyAbs = Math.abs(move.qty);
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (tx) => {
      const applyDelta = async (warehouseId: string, delta: number) => {
        const id = stockDocId(itemSku, warehouseId);
        const ref = db.doc(`stocks/${id}`);
        const doc = await tx.get(ref);

        if (!doc.exists) {
          tx.set(ref, {
            itemSku,
            warehouseId,
            qty: delta,
            updatedAt: now,
            lastMoveId: snap.id,
          });
        } else {
          tx.update(ref, {
            qty: admin.firestore.FieldValue.increment(delta),
            updatedAt: now,
            lastMoveId: snap.id,
          });
        }
      };

      if (type === "in") {
        if (!move.fromWarehouseId) {
          throw new Error("Entrada requer fromWarehouseId (depósito).");
        }
        await applyDelta(move.fromWarehouseId, qtyAbs);
      } else if (type === "out") {
        if (!move.fromWarehouseId) {
          throw new Error("Saída requer fromWarehouseId (depósito).");
        }
        await applyDelta(move.fromWarehouseId, -qtyAbs);
      } else if (type === "adjust") {
        if (!move.fromWarehouseId) {
          throw new Error("Ajuste requer fromWarehouseId (depósito).");
        }
        // Ajuste usa o sinal original informado
        await applyDelta(move.fromWarehouseId, move.qty);
      } else if (type === "transfer") {
        if (!move.fromWarehouseId || !move.toWarehouseId) {
          throw new Error(
            "Transferência requer fromWarehouseId e toWarehouseId."
          );
        }
        if (move.fromWarehouseId === move.toWarehouseId) {
          throw new Error("Origem e destino não podem ser iguais.");
        }
        await applyDelta(move.fromWarehouseId, -qtyAbs);
        await applyDelta(move.toWarehouseId, qtyAbs);
      }
    });
  }
);
