import { getMasterSource } from "@/server/master/source";
import { bearerToken, secretMatches } from "@/server/secrets";
import { getClinicStore } from "@/server/store";
import { SyncBusyError } from "@/server/sync";
import { checkForChanges } from "@/server/watch";

// firebase-admin y googleapis necesitan Node.js; la respuesta nunca se guarda en caché.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Comprobación de cada minuto (Cloud Scheduler). Si la Master ha cambiado y lleva un
 * minuto sin ediciones, la sincroniza; si no, responde al momento sin leerla.
 */
export async function GET(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!secretMatches(token, process.env.CRON_SECRET)) {
    return json({ error: "No autorizado." }, 401);
  }

  try {
    const result = await checkForChanges({ source: getMasterSource(), store: getClinicStore() });
    if (result.status === "idle" || result.status === "waiting") return json({ status: result.status });
    return json(
      { status: result.status, version: result.version, clinicCount: result.clinicCount },
      result.status === "failed" ? 500 : 200,
    );
  } catch (error) {
    if (error instanceof SyncBusyError) return json({ error: "Sincronización en marcha." }, 409);
    console.error("[api/cron/sync-master]", error);
    return json({ error: "No se pudo comprobar la Master." }, 500);
  }
}
