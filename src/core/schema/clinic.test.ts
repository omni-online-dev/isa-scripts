import { describe, expect, it } from "vitest";
import { ClinicSchema, type Clinic } from "./clinic";

const clinic: Clinic = {
  id: "clinica-dental-ejemplo",
  name: "Clínica Dental Ejemplo",
  address: "Calle Mayor 1, 28013 Madrid",
  reference: "junto a la plaza",
  locations: [],
  financing: "Hasta 24 meses sin intereses",
  aid: null,
  insurance: null,
  reminder: true,
  whatsapp: "Subcuenta WhatsApp",
  sameDayBooking: false,
  vacation: null,
  treatments: {
    implantes: {
      status: "activa",
      channels: [],
      scriptVariant: "simplificado",
      valuePoints: "carga inmediata",
      promo: ["Descuento: 20%"],
      schedules: [{ group: null, days: "Lunes a Viernes", hours: "10:00 a 13:30", duration: "30min" }],
      qualification: { dni: "Nómina, Jubilados", nie: null, pasaporte: null, note: null },
      longTermBooking: true,
      pause: null,
    },
  },
  source: { anchorRow: 2 },
};

describe("ClinicSchema", () => {
  it("acepta una clínica completa", () => {
    expect(ClinicSchema.parse(clinic)).toEqual(clinic);
  });

  it("rechaza una clínica sin tratamientos", () => {
    expect(ClinicSchema.safeParse({ ...clinic, treatments: {} }).success).toBe(false);
  });

  it("rechaza identificadores que no son slug", () => {
    expect(ClinicSchema.safeParse({ ...clinic, id: "Clínica Ejemplo" }).success).toBe(false);
  });

  it("rechaza texto vacío donde debería ir null", () => {
    expect(ClinicSchema.safeParse({ ...clinic, reference: "  " }).success).toBe(false);
  });

  it("rechaza campos de tratamiento desconocidos como clave", () => {
    const withUnknown = { ...clinic, treatments: { laser: clinic.treatments.implantes } };
    expect(ClinicSchema.safeParse(withUnknown).success).toBe(false);
  });
});
