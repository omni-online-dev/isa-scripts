import type { Channel, Period, TreatmentKey, TreatmentStatus } from "../schema";
import { ACTIVOS_COLUMNS, SHEETS, resolveActivosColumns, type ActivosColumn } from "./mapping";
import {
  normalizeStatus,
  normalizeTreatment,
  parseAnchorRow,
  parseMasterDate,
  splitClinicTreatment,
} from "./normalize";
import { IssueLog, cell, type SheetData } from "./types";

/** Una fila útil de Activos: una clínica con un tratamiento. */
export interface ActivosRow {
  /** Fila en la hoja (base 1). */
  row: number;
  clinic: string;
  treatment: TreatmentKey;
  channel: Channel | null;
  status: TreatmentStatus;
  /** Fila donde empieza la ficha en la pestaña de fichas. null si no hay enlace. */
  anchorRow: number | null;
  vacation: Period | null;
  pause: Period | null;
}

export interface ActivosResult {
  rows: ActivosRow[];
  /** true si faltan columnas obligatorias: no se puede publicar nada. */
  blocked: boolean;
}

function period(from: string, to: string): Period | null {
  const result = { from: parseMasterDate(from), to: parseMasterDate(to) };
  return result.from || result.to ? result : null;
}

export function parseActivos(sheet: SheetData, log: IssueLog): ActivosResult {
  const header = sheet.values[0] ?? [];
  const { index, missing, unknown } = resolveActivosColumns(header);

  for (const column of missing) {
    log.add({
      severity: "error",
      code: "missing_required_column",
      sheet: SHEETS.activos,
      row: 1,
      message: `Falta la columna «${column}» en la pestaña Activos. No se ha publicado nada.`,
    });
  }
  for (const column of unknown) {
    log.add({
      severity: "info",
      code: "new_column_detected",
      sheet: SHEETS.activos,
      row: 1,
      message: `Columna nueva en Activos: «${column}». No se publica hasta que se autorice.`,
    });
  }
  if (missing.length > 0) return { rows: [], blocked: true };

  const at = (name: ActivosColumn) => index[name];
  const rows: ActivosRow[] = [];

  sheet.values.forEach((values, i) => {
    if (i === 0) return;
    const row = i + 1;
    const read = (name: ActivosColumn) => {
      const column = at(name);
      return column === undefined ? "" : cell(values, column);
    };

    const name = read("clinicTreatment");
    if (!name) return;
    const { clinic, treatment: rawTreatment } = splitClinicTreatment(name);

    const linkColumn = at("fichaLink");
    const anchorRow = parseAnchorRow(
      linkColumn === undefined ? null : sheet.hyperlinks?.[i]?.[linkColumn],
    );

    if (!rawTreatment) {
      // Con enlace a ficha es una clínica a la que le falta el tratamiento en el nombre;
      // sin enlace suele ser un rótulo de sección ("EN PROCESO DE ONBOARDING").
      log.add({
        severity: anchorRow === null ? "info" : "warning",
        code: "row_without_treatment",
        sheet: SHEETS.activos,
        row,
        clinic,
        message:
          anchorRow === null
            ? `«${name}» no indica tratamiento. Se ignora.`
            : `«${name}» tiene ficha pero no indica tratamiento. Escríbelo como «${clinic} - Implantes» para que aparezca en la app.`,
      });
      return;
    }

    const treatment = normalizeTreatment(rawTreatment);
    if (!treatment) {
      log.add({
        severity: "warning",
        code: "unknown_treatment",
        sheet: SHEETS.activos,
        row,
        clinic,
        message: `El tratamiento «${rawTreatment}» no tiene guion en la app. La fila no se publica.`,
      });
      return;
    }

    const rawStatus = read("status");
    const status = normalizeStatus(rawStatus);
    if (status === "desconocido") {
      log.add({
        severity: "warning",
        code: "unknown_status",
        sheet: SHEETS.activos,
        row,
        clinic,
        message: rawStatus
          ? `Estado «${rawStatus}» no reconocido.`
          : "La fila no tiene Estado.",
      });
    }

    if (anchorRow === null) {
      log.add({
        severity: status === "activa" ? "warning" : "info",
        code: "missing_ficha_link",
        sheet: SHEETS.activos,
        row,
        clinic,
        message: `«${name}» no enlaza a su ficha en «${ACTIVOS_COLUMNS.fichaLink.header}». No se puede mostrar en la app.`,
      });
    }

    rows.push({
      row,
      clinic,
      treatment: treatment.key,
      channel: treatment.channel,
      status,
      anchorRow,
      vacation: period(read("vacationFrom"), read("vacationTo")),
      pause: period(read("pauseFrom"), read("pauseTo")),
    });
  });

  return { rows, blocked: false };
}
