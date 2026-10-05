"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

function Brand() {
  return (
    <Link href="/" className="flex items-baseline gap-1.5 rounded-lg">
      <span className="text-base font-extrabold tracking-tight text-ink">OMNI</span>
      <span className="text-base font-medium text-omni">Scripts ISA</span>
    </Link>
  );
}

/** Barra superior: marca, acceso a administración y sesión. */
export function TopBar() {
  const { state, signOut } = useAuth();
  if (state.status !== "ready") return null;
  return (
    <div className="bg-white">
      <div className="h-1 bg-gradient-to-r from-cyan-400 via-teal-500 to-cyan-400" />
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center justify-between px-4 lg:px-6">
        <Brand />
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <span className="mr-2 hidden sm:inline">{state.email}</span>
          {state.role === "admin" && (
            <Link
              href="/admin"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Settings aria-hidden className="size-4" />
              Administración
            </Link>
          )}
          {!state.local && (
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut aria-hidden className="size-4" />
              Salir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-col">
      <div className="h-1 bg-gradient-to-r from-cyan-400 via-teal-500 to-cyan-400" />
      <div className="flex flex-1 items-center justify-center p-6">
        <section className="card w-full max-w-sm p-8 text-center">{children}</section>
      </div>
    </main>
  );
}

export function LoadingScreen({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex min-h-full items-center justify-center" role="status">
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function MessageScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Centered>
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <div className="mt-2 space-y-4 text-sm text-slate-600">{children}</div>
    </Centered>
  );
}

/**
 * Exige sesión antes de mostrar el contenido. La protección real de los datos está en
 * las reglas de Firestore; esto solo decide qué pantalla ve la persona.
 */
export function RequireAuth({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { state, signIn, signOut } = useAuth();

  if (state.status === "loading") return <LoadingScreen />;

  if (state.status === "signedOut") {
    return (
      <Centered>
        <p className="eyebrow">Omni Dental</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">OmniScripts ISA</h1>
        <p className="mt-2 text-sm text-slate-600">Guiones de llamada, siempre al día con la Master.</p>
        <button
          type="button"
          onClick={() => signIn().catch(() => undefined)}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-omni px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cyan-700"
        >
          Entrar con Google
        </button>
        <p className="mt-3 text-xs text-slate-500">Usa tu cuenta corporativa de Omni.</p>
      </Centered>
    );
  }

  if (state.status === "denied") {
    return (
      <MessageScreen title="Tu cuenta no tiene acceso">
        <p>
          <span className="font-medium text-slate-900">{state.email}</span> no está en la lista de personas autorizadas.
          Pide el acceso a Soporte.
        </p>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-line bg-white px-4 font-medium text-slate-700 hover:border-slate-300"
        >
          Entrar con otra cuenta
        </button>
      </MessageScreen>
    );
  }

  if (adminOnly && state.role !== "admin") {
    return (
      <MessageScreen title="Solo para administración">
        <p>Esta sección es para el equipo de Soporte.</p>
        <Link href="/" className="font-medium text-omni hover:underline">
          Volver a los guiones
        </Link>
      </MessageScreen>
    );
  }

  return <>{children}</>;
}
