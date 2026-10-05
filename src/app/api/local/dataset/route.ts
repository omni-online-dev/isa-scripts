/**
 * Datos para el modo local (sin Firebase): interpreta un volcado de la Master
 * guardado en disco. No existe en producción.
 */
import fs from "fs/promises";
import path from "path";
import { parseMaster, type MasterInput } from "@/core/master";

export const dynamic = "force-dynamic";

/** Primero la Master real (carpeta ignorada por git); si no está, la ficticia. */
const CANDIDATES = [
  process.env.MASTER_LOCAL_FILE,
  "fixtures/private/master.json",
  "fixtures/demo-master.json",
].filter((file): file is string => Boolean(file));

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });

  for (const file of CANDIDATES) {
    try {
      const raw = await fs.readFile(path.resolve(process.cwd(), file), "utf8");
      const { clinics, issues } = parseMaster(JSON.parse(raw) as MasterInput);
      return Response.json({
        clinics,
        issues,
        meta: { version: 0, publishedAt: new Date().toISOString(), clinicCount: clinics.length },
      });
    } catch {
      continue;
    }
  }
  return Response.json({ error: "No hay ningún volcado de la Master en fixtures/." }, { status: 404 });
}
