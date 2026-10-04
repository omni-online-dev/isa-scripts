import { z } from "zod";

/**
 * error   → la clínica no se publica (o se detiene la sincronización, según el código).
 * warning → se publica y se avisa al editor de la Master.
 * info    → solo queda en el registro (p. ej. columna nueva detectada).
 */
export const IssueSeveritySchema = z.enum(["error", "warning", "info"]);
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;

export const ISSUE_CODES = [
  // Estructura de la hoja: detienen la sincronización.
  "missing_required_column",
  "sheet_not_found",
  // Activos
  "new_column_detected",
  "row_without_treatment",
  "unknown_treatment",
  "unknown_status",
  "missing_ficha_link",
  "broken_ficha_link",
  // Fichas
  "missing_address",
  "missing_schedule",
  "unrecognized_label",
  "treatment_without_section",
  "invalid_clinic",
] as const;
export const IssueCodeSchema = z.enum(ISSUE_CODES);
export type IssueCode = z.infer<typeof IssueCodeSchema>;

/** Códigos que invalidan toda la publicación, no solo una clínica. */
export const BLOCKING_ISSUE_CODES: readonly IssueCode[] = [
  "missing_required_column",
  "sheet_not_found",
];

/** Una línea del informe de calidad. */
export const SyncIssueSchema = z.object({
  severity: IssueSeveritySchema,
  code: IssueCodeSchema,
  sheet: z.string(),
  /** Fila en la hoja (base 1), si aplica. */
  row: z.number().int().positive().nullable(),
  /** Nombre de la clínica afectada, si aplica. */
  clinic: z.string().nullable(),
  /** Mensaje para el editor de la Master, en español y sin jerga. */
  message: z.string().min(1),
});
export type SyncIssue = z.infer<typeof SyncIssueSchema>;

export const SyncTriggerSchema = z.enum(["edit", "manual", "schedule", "admin"]);
export type SyncTrigger = z.infer<typeof SyncTriggerSchema>;

export const SyncStatusSchema = z.enum(["published", "unchanged", "blocked", "failed"]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

/** Registro de una ejecución (`syncRuns/{id}`). */
export const SyncRunSchema = z.object({
  status: SyncStatusSchema,
  trigger: SyncTriggerSchema,
  startedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  /** Versión publicada, si la hubo. */
  version: z.number().int().positive().nullable(),
  clinicCount: z.number().int().nonnegative(),
  issues: z.array(SyncIssueSchema),
});
export type SyncRun = z.infer<typeof SyncRunSchema>;
