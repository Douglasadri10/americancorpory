import * as admin from 'firebase-admin';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApp();

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  return initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

let _db: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}

/**
 * Verify a Firebase session cookie and return the decoded token.
 */
export async function verifySessionCookie(
  sessionCookie: string
): Promise<admin.auth.DecodedIdToken | null> {
  try {
    const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return decodedToken;
  } catch {
    return null;
  }
}

/**
 * Create a session cookie from a Firebase ID token.
 */
export async function createSessionCookie(
  idToken: string,
  expiresIn = 5 * 24 * 60 * 60 * 1000 // 5 days
): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, { expiresIn });
}

/**
 * Verify a Firebase ID token directly (for API routes).
 */
export async function verifyIdToken(
  idToken: string
): Promise<admin.auth.DecodedIdToken | null> {
  try {
    return await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

export { admin };
