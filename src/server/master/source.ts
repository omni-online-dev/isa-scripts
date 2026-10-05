import fs from "fs/promises";
import path from "path";
import { google, type sheets_v4 } from "googleapis";
import type { MasterInput, SheetData } from "@/core/master";
import { SHEETS, resolveActivosColumns } from "@/core/master/mapping";

/** Capa de lectura de la Master. La sincronización no sabe de dónde salen los datos. */
export interface MasterSource {
  read(): Promise<MasterInput>;
}

/** Falta una pestaña de la Master. La sincronización lo convierte en `sheet_not_found`. */
export class MasterSheetNotFoundError extends Error {
  constructor(readonly sheet: string) {
    super(`No existe la pestaña «${sheet}» en la Master.`);
    this.name = "MasterSheetNotFoundError";
  }
}

/** Columnas de la ficha que se leen: A–D. La E son notas internas. */
const FICHA_COLUMNS = 4;

/**
 * LISTA BLANCA en la lectura. De Activos se conserva la cabecera completa (hace falta
 * para detectar columnas nuevas) y, en el resto de filas, solo las columnas de
 * `ACTIVOS_COLUMNS`. De las fichas solo salen las columnas A–D. Los hipervínculos se
 * conservan únicamente en «Link a Horarios».
 */
export function applyWhitelist(input: MasterInput): MasterInput {
  const header = input.activos.values[0] ?? [];
  const { index } = resolveActivosColumns(header);
  const allowed = new Set<number>(Object.values(index));
  const linkColumn = index.fichaLink;

  const values = input.activos.values.map((row, i) =>
    i === 0 ? row.map((v) => String(v ?? "")) : row.map((v, c) => (allowed.has(c) ? String(v ?? "") : "")),
  );
  const hyperlinks = input.activos.values.map((row, i) =>
    row.map((_, c) =>
      i > 0 && c === linkColumn ? (input.activos.hyperlinks?.[i]?.[c] ?? null) : null,
    ),
  );

  return {
    activos: { values, hyperlinks },
    fichas: {
      values: input.fichas.values.map((row) => row.slice(0, FICHA_COLUMNS).map((v) => String(v ?? ""))),
    },
  };
}

type Cell = sheets_v4.Schema$CellData;

/**
 * Texto de una celda. Las fechas salen como número de serie: así no dependen de si
 * la hoja las muestra como día/mes o mes/día (el parser convierte el número).
 */
function cellText(cell: Cell): string {
  const type = cell.effectiveFormat?.numberFormat?.type;
  const serial = cell.effectiveValue?.numberValue;
  if ((type === "DATE" || type === "DATE_TIME") && typeof serial === "number") return String(serial);
  return cell.formattedValue ?? "";
}

/** El enlace puede estar en la celda entera o en un tramo del texto. */
function cellLink(cell: Cell): string | null {
  return (
    cell.hyperlink ??
    cell.textFormatRuns?.find((run) => run.format?.link?.uri)?.format?.link?.uri ??
    null
  );
}

function sheetRows(spreadsheet: sheets_v4.Schema$Spreadsheet, title: string): Cell[][] {
  const sheet = spreadsheet.sheets?.find((s) => s.properties?.title === title);
  if (!sheet) throw new MasterSheetNotFoundError(title);
  return (sheet.data?.[0]?.rowData ?? []).map((row) => row.values ?? []);
}

/**
 * Convierte la respuesta de `spreadsheets.get` en la entrada del parser.
 * Función pura: aplica la lista blanca antes de devolver nada.
 */
export function toMasterInput(spreadsheet: sheets_v4.Schema$Spreadsheet): MasterInput {
  const activos = sheetRows(spreadsheet, SHEETS.activos);
  const fichas = sheetRows(spreadsheet, SHEETS.fichas);

  const raw: MasterInput = {
    activos: {
      values: activos.map((row) => row.map(cellText)),
      hyperlinks: activos.map((row) => row.map(cellLink)),
    },
    fichas: {
      // Las fichas van como texto tal cual se ve; solo se miran las columnas A–D.
      values: fichas.map((row) => row.slice(0, FICHA_COLUMNS).map((c) => c.formattedValue ?? "")),
    },
  };
  return applyWhitelist(raw);
}

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

/** Solo lo necesario: texto, valor y formato de fecha, y enlaces. */
const FIELDS =
  "sheets(properties(title),data(rowData(values(formattedValue,effectiveValue/numberValue,effectiveFormat/numberFormat/type,hyperlink,textFormatRuns/format/link/uri))))";

/** Si la API rechaza un rango es que la pestaña no existe (o se ha renombrado). */
function missingSheet(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  if (!/unable to parse range/i.test(message)) return null;
  return Object.values(SHEETS).find((name) => message.includes(name.trim())) ?? SHEETS.activos;
}

/** Lee la Master con la cuenta de servicio del backend (solo lectura). */
export class SheetsMasterSource implements MasterSource {
  constructor(private readonly spreadsheetId: string) {}

  async read(): Promise<MasterInput> {
    const auth = new google.auth.GoogleAuth({ scopes: [SHEETS_SCOPE] });
    const sheets = google.sheets({ version: "v4", auth });
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        ranges: [SHEETS.activos, `'${SHEETS.fichas}'`],
        fields: FIELDS,
      });
      return toMasterInput(response.data);
    } catch (error) {
      const sheet = missingSheet(error);
      if (sheet) throw new MasterSheetNotFoundError(sheet);
      throw error;
    }
  }
}

const isSheet = (value: unknown): value is SheetData =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { values?: unknown }).values);

/** Desarrollo local: lee un JSON con la forma de `MasterInput`. Misma lista blanca. */
export class FileMasterSource implements MasterSource {
  constructor(private readonly file: string) {}

  async read(): Promise<MasterInput> {
    const parsed: unknown = JSON.parse(await fs.readFile(this.file, "utf8"));
    const { activos, fichas } = (parsed ?? {}) as Partial<Record<keyof MasterInput, unknown>>;
    if (!isSheet(activos)) throw new MasterSheetNotFoundError(SHEETS.activos);
    if (!isSheet(fichas)) throw new MasterSheetNotFoundError(SHEETS.fichas);
    return applyWhitelist({ activos, fichas });
  }
}

const DEFAULT_LOCAL_FILE = "fixtures/private/master.json";

/** `MASTER_SOURCE=sheets|file`. Sin indicarlo: Sheets si hay ID de hoja; si no, archivo. */
export function getMasterSource(env: NodeJS.ProcessEnv = process.env): MasterSource {
  const spreadsheetId = env.MASTER_SPREADSHEET_ID?.trim();
  const kind = env.MASTER_SOURCE?.trim() || (spreadsheetId ? "sheets" : "file");

  if (kind === "file") {
    const file = env.MASTER_LOCAL_FILE?.trim() || DEFAULT_LOCAL_FILE;
    return new FileMasterSource(path.resolve(/* turbopackIgnore: true */ process.cwd(), file));
  }
  if (kind !== "sheets") throw new Error(`MASTER_SOURCE no válido: «${kind}». Usa "sheets" o "file".`);
  if (!spreadsheetId) throw new Error("Falta MASTER_SPREADSHEET_ID para leer la Master.");
  return new SheetsMasterSource(spreadsheetId);
}
