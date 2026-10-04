import { describe, expect, it } from "vitest";
import { masterFixture } from "../../../fixtures/master.fixture";
import { parseMaster } from "../master";
import { TREATMENT_KEYS, type Clinic } from "../schema";
import { locationSentence, stripPostalCode } from "./context";
import { buildScript, scriptToPlainText } from "./engine";
import { CALL_KINDS } from "./types";

const { clinics } = parseMaster(masterFixture);
const clinic = (id: string): Clinic => {
  const found = clinics.find((c) => c.id === id);
  if (!found) throw new Error(`Falta ${id} en la fixture`);
  return found;
};
const titles = (c: Clinic, key: Parameters<typeof buildScript>[1]) =>
  buildScript(c, key)!.steps.map((s) => s.title);

describe("contexto", () => {
  it("quita el código postal de la dirección", () => {
    expect(stripPostalCode("Calle del Río, 10, 28001 Madrid")).toBe("Calle del Río, 10, Madrid");
    expect(stripPostalCode("Av. de Europa, 7, A, 06004, Badajoz.")).toBe("Av. de Europa, 7, A, Badajoz");
  });

  it("redacta la ubicación según la referencia", () => {
    expect(locationSentence("Calle Uno", null)).toBe("Estamos ubicados en **Calle Uno**. ¿La zona te suena?");
    expect(locationSentence("Calle Uno", "Frente a la estación")).toBe(
      "Estamos ubicados en **Calle Uno**, frente a la estación. ¿La zona te suena?",
    );
    expect(locationSentence("Calle Uno", "el mercado central.")).toBe(
      "Estamos ubicados en **Calle Uno**, muy cerca de el mercado central. ¿La zona te suena?",
    );
  });
});

describe("buildScript · elección de guion", () => {
  it("usa el guion simplificado cuando lo indica la Master", () => {
    const script = buildScript(clinic("clinica-dental-norte"), "implantes")!;
    expect(script.template).toBe("simplificado");
    expect(script.steps.map((s) => s.title)).toEqual([
      "Saludo",
      "Motivo de llamada",
      "Ubicación",
      "Agendamiento",
      "Confirmación",
      "Despedida",
    ]);
    expect(script.steps[1]!.text).toContain("valoración gratuita de implantes");
  });

  it("usa el guion completo del tratamiento para «Selectivo»", () => {
    const sur = clinic("clinica-dental-sur");
    expect(buildScript(sur, "blanqueamiento")!.template).toBe("tratamiento:blanqueamiento");
    expect(buildScript(clinic("dr-ejemplo-dental-islas"), "implantes")!.template).toBe("tratamiento:implantes");
  });

  it("devuelve null si la clínica no ofrece el tratamiento", () => {
    expect(buildScript(clinic("clinica-dental-norte"), "carillas")).toBeNull();
  });

  it("reprogramación y recontacto valen para cualquier clínica", () => {
    const norte = clinic("clinica-dental-norte");
    expect(buildScript(norte, "implantes", "reprogramacion")!.template).toBe("reprogramacion");
    expect(buildScript(norte, "implantes", "recontacto")!.steps[0]!.text).toContain("informarte sobre implantes");
  });

  it("aplica el guion propio de una clínica registrada, salvo que la Master diga simplificado", () => {
    const base = clinic("dr-ejemplo-dental-islas");
    const ardenne = { ...base, id: "ardenne-dental" };
    expect(buildScript(ardenne, "implantes")!.template).toBe("clinica:ardenne");

    const simplificada: Clinic = {
      ...ardenne,
      treatments: { implantes: { ...ardenne.treatments.implantes!, scriptVariant: "simplificado" } },
    };
    expect(buildScript(simplificada, "implantes")!.template).toBe("simplificado");
  });

  it("avisa cuando la Master pide un guion propio que no está cargado", () => {
    const base = clinic("dr-ejemplo-dental-islas");
    const propio: Clinic = {
      ...base,
      treatments: { implantes: { ...base.treatments.implantes!, scriptVariant: "propio" } },
    };
    expect(buildScript(propio, "implantes")!.notice).toContain("guion propio");
    expect(buildScript(base, "implantes")!.notice).toBeNull();
  });
});

describe("buildScript · contenido", () => {
  const islas = clinic("dr-ejemplo-dental-islas");
  const script = buildScript(islas, "implantes")!;
  const step = (title: string) => script.steps.find((s) => s.title === title)!;

  it("inserta los datos de la ficha en el guion", () => {
    expect(step("Saludo + Encaje + Ubicación").text).toContain("te llamo de **Dr. Ejemplo ı Dental Islas**");
    expect(step("Saludo + Encaje + Ubicación").text).toContain("Estamos ubicados en **Calle Uno 1, Local 5**");
    expect(step("Autoridad + Oferta").text).toContain("**Implantólogos con años de experiencia.**");
    expect(step("Autoridad + Oferta").text).toContain("una promoción vigente: **Descuento: 10%**");
    expect(step("Cualificación documental").text).toContain("Aceptamos: **DNI**.");
  });

  it("incluye la cualificación económica solo si la ficha trae criterios por documento", () => {
    expect(step("Cualificación económica").note).toContain("→ DNI: Nómina");

    const sur = clinic("clinica-dental-sur");
    expect(titles(sur, "implantes")).not.toContain("Cualificación económica"); // simplificado
    const ortodonciaCompleta: Clinic = {
      ...sur,
      treatments: { ortodoncia: { ...sur.treatments.ortodoncia!, scriptVariant: "selectivo" } },
    };
    const built = buildScript(ortodonciaCompleta, "ortodoncia")!;
    expect(built.steps.map((s) => s.title)).not.toContain("Cualificación económica");
    expect(built.steps.find((s) => s.title === "Cualificación documental")!.note).toContain("No cualificamos");
  });

  it("numera los pasos de forma consecutiva aunque se omita alguno", () => {
    for (const c of clinics) {
      for (const key of TREATMENT_KEYS) {
        for (const kind of CALL_KINDS) {
          const built = buildScript(c, key, kind);
          if (!built) continue;
          expect(built.steps.map((s) => s.number)).toEqual(built.steps.map((_, i) => i + 1));
        }
      }
    }
  });

  it("nunca deja marcas sin sustituir ni valores vacíos", () => {
    for (const c of clinics) {
      for (const key of TREATMENT_KEYS) {
        for (const kind of CALL_KINDS) {
          const built = buildScript(c, key, kind);
          if (!built) continue;
          const text = JSON.stringify(built);
          expect(text).not.toMatch(/undefined|null\b(?!,|})|\$\{|<b>|\*\*\*\*/);
          expect(text).not.toContain("promoción vigente: ****");
        }
      }
    }
  });

  it("omite la promoción cuando la ficha no la tiene", () => {
    const sinPromo: Clinic = {
      ...islas,
      treatments: { implantes: { ...islas.treatments.implantes!, promo: [] } },
    };
    const built = buildScript(sinPromo, "implantes")!;
    expect(JSON.stringify(built)).not.toContain("promoción vigente");
    expect(buildScript(sinPromo, "implantes", "reprogramacion")!.steps[1]!.text).toMatch(/^¿Deseas agendar/);
  });
});

describe("scriptToPlainText", () => {
  it("genera texto sin marcas de formato", () => {
    const c = clinic("dr-ejemplo-dental-islas");
    const text = scriptToPlainText(buildScript(c, "implantes")!, c.name);
    expect(text).toMatch(/^Dr\. Ejemplo ı Dental Islas · Implantes dentales\n\n1\. SALUDO/);
    expect(text).not.toContain("**");
    expect(text).toContain("Si no cumple o pone pegas:");
  });
});
