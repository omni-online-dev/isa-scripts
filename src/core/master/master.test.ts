import { describe, expect, it } from "vitest";
import { activosSheet, anchors, fichasSheet, masterFixture } from "../../../fixtures/master.fixture";
import { parseMaster } from "./index";
import { findTreatments, parseAnchorRow, parseMasterDate } from "./normalize";

const result = parseMaster(masterFixture);
const clinic = (id: string) => {
  const found = result.clinics.find((c) => c.id === id);
  if (!found) throw new Error(`No se publicó ${id}`);
  return found;
};
const issues = (code: string) => result.issues.filter((i) => i.code === code);

describe("utilidades", () => {
  it("findTreatments separa tratamientos y resto", () => {
    expect(findTreatments("Implantes y Carillas Valladolid")).toEqual({
      treatments: ["implantes", "carillas"],
      rest: "Valladolid",
    });
    expect(findTreatments("Implantes -Pacientes con DNI").rest).toBe("Pacientes con DNI");
    expect(findTreatments("Apnea del Sueño")).toEqual({ treatments: ["apnea"], rest: "" });
    expect(findTreatments("Leer Nota").treatments).toEqual([]);
  });

  it("parseAnchorRow entiende enlaces de Sheets y de Excel", () => {
    expect(parseAnchorRow("#gid=123&range=A69")).toBe(69);
    expect(parseAnchorRow("#'Horarios '!A1206")).toBe(1206);
    expect(parseAnchorRow("https://ejemplo.com")).toBeNull();
    expect(parseAnchorRow(null)).toBeNull();
  });

  it("parseMasterDate acepta número de serie, día/mes/año e ISO", () => {
    expect(parseMasterDate("46235")).toBe("2026-08-01");
    expect(parseMasterDate("1/8/2026")).toBe("2026-08-01");
    expect(parseMasterDate("2026-08-01")).toBe("2026-08-01");
    expect(parseMasterDate("")).toBeNull();
    expect(parseMasterDate("pendiente")).toBeNull();
  });
});

describe("parseMaster · Activos", () => {
  it("no se bloquea por columnas nuevas y las registra", () => {
    expect(result.blocked).toBe(false);
    expect(issues("new_column_detected").map((i) => i.message)).toEqual([
      expect.stringContaining("IA Voz Francés"),
    ]);
  });

  it("se bloquea si falta una columna obligatoria", () => {
    const sinEstado = {
      ...activosSheet,
      values: activosSheet.values.map((row) => row.map((v, i) => (i === 4 ? "" : v))),
    };
    const blocked = parseMaster({ activos: sinEstado, fichas: fichasSheet });
    expect(blocked.blocked).toBe(true);
    expect(blocked.clinics).toEqual([]);
    expect(blocked.issues[0]).toMatchObject({ code: "missing_required_column", severity: "error" });
  });

  it("informa de filas sin tratamiento, sin guion o sin ficha", () => {
    expect(issues("row_without_treatment").map((i) => i.severity)).toEqual(["info", "warning"]);
    expect(issues("unknown_treatment")[0]?.message).toContain("Láser Corporal");
    expect(issues("missing_ficha_link")[0]).toMatchObject({ severity: "warning", clinic: "Clínica Sin Ficha" });
  });

  it("lee vacaciones y pausas", () => {
    expect(clinic("clinica-dental-norte").vacation).toEqual({ from: "2026-08-01", to: "2026-08-16" });
    expect(clinic("clinica-dental-sur").treatments.ortodoncia?.pause).toEqual({
      from: "2026-07-30",
      to: "2026-08-13",
    });
  });

  it("une las filas por canal y se queda con el mejor estado", () => {
    const implantes = clinic("instituto-dental-centro").treatments.implantes;
    expect(implantes?.channels).toEqual(["meta", "google"]);
    expect(implantes?.status).toBe("activa");
  });
});

describe("parseMaster · fichas", () => {
  it("publica solo las fichas válidas y enlazadas", () => {
    expect(result.clinics.map((c) => c.id)).toEqual([
      "clinica-dental-norte",
      "clinica-dental-sur",
      "instituto-dental-centro",
      "dr-ejemplo-dental-islas",
      "clinicas-plaza-centro-comercial",
      "clinica-oeste",
    ]);
  });

  it("lee la ficha canónica", () => {
    const c = clinic("clinica-dental-norte");
    expect(c).toMatchObject({
      name: "Clínica Dental Norte",
      address: "Calle del Río, 10, 28001 Madrid",
      reference: "frente a la estación",
      financing: "hasta 60 meses sin intereses",
      aid: "No reciben pacientes con ayudas",
      insurance: "no aceptan seguros",
      reminder: true,
      whatsapp: 'Subcuenta "WhatsApp"',
      sameDayBooking: false,
      source: { anchorRow: anchors.norte },
    });
    expect(c.treatments.implantes).toMatchObject({
      status: "activa",
      scriptVariant: "simplificado",
      valuePoints: "más de 20 años de experiencia y carga inmediata",
      promo: ["Descuento: 20%"],
      longTermBooking: true,
      qualification: { dni: "Nómina, Jubilados, Autónomos", nie: null },
    });
    expect(c.treatments.implantes?.schedules).toEqual([
      { group: null, days: "Lunes y Miércoles", hours: "10:00 a 19:30", duration: "30min" },
      { group: null, days: "Viernes", hours: "10:00 a 13:30", duration: "30min" },
    ]);
  });

  it("nunca publica notas internas ni la sección para el media buyer", () => {
    const published = JSON.stringify(result.clinics);
    expect(published).not.toContain("nota interna");
    expect(published).not.toContain("ZONA");
    expect(published).not.toContain("carga inmediata\"]"); // "Información para el MB"
    expect(published).not.toContain("1000"); // presupuesto de Activos
  });

  it("separa por tratamiento promociones, criterios, guion y agendamiento", () => {
    const { implantes, ortodoncia, blanqueamiento } = clinic("clinica-dental-sur").treatments;

    // "Financiación:" dentro de PROMOCIÓN es parte de la promoción, no la financiación de la clínica.
    expect(implantes?.promo).toEqual(["Descuento: 30%", "Implante + Corona: desde 900€", "Financiación: a 48 meses"]);
    expect(clinic("clinica-dental-sur").financing).toBeNull();
    expect(ortodoncia?.promo).toEqual(["Descuento: 25%"]);
    expect(blanqueamiento?.promo).toEqual(["Blanqueamiento + 2 jeringas: 99€."]);

    expect(implantes?.qualification).toMatchObject({ dni: "Nómina, Jubilados", pasaporte: "Cuenta bancaria" });
    expect(ortodoncia?.qualification).toMatchObject({
      dni: null,
      note: "No cualificamos económicamente, solo confirmar documentación",
    });

    expect(implantes?.scriptVariant).toBe("simplificado");
    expect(blanqueamiento?.scriptVariant).toBe("selectivo");

    expect(implantes?.valuePoints).toBe("carga inmediata y sedación");
    expect(ortodoncia?.valuePoints).toBeNull();

    expect(implantes?.longTermBooking).toBe(false);
    expect(ortodoncia?.longTermBooking).toBe(true);

    expect(implantes?.schedules).toHaveLength(2);
    expect(ortodoncia?.schedules).toEqual([
      { group: null, days: "Miercoles y Jueves", hours: "10:00 a 13:30", duration: "30min" },
    ]);
    expect(ortodoncia?.status).toBe("pausa_temporal");
  });

  it("publica un tratamiento de la ficha aunque no tenga fila en Activos", () => {
    expect(clinic("clinica-dental-sur").treatments.blanqueamiento?.status).toBe("activa");
    expect(issues("treatment_not_in_activos")[0]?.clinic).toBe("Clínica Dental Sur");
  });

  it("acepta la cabecera de tratamiento en la fila del nombre", () => {
    expect(clinic("instituto-dental-centro").treatments.implantes?.schedules).toHaveLength(1);
  });

  it("lee sedes con su horario", () => {
    const c = clinic("dr-ejemplo-dental-islas");
    expect(c.address).toBe("Calle Uno 1, Local 5");
    expect(c.locations).toEqual([
      { name: "Los Pinos", address: "Calle Uno 1, Local 5" },
      { name: "La Vega", address: "Calle Dos, 58" },
    ]);
    expect(c.treatments.implantes?.schedules.map((s) => s.group)).toEqual(["Los Pinos", "La Vega", "La Vega"]);
    expect(c.reminder).toBe(true);
  });

  it("publica sin horario y lo avisa", () => {
    const c = clinic("clinicas-plaza-centro-comercial");
    expect(c.address).toBe("(Huelva) - Centro Comercial Plaza, Ronda Exterior");
    expect(c.treatments.implantes?.schedules).toEqual([]);
    expect(issues("missing_schedule").map((i) => i.clinic)).toContain("Clínicas Plaza ı Centro Comercial");
  });

  it("lee grupos de horario y avisa de líneas que no entiende", () => {
    const c = clinic("clinica-oeste");
    expect(c.treatments.implantes?.schedules.map((s) => s.group)).toEqual([
      "Pacientes con DNI",
      "Pacientes portugueses",
    ]);
    expect(c.treatments.implantes?.valuePoints).toBeNull();
    expect(c.treatments.ortodoncia?.schedules).toHaveLength(1);
    expect(issues("unrecognized_label")[0]).toMatchObject({
      clinic: "Clínica Oeste",
      row: anchors.oeste! + 5,
    });
  });

  it("no absorbe una ficha vecina que no se publica", () => {
    const published = JSON.stringify(clinic("clinica-oeste"));
    expect(published).not.toContain("Sábado");
    expect(published).not.toContain("Calle Perdida");
  });

  it("excluye la ficha sin dirección y explica por qué", () => {
    expect(issues("missing_address")[0]).toMatchObject({ severity: "error", clinic: "Clínica Sin Dirección" });
  });

  it("detecta un enlace roto", () => {
    const roto = {
      ...activosSheet,
      hyperlinks: activosSheet.hyperlinks!.map((row, i) => (i === 1 ? [null, "#gid=1&range=A9999"] : row)),
    };
    const r = parseMaster({ activos: roto, fichas: fichasSheet });
    expect(r.issues.find((i) => i.code === "broken_ficha_link")?.clinic).toBe("Clínica Dental Norte");
    expect(r.clinics.some((c) => c.id === "clinica-dental-norte")).toBe(false);
  });
});
