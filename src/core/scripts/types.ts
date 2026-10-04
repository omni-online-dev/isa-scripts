/** Tipo de llamada. Reprogramación y recontacto valen para cualquier clínica. */
export const CALL_KINDS = ["primera", "reprogramacion", "recontacto"] as const;
export type CallKind = (typeof CALL_KINDS)[number];

export const CALL_KIND_LABELS: Record<CallKind, string> = {
  primera: "Primera llamada",
  reprogramacion: "Reprogramación",
  recontacto: "Recontacto",
};

/**
 * Datos de la clínica ya preparados para escribir el guion.
 * Los textos usan **negrita** como única marca de formato.
 */
export interface ScriptContext {
  name: string;
  /** Dirección sin código postal, para decirla en voz alta. */
  address: string;
  /** Frase de ubicación completa: "Estamos ubicados en … ¿La zona te suena?" */
  location: string;
  /** Tratamiento en minúsculas, para insertarlo en una frase. */
  treatment: string;
  valuePoints: string | null;
  /** Promoción del tratamiento en una línea. */
  promo: string | null;
  /** Documentos aceptados: "DNI, NIE o Pasaporte". */
  docs: string;
  /** Criterios económicos por documento, una línea por documento. null = no se cualifica. */
  econ: string | null;
  /** Aclaración de la ficha cuando no se cualifica por documento. */
  qualificationNote: string | null;
}

type Text = (c: ScriptContext) => string;

export interface StepTemplate {
  title: string;
  text: Text;
  /** Indicación para el agente; no se dice al paciente. */
  note?: string | ((c: ScriptContext) => string | null);
  /** Respuesta si el paciente no cumple o pone una pega en este paso. */
  rebate?: Text;
  highlight?: boolean;
  /** El paso solo aparece si se cumple la condición. */
  onlyIf?: (c: ScriptContext) => boolean;
}

/** Respuesta preparada a una objeción frecuente. */
export interface Rebuttal {
  label: string;
  response: string;
  cierre: string;
}

export interface ScriptTemplate {
  label: string;
  steps: StepTemplate[];
  rebuttals?: Rebuttal[];
}

export interface ScriptStep {
  number: number;
  title: string;
  text: string;
  note: string | null;
  rebate: string | null;
  highlight: boolean;
}

/** Guion listo para mostrar. */
export interface BuiltScript {
  /** Identificador de la plantilla usada, para trazabilidad y tests. */
  template: string;
  label: string;
  steps: ScriptStep[];
  rebuttals: Rebuttal[];
  /** Aviso para el agente cuando el guion mostrado no es exactamente el que indica la Master. */
  notice: string | null;
}
