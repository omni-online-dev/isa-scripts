"use client";

import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firebaseEnabled, getDb, getFirebaseApp } from "./firebase";

export type Role = "agent" | "admin";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  /** Sesión iniciada, pero la cuenta no está autorizada en la app. */
  | { status: "denied"; email: string }
  | { status: "ready"; email: string; role: Role; local: boolean };

interface AuthValue {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Token para llamar a las rutas de administración. null en modo local. */
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** En modo local no hay inicio de sesión: se entra como administrador. */
const LOCAL: AuthState = { status: "ready", email: "modo local", role: "admin", local: true };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(firebaseEnabled ? { status: "loading" } : LOCAL);

  useEffect(() => {
    if (!firebaseEnabled) return;
    return onAuthStateChanged(getAuth(getFirebaseApp()), async (user) => {
      if (!user?.email) return setState({ status: "signedOut" });
      const email = user.email.toLowerCase();
      try {
        // La lista de personas autorizadas vive en users/{email}. Las reglas de Firestore
        // aplican la misma comprobación; esto solo decide qué muestra la interfaz.
        const snapshot = await getDoc(doc(getDb(), "users", email));
        const data = snapshot.data();
        if (!snapshot.exists() || data?.active === false) return setState({ status: "denied", email });
        setState({ status: "ready", email, role: data?.role === "admin" ? "admin" : "agent", local: false });
      } catch {
        setState({ status: "denied", email });
      }
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      state,
      signIn: async () => {
        await signInWithPopup(getAuth(getFirebaseApp()), new GoogleAuthProvider());
      },
      signOut: async () => {
        if (firebaseEnabled) await firebaseSignOut(getAuth(getFirebaseApp()));
      },
      getToken: async () =>
        firebaseEnabled ? ((await getAuth(getFirebaseApp()).currentUser?.getIdToken()) ?? null) : null,
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return value;
}
