// src/services/children.ts
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Entrada para criação de criança + vínculo com responsável.
 * Campos novos: responsavelTelefone e schoolId (opcionais).
 */
export type ChildInput = {
  responsavelUid: string;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelTelefone?: string; // 👈 novo

  nome: string;
  escola?: string; // manter compatibilidade (nome da escola)
  schoolId?: string; // 👈 novo (id interno da escola)

  valorSemanalCents: number;
  ativo: boolean;
};

export type ChildDoc = {
  responsavelUid: string;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelTelefone?: string;

  nome: string;
  escola?: string;
  schoolId?: string;

  valorSemanalCents: number;
  ativo: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * Cria a criança na coleção `children` e (opcionalmente) mantém um espelho mínimo
 * no doc do usuário responsável (`users/{uid}`) — útil para listagens rápidas.
 */
export async function saveChild(input: ChildInput) {
  const now = serverTimestamp();

  // 1) cria criança
  const child: Omit<ChildDoc, "createdAt" | "updatedAt"> = {
    responsavelUid: input.responsavelUid,
    responsavelNome: input.responsavelNome,
    responsavelEmail: input.responsavelEmail,
    responsavelTelefone: input.responsavelTelefone,

    nome: input.nome,
    escola: input.escola,
    schoolId: input.schoolId,

    valorSemanalCents: input.valorSemanalCents,
    ativo: input.ativo,
  };

  const childrenCol = collection(db, "children");
  const childRef = await addDoc(childrenCol, {
    ...child,
    createdAt: now,
    updatedAt: now,
  });

  // 2) upsert do doc do responsável (garante dados básicos)
  const userRef = doc(db, "users", input.responsavelUid);

  await setDoc(
    userRef,
    {
      uid: input.responsavelUid,
      tipo: "pai",
      nome: input.responsavelNome,
      email: input.responsavelEmail ?? null,
      telefone: input.responsavelTelefone ?? null,
      mustResetPassword: true,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    id: childRef.id,
  };
}
