"use client";

import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { ArrowLeft, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { RequireAuth, TopBar } from "@/components/AppShell";
import type { SyncIssue, SyncRun } from "@/core/schema";
import { useAuth, type Role } from "@/lib/auth";
import { firebaseEnabled, getDb } from "@/lib/firebase";
import { formatDateTime } from "@/lib/text";
import { cn } from "@/lib/utils";

type Run = SyncRun & { id: string };

const STATUS: Record<Run["status"], { label: string; className: string }> = {
  published: { label: "Publicada", className: "bg-emerald-50 text-emerald-700" },
  unchanged: { label: "Sin cambios", className: "bg-slate-100 text-slate-600" },
  blocked: { label: "Bloqueada", className: "bg-red-50 text-red-700" },
  failed: { label: "Error técnico", className: "bg-red-50 text-red-700" },
};

const TRIGGER: Record<Run["trigger"], string> = {
  edit: "Edición en la Master",
  manual: "«Publicar ahora»",
  schedule: "Comprobación automática",
  admin: "Administración",
};

const SEVERITY: Record<SyncIssue["severity"], { label: string; className: string }> = {
  error: { label: "No se publica", className: "bg-red-50 text-red-700" },
  warning: { label: "Revisar", className: "bg-amber-50 text-amber-800" },
  info: { label: "Información", className: "bg-slate-100 text-slate-600" },
};

const buttonClass =
  "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60";

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("whitespace-nowrap rounded-lg px-2.5 py-0.5 text-xs font-medium", className)}>{children}</span>;
}

function Issues({ issues }: { issues: SyncIssue[] }) {
  const sorted = [...issues].sort(
    (a, b) => ["error", "warning", "info"].indexOf(a.severity) - ["error", "warning", "info"].indexOf(b.severity),
  );
  if (sorted.length === 0) return <p className="text-sm text-slate-500">Sin incidencias: todas las fichas se entendieron.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Tipo</th>
            <th className="py-2 pr-3 font-medium">Clínica</th>
            <th className="py-2 pr-3 font-medium">Dónde</th>
            <th className="py-2 font-medium">Qué pasa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((issue, i) => (
            <tr key={i} className="align-top">
              <td className="py-2 pr-3">
                <Badge className={SEVERITY[issue.severity].className}>{SEVERITY[issue.severity].label}</Badge>
              </td>
              <td className="py-2 pr-3 font-medium text-slate-900">{issue.clinic ?? "—"}</td>
              <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">
                {issue.sheet.trim()}
                {issue.row ? `, fila ${issue.row}` : ""}
              </td>
              <td className="py-2 text-slate-700">{issue.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SyncSection() {
  const { getToken } = useAuth();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken();
      const response = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "La operación no se pudo completar.");
      return body;
    },
    [getToken],
  );

  const load = useCallback(async () => {
    try {
      setRuns((await call("/api/admin/runs")).runs);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el historial.");
    }
  }, [call]);

  useEffect(() => {
    // Carga inicial del historial: sincroniza la pantalla con el servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = async (action: () => Promise<Run>, done: (result: Run) => string) => {
    setBusy(true);
    try {
      const result = await action();
      if (result.status === "blocked" || result.status === "failed") toast.error(done(result));
      else toast.success(done(result));
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "La operación no se pudo completar.");
    } finally {
      setBusy(false);
    }
  };

  const sync = () =>
    run(
      () => call("/api/admin/sync", { method: "POST" }),
      (result) =>
        result.status === "published"
          ? `Versión ${result.version} publicada con ${result.clinicCount} clínicas.`
          : result.status === "unchanged"
            ? "La Master no tiene cambios."
            : "No se ha publicado. Revisa las incidencias.",
    );

  const restore = (version: number) => {
    if (!window.confirm(`¿Restaurar la versión ${version}? Los agentes verán esos datos de inmediato.`)) return;
    void run(
      () => call("/api/admin/rollback", { method: "POST", body: JSON.stringify({ version }) }),
      (result) => (result.status === "published" ? `Versión ${version} restaurada.` : "Esa versión ya es la actual."),
    );
  };

  const latest = runs?.[0];
  const currentVersion = runs?.find((r) => r.status === "published" || r.status === "unchanged")?.version ?? null;

  return (
    <>
      <section className="card p-6" aria-labelledby="admin-sync">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="admin-sync" className="text-base font-semibold text-slate-900">
              Sincronización con la Master
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {latest
                ? `Última comprobación: ${formatDateTime(latest.startedAt)} · ${latest.clinicCount} clínicas${
                    currentVersion ? ` · versión ${currentVersion}` : ""
                  }`
                : runs
                  ? "Todavía no se ha sincronizado."
                  : "Cargando…"}
            </p>
          </div>
          <button type="button" onClick={sync} disabled={busy} className={cn(buttonClass, "bg-omni text-white hover:bg-cyan-700")}>
            <RefreshCw aria-hidden className={cn("size-4", busy && "animate-spin")} />
            {busy ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {latest && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="eyebrow mb-2">Informe de calidad de la última comprobación</h3>
            <Issues issues={latest.issues} />
          </div>
        )}
      </section>

      {runs && runs.length > 0 && (
        <section className="card p-6" aria-labelledby="admin-history">
          <h2 id="admin-history" className="text-base font-semibold text-slate-900">
            Historial
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {runs.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="w-32 tabular-nums text-slate-600">{formatDateTime(item.startedAt)}</span>
                <Badge className={STATUS[item.status].className}>{STATUS[item.status].label}</Badge>
                <span className="text-slate-700">{TRIGGER[item.trigger]}</span>
                <span className="text-slate-500">
                  {item.version ? `Versión ${item.version} · ` : ""}
                  {item.clinicCount} clínicas
                </span>
                {item.status === "published" && item.version !== null && item.version !== currentVersion && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => restore(item.version!)}
                    className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  >
                    <RotateCcw aria-hidden className="size-4" />
                    Restaurar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

interface AppUser {
  email: string;
  role: Role;
}

function UsersSection() {
  const { state } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const self = state.status === "ready" ? state.email : "";

  useEffect(() => {
    if (!firebaseEnabled) return;
    return onSnapshot(collection(getDb(), "users"), (snapshot) =>
      setUsers(
        snapshot.docs
          .map((d) => ({ email: d.id, role: d.data().role === "admin" ? ("admin" as const) : ("agent" as const) }))
          .sort((a, b) => a.email.localeCompare(b.email)),
      ),
    );
  }, []);

  if (!firebaseEnabled) {
    return (
      <section className="card p-6">
        <h2 className="text-base font-semibold text-slate-900">Personas con acceso</h2>
        <p className="mt-1 text-sm text-slate-600">En modo local no hay inicio de sesión ni lista de personas.</p>
      </section>
    );
  }

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const id = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(id)) return toast.error("Escribe un correo válido.");
    try {
      await setDoc(doc(getDb(), "users", id), { role, active: true });
      setEmail("");
      toast.success(`${id} ya puede entrar.`);
    } catch {
      toast.error("No se pudo dar acceso.");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(`¿Quitar el acceso a ${id}?`)) return;
    try {
      await deleteDoc(doc(getDb(), "users", id));
    } catch {
      toast.error("No se pudo quitar el acceso.");
    }
  };

  return (
    <section className="card p-6" aria-labelledby="admin-users">
      <h2 id="admin-users" className="text-base font-semibold text-slate-900">
        Personas con acceso
      </h2>
      <p className="mt-1 text-sm text-slate-600">Entran con su cuenta de Google. El correo debe coincidir exactamente.</p>

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-medium text-slate-700" style={{ minWidth: "16rem" }}>
          Correo
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@omnionline.es"
            className="mt-1 block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-normal shadow-sm outline-none focus:border-omni focus:ring-2 focus:ring-cyan-100"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Rol
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className="mt-1 block h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal shadow-sm outline-none focus:border-omni"
          >
            <option value="agent">Agente</option>
            <option value="admin">Administración</option>
          </select>
        </label>
        <button type="submit" className={cn(buttonClass, "bg-ink text-white hover:bg-slate-800")}>
          Dar acceso
        </button>
      </form>

      <ul className="mt-4 divide-y divide-line">
        {users === null && <li className="py-3 text-sm text-slate-500">Cargando…</li>}
        {users?.map((user) => (
          <li key={user.email} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="font-medium text-slate-900">{user.email}</span>
            <Badge className={user.role === "admin" ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600"}>
              {user.role === "admin" ? "Administración" : "Agente"}
            </Badge>
            {user.email !== self && (
              <button
                type="button"
                onClick={() => remove(user.email)}
                aria-label={`Quitar el acceso a ${user.email}`}
                className="ml-auto inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <div className="min-h-full">
        <TopBar />
        <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 lg:px-6">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-omni hover:underline">
              <ArrowLeft aria-hidden className="size-4" />
              Volver a los guiones
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Administración</h1>
          </div>
          <SyncSection />
          <UsersSection />
        </main>
      </div>
    </RequireAuth>
  );
}
