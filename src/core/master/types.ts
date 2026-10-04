import type { SyncIssue } from "../schema";

/**
 * Una pestaña de la Master tal como la entrega la capa de lectura.
 * `values[0]` es la fila 1 de la hoja. Las celdas vacías son "".
 */
export interface SheetData {
  values: ReadonlyArray<ReadonlyArray<string>>;
  /** Hipervínculo de cada celda, con la misma forma que `values`. Opcional. */
  hyperlinks?: ReadonlyArray<ReadonlyArray<string | null | undefined>>;
}

export interface MasterInput {
  activos: SheetData;
  fichas: SheetData;
}

/** Acumulador de incidencias que comparten los parsers. */
export class IssueLog {
  readonly issues: SyncIssue[] = [];

  add(issue: Omit<SyncIssue, "row" | "clinic"> & { row?: number | null; clinic?: string | null }) {
    this.issues.push({ row: null, clinic: null, ...issue });
  }
}

export const cell = (row: ReadonlyArray<string> | undefined, index: number): string =>
  String(row?.[index] ?? "").replace(/\s+/g, " ").trim();
