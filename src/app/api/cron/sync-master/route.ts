import { getMasterSource } from "@/server/master/source";
import { bearerToken, secretMatches } from "@/server/secrets";
import { getClinicStore } from "@/server/store";
import { SyncBusyError, runSync } from "@/server/sync";

// firebase-admin y googleapis necesitan Node.js; la respuesta nunca se guarda en caché.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Conciliación programada (Cloud Scheduler): recoge lo que el disparador no haya visto. */
export async function GET(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!secretMatches(token, process.env.CRON_SECRET)) {
    return json({ error: "No autorizado." }, 401);
  }

  try {
    const run = await runSync({
      source: getMasterSource(),
      store: getClinicStore(),
      trigger: "schedule",
    });
    return json(
      { status: run.status, version: run.version, clinicCount: run.clinicCount },
      run.status === "failed" ? 500 : 200,
    );
  } catch (error) {
    if (error instanceof SyncBusyError) return json({ error: "Sincronización en marcha." }, 409);
    console.error("[api/cron/sync-master]", error);
    return json({ error: "No se pudo sincronizar." }, 500);
  }
}
