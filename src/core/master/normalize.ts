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
