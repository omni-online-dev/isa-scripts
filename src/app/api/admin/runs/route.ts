import { adminEmail, json } from "@/server/adminAuth";
import { getClinicStore } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Últimas sincronizaciones con su informe de calidad. */
export async function GET(request: Request) {
  if (!(await adminEmail(request))) return json({ error: "No autorizado." }, 401);
  try {
    return json({ runs: await getClinicStore().listRuns(20) });
  } catch (error) {
    console.error("[admin/runs]", error);
    return json({ error: "No se pudo leer el historial." }, 500);
  }
}
