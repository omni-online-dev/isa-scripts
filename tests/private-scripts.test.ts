/**
 * Guiones generados con la Master real. Solo se ejecuta si existe
 * fixtures/private/master.json; escribe fixtures/private/scripts.txt para revisarlos.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseMaster, type MasterInput } from "@/core/master";
import { TREATMENT_KEYS } from "@/core/schema";
import { buildScript, scriptToPlainText } from "@/core/scripts";

const dir = path.resolve(import.meta.dirname, "../fixtures/private");
const source = path.join(dir, "master.json");

describe.skipIf(!fs.existsSync(source))("guiones con la Master real", () => {
  it("genera un guion válido para cada clínica y tratamiento", () => {
    const { clinics } = parseMaster(JSON.parse(fs.readFileSync(source, "utf8")) as MasterInput);
    const out: string[] = [];
    const used: Record<string, number> = {};
    for (const clinic of clinics) {
      for (const key of TREATMENT_KEYS) {
        const script = buildScript(clinic, key);
        if (!script) continue;
        used[script.template] = (used[script.template] ?? 0) + 1;
        expect(script.steps.length).toBeGreaterThan(2);
        expect(JSON.stringify(script)).not.toMatch(/undefined|\$\{|<b>/);
        out.push(`=== [${script.template}] ${scriptToPlainText(script, clinic.name)}`);
      }
    }
    fs.writeFileSync(path.join(dir, "scripts.txt"), `${JSON.stringify(used)}\n\n${out.join("\n\n")}`);
  });
});
