import { adminEmail, json } from "@/server/adminAuth";
import { getMasterSource } from "@/server/master/source";
import { getClinicStore } from "@/server/store";
import { SyncBusyError, runSync } from "@/server/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** «Sincronizar ahora» desde la pantalla de administración. */
export async function POST(request: Request) {
  if (!(await adminEmail(request))) return json({ error: "No autorizado." }, 401);
  try {
    return json(await runSync({ source: getMasterSource(), store: getClinicStore(), trigger: "admin" }));
  } catch (error) {
    if (error instanceof SyncBusyError) return json({ error: "Ya hay una sincronización en marcha." }, 409);
    console.error("[admin/sync]", error);
    return json({ error: "No se pudo sincronizar." }, 500);
  }
}
