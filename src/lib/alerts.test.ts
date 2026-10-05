import { describe, expect, it } from "vitest";
import { masterFixture } from "../../fixtures/master.fixture";
import { parseMaster } from "@/core/master";
import { clinicAlerts } from "./alerts";

const { clinics } = parseMaster(masterFixture);
const norte = clinics.find((c) => c.id === "clinica-dental-norte")!; // vacaciones 1–16 de agosto de 2026
const sur = clinics.find((c) => c.id === "clinica-dental-sur")!; // ortodoncia en pausa, 30 jul – 13 ago

describe("clinicAlerts", () => {
  it("no avisa de nada en un día normal", () => {
    expect(clinicAlerts(norte, norte.treatments.implantes!, "2026-10-04")).toEqual([]);
  });

  it("avisa de vacaciones en curso y próximas", () => {
    expect(clinicAlerts(norte, norte.treatments.implantes!, "2026-08-10")).toEqual([
      { tone: "warning", message: "Clínica de vacaciones hasta el 16 de agosto." },
    ]);
    expect(clinicAlerts(norte, norte.treatments.implantes!, "2026-07-20")).toEqual([
      { tone: "info", message: "La clínica estará de vacaciones del 1 de agosto al 16 de agosto." },
    ]);
  });

  it("avisa del estado y de la pausa del tratamiento", () => {
    const alerts = clinicAlerts(sur, sur.treatments.ortodoncia!, "2026-08-01");
    expect(alerts.map((a) => a.tone)).toEqual(["warning", "warning"]);
    expect(alerts[0]!.message).toContain("pausa temporal");
    expect(alerts[1]!.message).toBe("Llamadas de ISA en pausa hasta el 13 de agosto.");
  });
});
