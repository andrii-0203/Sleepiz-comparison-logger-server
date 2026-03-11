import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT ?? "3011", 10),
  vercelUrl: process.env.VERCEL_URL ?? "http://localhost:3000",
  vercelAuthUser: process.env.VERCEL_AUTH_USER ?? "",
  vercelAuthPassword: process.env.VERCEL_AUTH_PASSWORD ?? "",
  logMode: (process.env.LOG_MODE ?? "mismatch") as "mismatch" | "all",
  logPayload: process.env.LOG_PAYLOAD === "true",
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },
};

export function isFirebaseConfigured(): boolean {
  return !!(
    config.firebase.projectId &&
    config.firebase.clientEmail &&
    config.firebase.privateKey
  );
}
