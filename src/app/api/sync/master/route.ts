import { z } from "zod";
import { getMasterSource } from "@/server/master/source";
import { secretMatches } from "@/server/secrets";
import { getClinicStore } from "@/server/store";
import { SyncBusyError, runSync } from "@/server/sync";

// firebase-admin y googleapis necesitan Node.js; la respuesta nunca se guarda en caché.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ trigger: z.enum(["edit", "manual"]).default("edit") });

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function readBody(request: Request) {
  const text = (await request.text()).trim();
  if (!text) return BodySchema.safeParse({});
  try {
    return BodySchema.safeParse(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Disparo desde el Apps Script de la Master (edición o «Publicar ahora»). */
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-sync-secret"), process.env.SYNC_SECRET)) {
    return json({ error: "No autorizado." }, 401);
  }

  const body = await readBody(request);
  if (!body?.success) return json({ error: "Petición no válida." }, 400);

  try {
    const run = await runSync({
      source: getMasterSource(),
      store: getClinicStore(),
      trigger: body.data.trigger,
    });
    return json(
      {
        status: run.status,
        version: run.version,
        clinicCount: run.clinicCount,
        // Al editor solo le llegan los problemas que puede arreglar.
        issues: run.issues.filter((issue) => issue.severity !== "info"),
      },
      run.status === "failed" ? 500 : 200,
    );
  } catch (error) {
    if (error instanceof SyncBusyError) {
      return json({ error: "Ya hay una sincronización en marcha. Inténtalo en un minuto." }, 409);
    }
    console.error("[api/sync/master]", error);
    return json({ error: "No se pudo sincronizar." }, 500);
  }
}
