import type { Channel, TreatmentKey, TreatmentStatus } from "../schema";

/** Minúsculas, sin tildes y con espacios colapsados. Para comparar texto de la Master. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Identificador estable a partir del nombre de la ficha. */
export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/ı/g, " ") // "ı" es un separador en algunos nombres de la Master
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ClinicTreatmentCell {
  clinic: string;
  /** Texto del tratamiento tal como está en la hoja. null si la celda no lo trae. */
  treatment: string | null;
}

/**
 * Separa "Clínica Dental Usera - Implantes" por el último " - ".
 * El nombre de la clínica puede contener guiones; el tratamiento, no.
 */
export function splitClinicTreatment(cell: string): ClinicTreatmentCell {
  const text = String(cell).replace(/\s+/g, " ").trim();
  const at = text.lastIndexOf(" - ");
  if (at === -1) return { clinic: text, treatment: null };
  return { clinic: text.slice(0, at).trim(), treatment: text.slice(at + 3).trim() };
}

const TREATMENT_ALIASES: Array<[pattern: RegExp, key: TreatmentKey]> = [
  [/^implantes?\b/, "implantes"],
  [/^ortodoncia\b/, "ortodoncia"],
  [/^cari+l+as\b/, "carillas"], // tolera la errata "Cariillas"
  [/^blanqueamiento\b/, "blanqueamiento"],
  [/^estetica\b/, "estetica"],
  [/^apnea\b/, "apnea"],
];

const CHANNEL_ALIASES: Array<[pattern: RegExp, channel: Channel]> = [
  [/\bmeta\b|\bfb\b|\bfacebook\b/, "meta"],
  [/\bgoogle\b/, "google"],
  [/\binternacional\b/, "internacional"],
];

export interface NormalizedTreatment {
  key: TreatmentKey;
  channel: Channel | null;
}

/** "Implantes Meta" → { key: "implantes", channel: "meta" }. null si no se reconoce. */
export function normalizeTreatment(raw: string): NormalizedTreatment | null {
  const text = normalizeText(raw);
  const match = TREATMENT_ALIASES.find(([pattern]) => pattern.test(text));
  if (!match) return null;
  const channel = CHANNEL_ALIASES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  return { key: match[1], channel };
}

/** Nombres de tratamiento dentro de un texto libre, sobre el texto original. */
const TREATMENT_WORDS: Array<[pattern: RegExp, key: TreatmentKey]> = [
  [/\bimplantes?\b/gi, "implantes"],
  [/\bortodoncia\b/gi, "ortodoncia"],
  [/\bcari+l+as\b/gi, "carillas"],
  [/\bblanqueamiento\b/gi, "blanqueamiento"],
  [/\best[eé]tica\b/gi, "estetica"],
  [/\bapnea(\s+del\s+sue[nñ]o)?/gi, "apnea"],
];

export interface TreatmentMention {
  /** Tratamientos nombrados, sin repetir y en orden de aparición en el catálogo. */
  treatments: TreatmentKey[];
  /** Lo que queda al quitar los tratamientos y los conectores ("Valladolid"). */
  rest: string;
}

/**
 * Busca tratamientos en un texto corto de la ficha.
 * "Implantes y Carillas Valladolid" → { treatments: [implantes, carillas], rest: "Valladolid" }.
 */
export function findTreatments(text: string): TreatmentMention {
  let rest = String(text ?? "");
  const treatments: TreatmentKey[] = [];
  for (const [pattern, key] of TREATMENT_WORDS) {
    pattern.lastIndex = 0;
    if (pattern.test(rest)) {
      treatments.push(key);
      rest = rest.replace(pattern, " ");
    }
  }
  rest = rest
    .replace(/(^|\s)[ye](?=\s|$)/gi, " ")
    .replace(/^[\s\-–:,.]+|[\s\-–:,.]+$/g, "")
    .replace(/\s+/g, " ");
  return { treatments, rest };
}

/** Número de fila de un hipervínculo a una celda: "#gid=1&range=A69", "#'Horarios '!A69". */
export function parseAnchorRow(link: string | null | undefined): number | null {
  const match = /(?:range=|!)\$?[A-Za-z]+\$?(\d+)/.exec(String(link ?? ""));
  return match ? Number(match[1]) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Fecha de Activos a ISO. Acepta el número de serie de la hoja (46235),
 * día/mes/año y el propio formato ISO. null si está vacía o no se entiende.
 */
export function parseMasterDate(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4,6}(\.\d+)?$/.test(text)) {
    // Las hojas de cálculo cuentan días desde el 30/12/1899.
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return `${year}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

const STATUS_ALIASES: Record<string, TreatmentStatus> = {
  activa: "activa",
  "pausa temporal": "pausa_temporal",
  "presupuesto agotado": "presupuesto_agotado",
  "pago error": "pago_error",
};

export function normalizeStatus(raw: unknown): TreatmentStatus {
  return STATUS_ALIASES[normalizeText(raw)] ?? "desconocido";
}

/** "SI" / "NO" de las fichas. null si el texto no empieza por ninguno de los dos. */
export function parseYesNo(raw: unknown): boolean | null {
  const text = normalizeText(raw);
  if (/^si\b/.test(text)) return true;
  if (/^no\b/.test(text)) return false;
  return null;
}
