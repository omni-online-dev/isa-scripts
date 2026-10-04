import { TREATMENT_LABELS, type Clinic, type ClinicTreatment, type TreatmentKey } from "../schema";
import type { ScriptContext } from "./types";

/** Quita el código postal: no se dice en voz alta. */
export function stripPostalCode(address: string): string {
  return address
    .replace(/\s*,?\s*\b\d{5}\b\s*,?\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,.]+$/, "")
    .trim();
}

/** Comienzos de referencia que ya son una indicación completa y no necesitan "muy cerca de". */
const SELF_CONTAINED_REFERENCE =
  /^(cerca|muy cerca|enfrente|frente|justo|al lado|junto|detr[aá]s|entre |en |a pie de calle|haciendo esquina|con |misma |a \d)/i;

/** "Estamos ubicados en **dirección**, referencia. ¿La zona te suena?" */
export function locationSentence(address: string, reference: string | null): string {
  if (!reference) return `Estamos ubicados en **${address}**. ¿La zona te suena?`;
  const ref = reference.trim().replace(/[.\s]+$/, "");
  const lead = SELF_CONTAINED_REFERENCE.test(ref) ? "" : "muy cerca de ";
  const spoken = lead ? ref : ref.charAt(0).toLowerCase() + ref.slice(1);
  return `Estamos ubicados en **${address}**, ${lead}${spoken}. ¿La zona te suena?`;
}

const DOCUMENTS = [
  ["dni", "DNI"],
  ["nie", "NIE"],
  ["pasaporte", "Pasaporte"],
] as const;

/** ["DNI", "NIE", "Pasaporte"] → "DNI, NIE o Pasaporte". */
function listWithOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} o ${items[items.length - 1]}`;
}

export function buildContext(
  clinic: Clinic,
  key: TreatmentKey,
  treatment: ClinicTreatment,
): ScriptContext {
  const address = stripPostalCode(clinic.address);
  const accepted = DOCUMENTS.filter(([field]) => treatment.qualification[field]);
  const econ = accepted
    .map(([field, label]) => `${label}: ${treatment.qualification[field]}`)
    .join("\n");

  return {
    name: clinic.name,
    address,
    location: locationSentence(address, clinic.reference),
    treatment: TREATMENT_LABELS[key].toLowerCase(),
    valuePoints: treatment.valuePoints,
    promo: treatment.promo.length ? treatment.promo.join(" · ") : null,
    // Sin criterios por documento en la ficha se pregunta por los tres habituales.
    docs: listWithOr(accepted.length ? accepted.map(([, label]) => label) : DOCUMENTS.map(([, l]) => l)),
    econ: econ || null,
    qualificationNote: treatment.qualification.note,
  };
}
