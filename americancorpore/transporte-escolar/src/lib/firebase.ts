// src/lib/firebase.ts
import { initializeApp, getApp, getApps, deleteApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase via variáveis de ambiente (.env.local)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Inicializa Firebase App
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

type FirebaseDebugInfo = {
  appOptions: FirebaseApp["options"];
  auth: Auth;
};

declare global {
  interface Window {
    __fb?: FirebaseDebugInfo;
  }
}

export function getSecondaryApp() {
  const name = "secondary";
  const existing = getApps().find((a) => a.name === name);
  return existing ?? initializeApp(firebaseConfig, name);
}
export async function disposeSecondary() {
  const secondary = getApps().find((a) => a.name === "secondary");
  if (secondary) await deleteApp(secondary);
}

// debug opcional
if (typeof window !== "undefined") {
  window.__fb = { appOptions: app.options, auth };
}
