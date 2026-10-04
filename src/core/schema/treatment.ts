import { z } from "zod";

/** Tratamientos que la app sabe mostrar. Cada uno necesita plantilla de guion. */
export const TREATMENT_KEYS = [
  "implantes",
  "ortodoncia",
  "carillas",
  "blanqueamiento",
  "estetica",
  "apnea",
] as const;

export const TreatmentKeySchema = z.enum(TREATMENT_KEYS);
export type TreatmentKey = z.infer<typeof TreatmentKeySchema>;

export const TREATMENT_LABELS: Record<TreatmentKey, string> = {
  implantes: "Implantes",
  ortodoncia: "Ortodoncia",
  carillas: "Carillas",
  blanqueamiento: "Blanqueamiento",
  estetica: "Estética",
  apnea: "Apnea del sueño",
};

/** Canal de captación que la Master añade al tratamiento ("Implantes Meta"). */
export const CHANNELS = ["meta", "google", "internacional"] as const;
export const ChannelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof ChannelSchema>;

/**
 * Variante de guion tal como la nombra la Master.
 * "propio" cubre guiones específicos de una clínica ("Script Adeje").
 * La equivalencia con las plantillas de la app está pendiente (docs/adr/0001).
 */
export const SCRIPT_VARIANTS = ["estandar", "simplificado", "selectivo", "propio"] as const;
export const ScriptVariantSchema = z.enum(SCRIPT_VARIANTS);
export type ScriptVariant = z.infer<typeof ScriptVariantSchema>;

/** Valores de la columna "Estado" de Activos. */
export const TREATMENT_STATUSES = [
  "activa",
  "pausa_temporal",
  "presupuesto_agotado",
  "pago_error",
  "desconocido",
] as const;
export const TreatmentStatusSchema = z.enum(TREATMENT_STATUSES);
export type TreatmentStatus = z.infer<typeof TreatmentStatusSchema>;
