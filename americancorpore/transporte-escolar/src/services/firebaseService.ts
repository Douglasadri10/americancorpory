import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  updateDoc,
  addDoc,
} from "firebase/firestore";

// Gera ID numérico único com até 5 dígitos (entre 1000 e 99999)
async function gerarIdUnico(): Promise<number> {
  const id = Math.floor(1000 + Math.random() * 90000);
  const docRef = doc(db, "children", id.toString());
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return gerarIdUnico(); // tenta novamente
  }
  return id;
}

// Cadastra pai + filho juntos
export async function cadastrarPaiComFilho(data: {
  nomePai: string;
  email: string;
  telefone: string;
  nomeFilho: string;
}) {
  const idUnico = await gerarIdUnico();

  // Cria usuário pai
  const userRef = doc(collection(db, "users"));
  await setDoc(userRef, {
    nome: data.nomePai,
    email: data.email,
    telefone: data.telefone,
    tipo: "pai",
  });

  // Cria criança com ID vinculado ao user
  await setDoc(doc(db, "children", idUnico.toString()), {
    nome: data.nomeFilho,
    idResponsavel: userRef.id,
    idUnico: idUnico,
  });

  return {
    paiId: userRef.id,
    filhoId: idUnico,
  };
}

// Registra Check-in
export async function registrarCheckIn(
  childId: string,
  local: { lat: number; lng: number }
) {
  const hoje = new Date().toISOString().split("T")[0];

  const q = query(
    collection(db, "schedules"),
    where("childId", "==", childId),
    where("data", "==", hoje)
  );

  const docs = await getDocs(q);

  if (docs.empty) {
    await addDoc(collection(db, "schedules"), {
      childId,
      data: hoje,
      checkin: {
        hora: new Date().toLocaleTimeString(),
        local,
      },
    });
  } else {
    const ref = doc(db, "schedules", docs.docs[0].id);
    await updateDoc(ref, {
      checkin: {
        hora: new Date().toLocaleTimeString(),
        local,
      },
    });
  }
}

// Registra Check-out
export async function registrarCheckOut(
  childId: string,
  local: { lat: number; lng: number }
) {
  const hoje = new Date().toISOString().split("T")[0];

  const q = query(
    collection(db, "schedules"),
    where("childId", "==", childId),
    where("data", "==", hoje)
  );

  const docs = await getDocs(q);

  if (docs.empty) return;

  const ref = doc(db, "schedules", docs.docs[0].id);
  await updateDoc(ref, {
    checkout: {
      hora: new Date().toLocaleTimeString(),
      local,
    },
  });
}
