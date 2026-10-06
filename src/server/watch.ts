import type { MasterSource } from "./master/source";
import type { ClinicStore, StoredRun } from "./store";
import { runSync } from "./sync";

/** Tiempo sin ediciones antes de publicar: evita publicar una ficha a medio escribir. */
export const QUIET_MS = 60_000;

export type WatchResult =
  /** La hoja no ha cambiado desde la última comprobación. No se lee ni se registra nada. */
  | { status: "idle" }
  /** Hay cambios, pero alguien sigue editando. Se publicará en la siguiente pasada. */
  | { status: "waiting" }
  | StoredRun;

export interface WatchOptions {
  source: MasterSource;
  store: ClinicStore;
  now?: () => Date;
  quietMs?: number;
}

/**
 * Comprobación de cada minuto. Mira la fecha de modificación de la hoja (una consulta
 * ligera a Drive) y solo sincroniza cuando ha cambiado y lleva `quietMs` sin ediciones.
 *
 * Sustituye al disparador dentro de la hoja: la Master no admite scripts.
 */
export async function checkForChanges({
  source,
  store,
  now = () => new Date(),
  quietMs = QUIET_MS,
}: WatchOptions): Promise<WatchResult> {
  const modifiedTime = await source.modifiedTime();

  if (modifiedTime !== null) {
    if (modifiedTime === (await store.getWatermark())) return { status: "idle" };
    if (now().getTime() - new Date(modifiedTime).getTime() < quietMs) return { status: "waiting" };
  }

  // Sin fecha de modificación no se puede saber si hay cambios: se sincroniza siempre.
  const run = await runSync({ source, store, trigger: modifiedTime === null ? "schedule" : "edit", now });

  // Un fallo técnico se reintenta en la siguiente pasada. Lo demás (publicada, sin
  // cambios, bloqueada) ya está procesado: no se repite hasta que la hoja vuelva a cambiar.
  if (modifiedTime !== null && run.status !== "failed") await store.setWatermark(modifiedTime);
  return run;
}
