import type { Qualification, ScheduleRow, ScriptVariant, TreatmentKey } from "../schema";
import { SHEETS, classifyFichaLine } from "./mapping";
import { findTreatments, normalizeText, parseYesNo } from "./normalize";
import { IssueLog, cell } from "./types";

/** Datos de la ficha que pueden ser comunes a la clínica o propios de un tratamiento. */
export interface FichaScoped {
  valuePoints?: string | null;
  scriptVariant?: ScriptVariant;
  longTermBooking?: boolean | null;
  qualification?: Qualification;
  promo: string[];
  schedules: ScheduleRow[];
}

/** Resultado de leer una ficha, antes de cruzarla con Activos. */
export interface ParsedFicha {
  name: string;
  /** Fila de la hoja (base 1) donde empieza la ficha. */
  anchorRow: number;
  address: string | null;
  reference: string | null;
  locations: Array<{ name: string; address: string }>;
  financing: string | null;
  aid: string | null;
  insurance: string | null;
  reminder: boolean | null;
  whatsapp: string | null;
  sameDayBooking: boolean | null;
  /** Datos sin tratamiento indicado: valen para todos. */
  shared: FichaScoped;
  /** Datos que la ficha asigna a un tratamiento concreto. */
  byTreatment: Partial<Record<TreatmentKey, FichaScoped>>;
  /** Tratamientos con bloque de horario propio en la ficha. */
  scheduleTreatments: TreatmentKey[];
}

const emptyScoped = (): FichaScoped => ({ promo: [], schedules: [] });
const emptyQualification = (): Qualification => ({ dni: null, nie: null, pasaporte: null, note: null });

/** Texto tras los primeros dos puntos. null si no hay valor. */
function valueAfterColon(line: string): string | null {
  const at = line.indexOf(":");
  const value = at === -1 ? "" : line.slice(at + 1).trim();
  return value || null;
}

/** Texto entre la etiqueta y los dos puntos: ahí va el tratamiento, si lo hay. */
function scopeOf(line: string): TreatmentKey[] {
  const at = line.indexOf(":");
  return findTreatments(at === -1 ? line : line.slice(0, at)).treatments;
}

/** "Calle Mayor 1, Madrid (junto a la plaza)" → dirección y referencia. */
function splitReference(address: string): { address: string; reference: string | null } {
  const match = /^(.*\S)\s*\(([^()]+)\)\.?$/.exec(address);
  if (!match || !match[1]) return { address, reference: null };
  return { address: match[1].replace(/[\s,;-]+$/, ""), reference: match[2]!.trim() };
}

function scriptVariantOf(line: string): ScriptVariant {
  const text = normalizeText(line);
  if (/^script simplificado\b/.test(text)) return "simplificado";
  if (/^script selectivo\b/.test(text)) return "selectivo";
  return "propio";
}

/**
 * ¿Empieza aquí otra ficha? Una línea sin etiqueta cuya siguiente línea con texto
 * es una dirección. Evita absorber una ficha vecina que no tiene enlace en Activos.
 */
function startsAnotherFicha(rows: ReadonlyArray<ReadonlyArray<string>>, at: number): boolean {
  if (classifyFichaLine(cell(rows[at], 0)) !== null) return false;
  for (let i = at + 1; i < rows.length && i <= at + 4; i++) {
    const next = cell(rows[i], 0);
    if (next) return classifyFichaLine(next) === "address";
  }
  return false;
}

type Section = "none" | "qualification" | "promo" | "mb";

/**
 * Lee una ficha. `rows` empieza en la fila ancla (la del nombre de la clínica)
 * y puede extenderse hasta la siguiente ficha enlazada.
 *
 * La ficha tiene dos pistas independientes que comparten filas:
 *  - columna A: líneas «Etiqueta: valor» y secciones (criterios, promoción);
 *  - columnas B–D: tabla de horarios, con cabeceras de tratamiento o sede en C.
 */
export function parseFicha(
  rows: ReadonlyArray<ReadonlyArray<string>>,
  anchorRow: number,
  log: IssueLog,
): ParsedFicha {
  const ficha: ParsedFicha = {
    name: cell(rows[0], 0),
    anchorRow,
    address: null,
    reference: null,
    locations: [],
    financing: null,
    aid: null,
    insurance: null,
    reminder: null,
    whatsapp: null,
    sameDayBooking: null,
    shared: emptyScoped(),
    byTreatment: {},
    scheduleTreatments: [],
  };

  const scoped = (key: TreatmentKey) => (ficha.byTreatment[key] ??= emptyScoped());
  /** Destinos de un dato: los tratamientos indicados o, si no hay, el común. */
  const targets = (keys: TreatmentKey[]) => (keys.length ? keys.map(scoped) : [ficha.shared]);

  let section: Section = "none";
  let sectionScope: TreatmentKey[] = [];
  let scheduleScope: TreatmentKey[] | null = null;
  let scheduleGroup: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRow = anchorRow + i;
    const line = cell(row, 0);

    if (i > 0 && line && ficha.address !== null && startsAnotherFicha(rows, i)) break;

    // --- Pista de horarios (columnas B–D) ---
    const days = cell(row, 1);
    const hours = cell(row, 2);
    const duration = cell(row, 3);
    if (!days && hours && !duration) {
      const header = findTreatments(hours);
      if (header.treatments.length) {
        scheduleScope = header.treatments;
        scheduleGroup = header.rest || null;
        for (const key of header.treatments) {
          scoped(key);
          if (!ficha.scheduleTreatments.includes(key)) ficha.scheduleTreatments.push(key);
        }
      } else {
        scheduleGroup = hours; // sede ("Los Alisios") dentro del tratamiento en curso
      }
    } else if (days && hours) {
      const schedule: ScheduleRow = { group: scheduleGroup, days, hours, duration: duration || null };
      for (const target of targets(scheduleScope ?? [])) target.schedules.push(schedule);
    }

    // --- Pista de datos (columna A) ---
    if (i === 0 || !line) continue;
    const label = classifyFichaLine(line);

    // Dentro de PROMOCIÓN todo es contenido de la promoción, aunque empiece como
    // una etiqueta ("Financiación: a 48 meses"). Solo la cierra la sección del MB.
    if (section === "promo" && label !== "mbFormHeader" && label !== "promoHeader") {
      const header = findTreatments(line.replace(/:\s*$/, ""));
      if (header.treatments.length && !header.rest) sectionScope = header.treatments;
      else for (const target of targets(sectionScope)) target.promo.push(line);
      continue;
    }

    if (label === null) {
      if (section === "mb") continue;
      if (section === "qualification") {
        for (const target of targets(sectionScope)) {
          const q = (target.qualification ??= emptyQualification());
          q.note = q.note ? `${q.note} ${line}` : line;
        }
        continue;
      }
      log.add({
        severity: "warning",
        code: "unrecognized_label",
        sheet: SHEETS.fichas,
        row: sheetRow,
        clinic: ficha.name,
        message: `No se reconoce la línea «${line.slice(0, 60)}». Usa el formato «Etiqueta: valor».`,
      });
      continue;
    }

    // Los documentos pertenecen a la sección de criterios y no la cierran.
    if (label === "dni" || label === "nie" || label === "pasaporte") {
      const scope = section === "qualification" ? sectionScope : [];
      for (const target of targets(scope)) {
        (target.qualification ??= emptyQualification())[label] = valueAfterColon(line);
      }
      continue;
    }

    section = "none";
    sectionScope = [];

    switch (label) {
      case "address": {
        const value = valueAfterColon(line);
        if (!value) break;
        const { address, reference } = splitReference(value);
        const place = line.slice(0, line.indexOf(":")).replace(/^\s*direcci[oó]n\s*/i, "").trim();
        if (place) ficha.locations.push({ name: place, address });
        if (ficha.address === null) {
          ficha.address = address;
          ficha.reference = reference;
        }
        break;
      }
      case "valuePoints":
        for (const target of targets(scopeOf(line))) target.valuePoints = valueAfterColon(line);
        break;
      case "script":
        for (const target of targets(findTreatments(line).treatments)) {
          target.scriptVariant = scriptVariantOf(line);
        }
        break;
      case "qualificationHeader":
        section = "qualification";
        sectionScope = findTreatments(line).treatments;
        break;
      case "financing": {
        const value = valueAfterColon(line);
        if (value) ficha.financing = ficha.financing ? `${ficha.financing} · ${value}` : value;
        break;
      }
      case "aid":
        ficha.aid = valueAfterColon(line);
        break;
      case "insurance":
        ficha.insurance = valueAfterColon(line);
        break;
      case "reminder":
        ficha.reminder = parseYesNo(valueAfterColon(line));
        break;
      case "whatsapp":
        ficha.whatsapp = valueAfterColon(line);
        break;
      case "sameDayBooking":
        ficha.sameDayBooking = parseYesNo(valueAfterColon(line));
        break;
      case "longTermBooking": {
        const value = parseYesNo(line.slice(line.lastIndexOf(":") + 1));
        const scope = findTreatments(line.split("(")[0] ?? line).treatments;
        for (const target of targets(scope)) target.longTermBooking = value;
        break;
      }
      case "promoHeader":
        section = "promo";
        break;
      case "mbFormHeader":
        section = "mb"; // información para el media buyer: no se usa en la app
        break;
    }
  }

  return ficha;
}
