import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Sin configuración de Firebase la app funciona en modo local, con los datos de fixtures. */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId);

/** Espacio de datos: "prod" o "staging". Coincide con DATA_NAMESPACE del servidor. */
export const DATA_NAMESPACE = process.env.NEXT_PUBLIC_DATA_NAMESPACE ?? "staging";

export function getFirebaseApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(config);
}

let firestore: Firestore | null = null;

/** Firestore con caché en disco: la app sigue funcionando si se corta la red. */
export function getDb(): Firestore {
  firestore ??= initializeFirestore(getFirebaseApp(), { localCache: persistentLocalCache() });
  return firestore;
}
