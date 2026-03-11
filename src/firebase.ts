import admin from "firebase-admin";
import { config, isFirebaseConfigured } from "./config";

let firestore: admin.firestore.Firestore | null = null;

export function initFirebase(): void {
  if (!isFirebaseConfigured()) {
    console.warn(
      "Firebase not configured — comparison logs will not be persisted",
    );
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
    firestore = admin.firestore();
    console.log("Firebase initialized");
  } catch (err) {
    console.error("Firebase init failed:", err);
  }
}

export interface LogEntry {
  timestamp: string;
  deviceId: string;
  observationId?: string | null;
  tbState: string | null;
  monitorState: string | null;
  tbHr: number | null;
  monitorHr: number | null;
  tbBr: number | null;
  monitorBr: number | null;
  result: string;
  effectiveTsMs?: number;
  payload?: unknown;
  topic?: string;
}

function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function writeLog(entry: LogEntry): Promise<void> {
  if (!firestore) return;

  try {
    const data = stripUndefined({
      ...entry,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await firestore.collection("comparison_logs").add(data);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 5 || (e.message && e.message.includes("NOT_FOUND"))) {
      console.error(
        "Firestore NOT_FOUND: Ensure Firestore is created in Firebase Console (Firestore Database → Create database) and FIREBASE_PROJECT_ID matches your project.",
      );
    } else {
      console.error("Firestore write failed:", err);
    }
  }
}
