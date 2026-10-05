import { z } from "zod";
import { adminEmail, json } from "@/server/adminAuth";
import { getClinicStore } from "@/server/store";
import { SnapshotNotFoundError, SyncBusyError, rollbackTo } from "@/server/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ version: z.number().int().positive() });

/** Restaura una versión anterior publicándola como versión nueva. */
export async function POST(request: Request) {
  if (!(await adminEmail(request))) return json({ error: "No autorizado." }, 401);
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "Indica la versión que quieres restaurar." }, 400);
  try {
    return json(await rollbackTo(body.data.version, getClinicStore()));
  } catch (error) {
    if (error instanceof SnapshotNotFoundError) return json({ error: `No hay copia de la versión ${body.data.version}.` }, 404);
    if (error instanceof SyncBusyError) return json({ error: "Ya hay una sincronización en marcha." }, 409);
    console.error("[admin/rollback]", error);
    return json({ error: "No se pudo restaurar." }, 500);
  }
}
