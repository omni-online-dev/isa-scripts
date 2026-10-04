/**
 * Validación contra la Master real. Solo se ejecuta si existe
 * fixtures/private/master.json (carpeta ignorada por git); en CI se omite.
 * Escribe el informe de calidad en fixtures/private/report.json.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseMaster, type MasterInput } from "@/core/master";

const dir = path.resolve(import.meta.dirname, "../fixtures/private");
const source = path.join(dir, "master.json");

describe.skipIf(!fs.existsSync(source))("Master real", () => {
  it("se interpreta sin bloqueos y con al menos el 95 % de fichas publicadas", () => {
    const input = JSON.parse(fs.readFileSync(source, "utf8")) as MasterInput;
    const { clinics, issues, blocked } = parseMaster(input);

    const count = (key: "code" | "severity") =>
      issues.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i[key]]: (acc[i[key]] ?? 0) + 1 }), {});
    const excluded = issues.filter((i) => i.severity === "error").map((i) => i.clinic);
    fs.writeFileSync(
      path.join(dir, "report.json"),
      JSON.stringify({ clinics: clinics.length, blocked, bySeverity: count("severity"), byCode: count("code"), issues, published: clinics }, null, 1),
    );

    expect(blocked).toBe(false);
    expect(clinics.length / (clinics.length + excluded.length)).toBeGreaterThanOrEqual(0.95);
  });
});
