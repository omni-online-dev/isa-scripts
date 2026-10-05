import { createHash } from "crypto";
import { z } from "zod";
import { parseMaster } from "@/core/master";
import { SHEETS } from "@/core/master/mapping";
import {
  ClinicSchema,
  type Clinic,
  type SyncIssue,
  type SyncRun,
  type SyncStatus,
  type SyncTrigger,
} from "@/core/schema";
import { MasterSheetNotFoundError, type MasterSource } from "./master/source";
import type { ClinicStore, PublishedState, StoredRun } from "./store";

/** Ya hay otra sincronización en marcha. La ruta responde 409. */
export class SyncBusyError extends Error {
  constructor() {
    super("Ya hay una sincronización en marcha.");
    this.name = "SyncBusyError";
  }
}

/** Se pidió restaurar una versión que no tiene copia guardada. */
export class SnapshotNotFoundError extends Error {
  constructor(readonly version: number) {
    super(`No hay copia de la versión ${version}.`);
    this.name = "SnapshotNotFoundError";
  }
}

/** El cerrojo caduca solo si el proceso muere a mitad de una sincronización. */
const LOCK_TTL_MS = 120_000;
const LOCK_WAIT_MS = 10_000;
const LOCK_RETRY_MS = 500;

/** Por debajo de esta proporción de clínicas respecto a lo publicado, no se publica. */
const MIN_KEPT_RATIO = 0.5;

/** JSON con las claves ordenadas: el mismo contenido da siempre el mismo texto. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const byId = (a: Clinic, b: Clinic) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Huella del conjunto de clínicas. No depende del orden de las filas ni de las claves. */
export function checksumOf(clinics: readonly Clinic[]): string {
  return createHash("sha256").update(stableStringify([...clinics].sort(byId))).digest("hex");
}

export interface ClinicDiff {
  added: string[];
  changed: string[];
  removed: string[];
}

export function diffClinics(before: readonly Clinic[], after: readonly Clinic[]): ClinicDiff {
  const previous = new Map(before.map((c) => [c.id, stableStringify(c)]));
  const next = new Set(after.map((c) => c.id));
  return {
    added: after.filter((c) => !previous.has(c.id)).map((c) => c.id),
    changed: after
      .filter((c) => previous.has(c.id) && previous.get(c.id) !== stableStringify(c))
      .map((c) => c.id),
    removed: before.filter((c) => !next.has(c.id)).map((c) => c.id),
  };
}

type Outcome = Pick<SyncRun, "status" | "version" | "clinicCount" | "issues">;

const outcome = (
  status: SyncStatus,
  version: number | null,
  clinicCount: number,
  issues: SyncIssue[] = [],
): Outcome => ({ status, version, clinicCount, issues });

async function acquireLock(store: ClinicStore, waitMs: number): Promise<void> {
  const deadline = Date.now() + waitMs;
  while (!(await store.acquireLock(LOCK_TTL_MS))) {
    if (Date.now() + LOCK_RETRY_MS > deadline) throw new SyncBusyError();
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
}

/** Publica `clinics` como versión nueva, salvo que sea idéntico a lo ya publicado. */
async function publishIfChanged(
  store: ClinicStore,
  current: PublishedState | null,
  clinics: Clinic[],
  trigger: SyncTrigger,
  publishedAt: Date,
  issues: SyncIssue[],
): Promise<Outcome> {
  const checksum = checksumOf(clinics);
  if (current && current.checksum === checksum) {
    return outcome("unchanged", current.version, clinics.length, issues);
  }

  const diff = diffClinics(current?.clinics ?? [], clinics);
  const touched = new Set([...diff.added, ...diff.changed]);
  const version = (current?.version ?? 0) + 1;
  await store.publish({
    version,
    checksum,
    publishedAt: publishedAt.toISOString(),
    trigger,
    clinics,
    changed: clinics.filter((c) => touched.has(c.id)),
    removed: diff.removed,
  });
  return outcome("published", version, clinics.length, issues);
}

function suspiciousDrop(current: PublishedState | null, found: number): SyncIssue | null {
  const published = current?.clinics.length ?? 0;
  if (published === 0 || (found > 0 && found >= published * MIN_KEPT_RATIO)) return null;
  return {
    severity: "error",
    code: "suspicious_drop",
    sheet: SHEETS.activos,
    row: null,
    clinic: null,
    message:
      `La Master solo deja ${found} clínicas publicables y ahora hay ${published} en la app. ` +
      "Es una caída demasiado grande para ser un cambio normal, así que no se ha publicado nada: " +
      "la app sigue con los datos anteriores. Revisa si se han borrado filas de Activos, " +
      "enlaces de «Link a Horarios» o fichas. Si la bajada es correcta, avisa a Soporte.",
  };
}

async function syncOnce(
  source: MasterSource,
  store: ClinicStore,
  trigger: SyncTrigger,
  startedAt: Date,
): Promise<Outcome> {
  let parsed;
  try {
    parsed = parseMaster(await source.read());
  } catch (error) {
    if (!(error instanceof MasterSheetNotFoundError)) throw error;
    return outcome("blocked", null, 0, [
      {
        severity: "error",
        code: "sheet_not_found",
        sheet: error.sheet,
        row: null,
        clinic: null,
        message:
          `No se encuentra la pestaña «${error.sheet}» en la Master. ` +
          "Comprueba que no se ha renombrado ni borrado. No se ha publicado nada.",
      },
    ]);
  }

  const { clinics, issues, blocked } = parsed;
  if (blocked) return outcome("blocked", null, clinics.length, issues);

  const current = await store.getCurrent();
  const drop = suspiciousDrop(current, clinics.length);
  if (drop) return outcome("blocked", null, clinics.length, [...issues, drop]);

  return publishIfChanged(store, current, clinics, trigger, startedAt, issues);
}

/** Ejecuta `work` con el cerrojo tomado y deja siempre constancia en `syncRuns`. */
async function recordedRun(
  store: ClinicStore,
  trigger: SyncTrigger,
  startedAt: Date,
  lockWaitMs: number,
  work: () => Promise<Outcome>,
): Promise<StoredRun> {
  const started = Date.now();
  await acquireLock(store, lockWaitMs);
  try {
    let result: Outcome;
    try {
      result = await work();
    } catch (error) {
      // El detalle se queda en el registro del servidor; fuera solo sale «failed».
      console.error("[sync] La sincronización ha fallado:", error);
      result = outcome("failed", null, 0);
    }
    const run: SyncRun = {
      ...result,
      trigger,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - started,
    };
    return { ...run, id: await store.saveRun(run) };
  } finally {
    await store.releaseLock().catch((error) => console.error("[sync] No se liberó el cerrojo:", error));
  }
}

export interface RunSyncOptions {
  source: MasterSource;
  store: ClinicStore;
  trigger: SyncTrigger;
  now?: () => Date;
  /** Cuánto esperar si hay otra sincronización en marcha antes de rendirse. */
  lockWaitMs?: number;
}

/**
 * Lee la Master, la valida y publica solo lo que ha cambiado.
 * Si algo no cuadra (columna que falta, caída brusca de clínicas) no publica y la app
 * sigue con la última versión válida. Lanza `SyncBusyError` si no consigue el cerrojo.
 */
export function runSync({
  source,
  store,
  trigger,
  now = () => new Date(),
  lockWaitMs = LOCK_WAIT_MS,
}: RunSyncOptions): Promise<StoredRun> {
  const startedAt = now();
  return recordedRun(store, trigger, startedAt, lockWaitMs, () =>
    syncOnce(source, store, trigger, startedAt),
  );
}

/**
 * Restaura una versión anterior publicándola como versión NUEVA: el historial no se
 * reescribe. Lanza `SnapshotNotFoundError` si esa versión no tiene copia.
 */
export async function rollbackTo(
  version: number,
  store: ClinicStore,
  now: () => Date = () => new Date(),
): Promise<StoredRun> {
  const snapshot = await store.getSnapshot(version);
  if (!snapshot) throw new SnapshotNotFoundError(version);
  const clinics = z.array(ClinicSchema).parse(snapshot.clinics);

  const startedAt = now();
  return recordedRun(store, "admin", startedAt, LOCK_WAIT_MS, async () =>
    publishIfChanged(store, await store.getCurrent(), clinics, "admin", startedAt, []),
  );
}
