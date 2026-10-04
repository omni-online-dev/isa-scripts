import { describe, expect, it } from "vitest";
import {
  normalizeStatus,
  normalizeText,
  normalizeTreatment,
  parseYesNo,
  slugify,
  splitClinicTreatment,
} from "./normalize";

describe("normalizeText", () => {
  it("quita tildes, mayúsculas y espacios sobrantes", () => {
    expect(normalizeText("  PROMOCIÓN  \n Válida ")).toBe("promocion valida");
  });
});

describe("slugify", () => {
  it("genera un identificador estable", () => {
    expect(slugify("Clínica Dental Rodriguez & Pons")).toBe("clinica-dental-rodriguez-y-pons");
    expect(slugify("Clínicas Dental Star ı Holea")).toBe("clinicas-dental-star-holea");
    expect(slugify("Odonto·Estética Marina Baixa")).toBe("odonto-estetica-marina-baixa");
  });
});

describe("splitClinicTreatment", () => {
  it("separa por el último guion", () => {
    expect(splitClinicTreatment("Clínica Dental Usera - Implantes")).toEqual({
      clinic: "Clínica Dental Usera",
      treatment: "Implantes",
    });
    expect(splitClinicTreatment("Centro A - Sede Norte - Ortodoncia")).toEqual({
      clinic: "Centro A - Sede Norte",
      treatment: "Ortodoncia",
    });
  });

  it("devuelve tratamiento null si la celda no lo trae", () => {
    expect(splitClinicTreatment("Clínica Sin Tratamiento")).toEqual({
      clinic: "Clínica Sin Tratamiento",
      treatment: null,
    });
  });
});

describe("normalizeTreatment", () => {
  it("reconoce tratamiento y canal", () => {
    expect(normalizeTreatment("Implantes")).toEqual({ key: "implantes", channel: null });
    expect(normalizeTreatment("Implantes Meta")).toEqual({ key: "implantes", channel: "meta" });
    expect(normalizeTreatment("Apnea del Sueño Google")).toEqual({ key: "apnea", channel: "google" });
    expect(normalizeTreatment("Estética")).toEqual({ key: "estetica", channel: null });
  });

  it("tolera erratas conocidas", () => {
    expect(normalizeTreatment("Cariillas")?.key).toBe("carillas");
  });

  it("devuelve null para tratamientos sin plantilla", () => {
    expect(normalizeTreatment("Emerald Láser")).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it("mapea los estados de Activos", () => {
    expect(normalizeStatus("Activa")).toBe("activa");
    expect(normalizeStatus("Pausa Temporal")).toBe("pausa_temporal");
    expect(normalizeStatus("")).toBe("desconocido");
  });
});

describe("parseYesNo", () => {
  it("lee SI y NO aunque lleven texto detrás", () => {
    expect(parseYesNo("SI")).toBe(true);
    expect(parseYesNo("Sí, salvo viernes")).toBe(true);
    expect(parseYesNo("NO")).toBe(false);
    expect(parseYesNo("Consultar")).toBeNull();
  });
});
