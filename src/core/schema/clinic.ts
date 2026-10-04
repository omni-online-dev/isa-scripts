import { z } from "zod";
import {
  ChannelSchema,
  ScriptVariantSchema,
  TreatmentKeySchema,
  TreatmentStatusSchema,
} from "./treatment";

/** Fecha sin hora, en formato ISO (2026-10-04). */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Texto opcional: la ficha puede no traer el dato. Nunca cadena vacía. */
const OptionalText = z.string().trim().min(1).nullable();

/** SI / NO de la ficha. null = la ficha no lo indica. */
const YesNo = z.boolean().nullable();

/** Una fila de la tabla de horarios de la ficha (columnas B–D). */
export const ScheduleRowSchema = z.object({
  /** Sede, en fichas con varias. null = sede única. */
  location: OptionalText,
  /** Texto de días tal como está en la ficha: "Lunes y Miércoles". */
  days: z.string().trim().min(1),
  /** Franja: "10:00 a 13:30 / 16:00 a 19:30". */
  hours: z.string().trim().min(1),
  /** Duración de la cita: "30min". */
  duration: OptionalText,
});
export type ScheduleRow = z.infer<typeof ScheduleRowSchema>;

/** Periodo de pausa o vacaciones, de las fechas de Activos. */
export const PeriodSchema = z.object({
  from: IsoDateSchema.nullable(),
  to: IsoDateSchema.nullable(),
});
export type Period = z.infer<typeof PeriodSchema>;

/** Datos de una clínica para un tratamiento concreto. */
export const ClinicTreatmentSchema = z.object({
  status: TreatmentStatusSchema,
  /** Canales con fila propia en Activos ("Implantes Meta", "Implantes Google"). */
  channels: z.array(ChannelSchema),
  scriptVariant: ScriptVariantSchema,
  /** Puntos de valor de este tratamiento. */
  valuePoints: OptionalText,
  /** Líneas de la sección PROMOCIÓN que aplican a este tratamiento. */
  promo: z.array(z.string().trim().min(1)),
  schedules: z.array(ScheduleRowSchema),
  /** Agendamiento a más de 72 horas. */
  longTermBooking: YesNo,
  /** Pausa de ISA para este tratamiento. */
  pause: PeriodSchema.nullable(),
});
export type ClinicTreatment = z.infer<typeof ClinicTreatmentSchema>;

/** Criterios de financiación por tipo de documento. */
export const QualificationSchema = z.object({
  dni: OptionalText,
  nie: OptionalText,
  pasaporte: OptionalText,
  /** Texto cuando no se cualifica por documento ("No cualificamos, solo confirmar…"). */
  note: OptionalText,
});
export type Qualification = z.infer<typeof QualificationSchema>;

export const ClinicLocationSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
});

/**
 * Clínica publicada en Firestore (`clinics/{id}`).
 * Solo contiene campos de la lista blanca: ver src/core/master/mapping.ts.
 */
export const ClinicSchema = z.object({
  /** Slug estable del nombre de la ficha. */
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  /** Punto de referencia para ubicar la clínica. */
  reference: OptionalText,
  /** Sedes adicionales, en fichas con varias. */
  locations: z.array(ClinicLocationSchema),
  qualification: QualificationSchema,
  financing: OptionalText,
  aid: OptionalText,
  insurance: OptionalText,
  reminder: YesNo,
  whatsapp: OptionalText,
  sameDayBooking: YesNo,
  /** Vacaciones de la clínica. */
  vacation: PeriodSchema.nullable(),
  /** Al menos un tratamiento. Las claves son TreatmentKey. */
  treatments: z
    .record(TreatmentKeySchema, ClinicTreatmentSchema)
    .refine((t) => Object.keys(t).length > 0, "La clínica no tiene tratamientos"),
  /** Trazabilidad: fila donde empieza la ficha en la Master. */
  source: z.object({ anchorRow: z.number().int().positive() }),
});
export type Clinic = z.infer<typeof ClinicSchema>;
