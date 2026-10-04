import { normalizeText } from "./normalize";

/** Pestañas de la Master que alimentan la app. El espacio final de FICHAS es real. */
export const SHEETS = {
  activos: "Activos",
  fichas: "Horarios ",
} as const;

/**
 * LISTA BLANCA de columnas de Activos.
 * Solo estas columnas se leen y pueden llegar a Firestore. Añadir una columna
 * aquí es una decisión de seguridad: requiere revisión humana del PR.
 */
export const ACTIVOS_COLUMNS = {
  clinicTreatment: { header: "Clínica - Tratamiento", required: true },
  fichaLink: { header: "Link a Horarios", required: true },
  status: { header: "Estado", required: true },
  vacationFrom: { header: "Fecha inicio de vacaciones", required: false },
  vacationTo: { header: "Fecha de finalización de las vacaciones", required: false },
  pauseFrom: { header: "Fecha de pausa de ISA/IA", required: false },
  pauseTo: { header: "Fecha de reactivación de ISA/IA", required: false },
} as const satisfies Record<string, { header: string; required: boolean }>;

export type ActivosColumn = keyof typeof ACTIVOS_COLUMNS;

/**
 * Columnas de Activos conocidas que NO se sincronizan (presupuestos, contratación,
 * configuración de IA, notas…). Solo sirven para distinguir una columna nueva de
 * una que ya existía. Sus valores nunca se leen.
 */
export const ACTIVOS_IGNORED_HEADERS: readonly string[] = [
  "IA Status",
  "Reactivaciones",
  "IA Script ES",
  "IA Voz Español",
  "IA Script ING",
  "IA Voz Ingles",
  "IA Latencia",
  "Notas IA",
  "Notas Operativa",
  "Salud Actual",
  "Next Month",
  "CSS (antes 01/09)",
  "CSS (desde 01/09)",
  "MB",
  "POD",
  "Presup.",
  "Cuenta",
  "Renueva",
  "Optimización cuentas MB",
  "Primeras Visitas",
  "Libertad proceso creativo",
  "WA Masivo reactivación",
  "Permite generar contenido con IA",
  "Fecha de pausa de campaña",
  "Fecha de reactivación de campaña",
  "Notas vacaciones",
  "Tipo de contratación",
  "Notas de contratación",
];

export interface ResolvedColumns {
  /** Índice (base 0) de cada columna de la lista blanca presente en la hoja. */
  index: Partial<Record<ActivosColumn, number>>;
  /** Cabeceras obligatorias que faltan: detienen la sincronización. */
  missing: string[];
  /** Cabeceras que no están ni en la lista blanca ni entre las ignoradas. */
  unknown: string[];
}

/**
 * Localiza las columnas por NOMBRE de cabecera, nunca por posición: Operaciones
 * añade columnas cuando incorpora funciones nuevas.
 */
export function resolveActivosColumns(headerRow: readonly unknown[]): ResolvedColumns {
  const position = new Map<string, number>();
  headerRow.forEach((cell, i) => {
    const key = normalizeText(cell);
    if (key && !position.has(key)) position.set(key, i);
  });

  const index: Partial<Record<ActivosColumn, number>> = {};
  const missing: string[] = [];
  for (const [name, column] of Object.entries(ACTIVOS_COLUMNS) as Array<
    [ActivosColumn, (typeof ACTIVOS_COLUMNS)[ActivosColumn]]
  >) {
    const at = position.get(normalizeText(column.header));
    if (at !== undefined) index[name] = at;
    else if (column.required) missing.push(column.header);
  }

  const known = new Set(
    [...Object.values(ACTIVOS_COLUMNS).map((c) => c.header), ...ACTIVOS_IGNORED_HEADERS].map(
      normalizeText,
    ),
  );
  const unknown = headerRow
    .map((cell) => String(cell ?? "").replace(/\s+/g, " ").trim())
    .filter((header) => header && !known.has(normalizeText(header)));

  return { index, missing, unknown };
}

/** Etiquetas de la columna A de una ficha. */
export type FichaLabel =
  | "address"
  | "valuePoints"
  | "script"
  | "qualificationHeader"
  | "dni"
  | "nie"
  | "pasaporte"
  | "financing"
  | "aid"
  | "insurance"
  | "reminder"
  | "whatsapp"
  | "sameDayBooking"
  | "longTermBooking"
  | "promoHeader"
  | "mbFormHeader";

/**
 * Diccionario de etiquetas. Los patrones se aplican sobre el texto normalizado
 * (minúsculas, sin tildes). El orden importa: gana el primero que coincide.
 */
export const FICHA_LABELS: ReadonlyArray<{ label: FichaLabel; pattern: RegExp }> = [
  { label: "address", pattern: /^direccion\b/ },
  { label: "valuePoints", pattern: /^puntos? de valor\b/ },
  { label: "script", pattern: /^script\b/ },
  { label: "qualificationHeader", pattern: /^criterios de financiacion\b/ },
  { label: "mbFormHeader", pattern: /^(criterios para formulario mb|informacion para el mb)\b/ },
  { label: "dni", pattern: /^dni\s*:/ },
  { label: "nie", pattern: /^nie\s*:/ },
  { label: "pasaporte", pattern: /^pasaporte\s*:/ },
  { label: "financing", pattern: /^financiacion\b/ },
  { label: "aid", pattern: /^ayudas?\s*:/ },
  { label: "insurance", pattern: /^seguros?\s*:/ },
  { label: "reminder", pattern: /^recordatorio\b/ },
  { label: "whatsapp", pattern: /^whats ?app\b/ },
  { label: "sameDayBooking", pattern: /^agendamiento el mismo dia\b/ },
  { label: "longTermBooking", pattern: /^agendamiento a largo plazo\b/ },
  { label: "promoHeader", pattern: /^promocion(es)?\s*:?$/ },
];

/** Clasifica una línea de la columna A. null si no es una etiqueta conocida. */
export function classifyFichaLine(line: string): FichaLabel | null {
  const text = normalizeText(line);
  if (!text) return null;
  return FICHA_LABELS.find(({ pattern }) => pattern.test(text))?.label ?? null;
}
