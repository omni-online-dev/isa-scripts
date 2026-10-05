import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** ID del proyecto: el de Firebase o, en Cloud Run / App Hosting, el de Google Cloud. */
export const projectId = (env: NodeJS.ProcessEnv = process.env): string | undefined =>
  env.FIREBASE_PROJECT_ID?.trim() || env.GOOGLE_CLOUD_PROJECT?.trim() || undefined;

/** Una sola instancia por proceso, con las credenciales por defecto del entorno (ADC). */
function adminApp(): App {
  return getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: projectId() });
}

export function getAdminDb(): Firestore {
  return getFirestore(adminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(adminApp());
}
