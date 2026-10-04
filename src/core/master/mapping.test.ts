import { describe, expect, it } from "vitest";
import { ACTIVOS_IGNORED_HEADERS, classifyFichaLine, resolveActivosColumns } from "./mapping";

const REQUIRED = ["Clínica - Tratamiento", "Link a Horarios", "Estado"];

describe("resolveActivosColumns", () => {
  it("localiza las columnas por nombre aunque cambie el orden", () => {
    const { index, missing, unknown } = resolveActivosColumns([
      "Estado",
      "Presup.",
      "Link a Horarios",
      "Clínica - Tratamiento",
    ]);
    expect(index).toMatchObject({ status: 0, fichaLink: 2, clinicTreatment: 3 });
    expect(missing).toEqual([]);
    expect(unknown).toEqual([]);
  });

  it("ignora diferencias de mayúsculas, tildes y espacios", () => {
    const { missing } = resolveActivosColumns(["clinica  -  tratamiento ", "LINK A HORARIOS", "estado"]);
    expect(missing).toEqual([]);
  });

  it("avisa de columnas nuevas sin fallar", () => {
    const { missing, unknown } = resolveActivosColumns([...REQUIRED, "IA Voz Francés"]);
    expect(missing).toEqual([]);
    expect(unknown).toEqual(["IA Voz Francés"]);
  });

  it("informa de las columnas obligatorias que faltan", () => {
    const { missing } = resolveActivosColumns(["Clínica - Tratamiento", "Presup."]);
    expect(missing).toEqual(["Link a Horarios", "Estado"]);
  });

  it("no trata como nuevas las columnas ya conocidas", () => {
    const { unknown } = resolveActivosColumns([...REQUIRED, ...ACTIVOS_IGNORED_HEADERS]);
    expect(unknown).toEqual([]);
  });
});

describe("classifyFichaLine", () => {
  it.each([
    ["Dirección: Calle Mayor 1, 28013 Madrid", "address"],
    ["Dirección Badajoz: Av. de Europa, 7", "address"],
    ["Puntos de valor (implantes): carga inmediata", "valuePoints"],
    ["Script Simplificado Implantes y Ortodoncia", "script"],
    ["Criterios de financiación Implantes", "qualificationHeader"],
    ["DNI: Nómina, Jubilados", "dni"],
    ["NIE: Nómina", "nie"],
    ["Pasaporte: Cuenta bancaria", "pasaporte"],
    ["Financiación: hasta 60 meses sin intereses", "financing"],
    ["Ayuda: No reciben pacientes con ayudas", "aid"],
    ["Seguros: no aceptan seguros", "insurance"],
    ["Recordatorio: SI", "reminder"],
    ["Whatsapp: Subcuenta", "whatsapp"],
    ["WhatsApp: Subcuenta", "whatsapp"],
    ["Agendamiento el mismo día: NO", "sameDayBooking"],
    ["Agendamiento a largo plazo Ortodoncia (+ de 72 horas de antelación): SI", "longTermBooking"],
    ["PROMOCIÓN", "promoHeader"],
    ["CRITERIOS PARA FORMULARIO MB:", "mbFormHeader"],
  ])("%s → %s", (line, label) => {
    expect(classifyFichaLine(line)).toBe(label);
  });

  it("devuelve null para líneas que no son etiquetas", () => {
    expect(classifyFichaLine("Descuento: 30%")).toBeNull();
    expect(classifyFichaLine("")).toBeNull();
  });
});
