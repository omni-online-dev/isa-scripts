import {
  BLOCKING_ISSUE_CODES,
  ClinicSchema,
  TREATMENT_KEYS,
  type Clinic,
  type ClinicTreatment,
  type SyncIssue,
  type TreatmentKey,
  type TreatmentStatus,
} from "../schema";
import { parseActivos, type ActivosRow } from "./activos";
import { parseFicha, type FichaScoped, type ParsedFicha } from "./ficha";
import { SHEETS } from "./mapping";
import { slugify } from "./normalize";
import { IssueLog, cell, type MasterInput } from "./types";

export type { MasterInput, SheetData } from "./types";

export interface MasterResult {
  clinics: Clinic[];
  issues: SyncIssue[];
  /** true si la hoja no se puede leer con garantías: no se debe publicar. */
  blocked: boolean;
}

/** De mejor a peor: si un tratamiento tiene varias filas, manda la más favorable. */
const STATUS_ORDER: TreatmentStatus[] = [
  "activa",
  "pausa_temporal",
  "presupuesto_agotado",
  "pago_error",
  "desconocido",
];
const bestStatus = (statuses: TreatmentStatus[]): TreatmentStatus =>
  STATUS_ORDER.find((status) => statuses.includes(status)) ?? "desconocido";

function buildTreatment(
  ficha: ParsedFicha,
  key: TreatmentKey,
  rows: ActivosRow[],
  fallbackStatus: TreatmentStatus,
): ClinicTreatment {
  const own: Partial<FichaScoped> = ficha.byTreatment[key] ?? {};
  const shared = ficha.shared;
  return {
    status: rows.length ? bestStatus(rows.map((r) => r.status)) : fallbackStatus,
    channels: [...new Set(rows.flatMap((r) => (r.channel ? [r.channel] : [])))],
    scriptVariant: own.scriptVariant ?? shared.scriptVariant ?? "estandar",
    valuePoints: own.valuePoints ?? shared.valuePoints ?? null,
    promo: [...shared.promo, ...(own.promo ?? [])],
    schedules: own.schedules?.length ? own.schedules : shared.schedules,
    qualification: own.qualification ??
      shared.qualification ?? { dni: null, nie: null, pasaporte: null, note: null },
    longTermBooking: own.longTermBooking ?? shared.longTermBooking ?? null,
    pause: rows.find((r) => r.pause)?.pause ?? null,
  };
}

/**
 * Convierte las dos pestañas de la Master en clínicas listas para publicar.
 * Nunca lanza por datos mal escritos: todo problema sale como incidencia.
 */
export function parseMaster(input: MasterInput): MasterResult {
  const log = new IssueLog();
  const activos = parseActivos(input.activos, log);
  if (activos.blocked) return { clinics: [], issues: log.issues, blocked: true };

  const byAnchor = new Map<number, ActivosRow[]>();
  for (const row of activos.rows) {
    if (row.anchorRow === null) continue;
    byAnchor.set(row.anchorRow, [...(byAnchor.get(row.anchorRow) ?? []), row]);
  }
  const anchors = [...byAnchor.keys()].sort((a, b) => a - b);

  const clinics: Clinic[] = [];
  const seen = new Set<string>();

  anchors.forEach((anchor, position) => {
    const rows = byAnchor.get(anchor)!;
    const label = rows[0]!.clinic;

    if (!cell(input.fichas.values[anchor - 1], 0)) {
      log.add({
        severity: "error",
        code: "broken_ficha_link",
        sheet: SHEETS.activos,
        row: rows[0]!.row,
        clinic: label,
        message: `El enlace de «${label}» apunta a la fila ${anchor} de la pestaña de fichas, que está vacía.`,
      });
      return;
    }

    const end = anchors[position + 1] ?? input.fichas.values.length + 1;
    const ficha = parseFicha(input.fichas.values.slice(anchor - 1, end - 1), anchor, log);

    if (!ficha.address) {
      log.add({
        severity: "error",
        code: "missing_address",
        sheet: SHEETS.fichas,
        row: anchor,
        clinic: ficha.name,
        message: `La ficha de «${ficha.name}» no tiene una línea «Dirección: …». No se publica.`,
      });
      return;
    }

    const id = slugify(ficha.name);
    if (seen.has(id)) {
      log.add({
        severity: "error",
        code: "duplicate_clinic",
        sheet: SHEETS.fichas,
        row: anchor,
        clinic: ficha.name,
        message: `Hay dos fichas con el nombre «${ficha.name}». La segunda no se publica.`,
      });
      return;
    }

    const fromActivos = new Set(rows.map((r) => r.treatment));
    const clinicStatus = bestStatus(rows.map((r) => r.status));
    const treatments: Partial<Record<TreatmentKey, ClinicTreatment>> = {};
    for (const key of TREATMENT_KEYS) {
      const inActivos = fromActivos.has(key);
      if (!inActivos && !ficha.scheduleTreatments.includes(key)) continue;
      if (!inActivos) {
        log.add({
          severity: "info",
          code: "treatment_not_in_activos",
          sheet: SHEETS.fichas,
          row: anchor,
          clinic: ficha.name,
          message: `La ficha tiene horario de ${key}, pero Activos no tiene esa fila. Se publica con el estado de la clínica.`,
        });
      }
      const treatment = buildTreatment(
        ficha,
        key,
        rows.filter((r) => r.treatment === key),
        clinicStatus,
      );
      if (treatment.schedules.length === 0) {
        log.add({
          severity: "warning",
          code: "missing_schedule",
          sheet: SHEETS.fichas,
          row: anchor,
          clinic: ficha.name,
          message: `La ficha de «${ficha.name}» no tiene horario para ${key}.`,
        });
      }
      treatments[key] = treatment;
    }

    const parsed = ClinicSchema.safeParse({
      id,
      name: ficha.name,
      address: ficha.address,
      reference: ficha.reference,
      // Una sola dirección con nombre no es una clínica con varias sedes.
      locations: ficha.locations.length > 1 ? ficha.locations : [],
      financing: ficha.financing,
      aid: ficha.aid,
      insurance: ficha.insurance,
      reminder: ficha.reminder,
      whatsapp: ficha.whatsapp,
      sameDayBooking: ficha.sameDayBooking,
      vacation: rows.find((r) => r.vacation)?.vacation ?? null,
      treatments,
      source: { anchorRow: anchor },
    } satisfies Clinic);

    if (!parsed.success) {
      const detail = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      log.add({
        severity: "error",
        code: "invalid_clinic",
        sheet: SHEETS.fichas,
        row: anchor,
        clinic: ficha.name,
        message: `La ficha de «${ficha.name}» no se puede publicar (${detail}).`,
      });
      return;
    }

    seen.add(id);
    clinics.push(parsed.data);
  });

  const blocked = log.issues.some((issue) => BLOCKING_ISSUE_CODES.includes(issue.code));
  return { clinics, issues: log.issues, blocked };
}
