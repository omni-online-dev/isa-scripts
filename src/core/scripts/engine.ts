import type { Clinic, TreatmentKey } from "../schema";
import { buildContext } from "./context";
import { CLINIC_SCRIPTS } from "./templates/clinics";
import { TREATMENT_TEMPLATES } from "./templates/treatments";
import { recontacto, reprogramacion, simplificado } from "./templates/variants";
import type { BuiltScript, CallKind, ScriptContext, ScriptStep, ScriptTemplate } from "./types";

interface Choice {
  id: string;
  template: ScriptTemplate;
  notice: string | null;
}

/**
 * Qué guion corresponde. Reglas (docs/adr/0001):
 *  1. Reprogramación y recontacto tienen guion propio, igual para todas las clínicas.
 *  2. «Script Simplificado» en la Master → guion simplificado, siempre.
 *  3. Guion propio de la clínica, si está registrado en CLINIC_SCRIPTS.
 *  4. En el resto de casos («Selectivo» o sin indicar) → guion completo del tratamiento.
 */
function chooseTemplate(clinic: Clinic, key: TreatmentKey, kind: CallKind): Choice {
  if (kind === "reprogramacion") return { id: "reprogramacion", template: reprogramacion, notice: null };
  if (kind === "recontacto") return { id: "recontacto", template: recontacto, notice: null };

  const variant = clinic.treatments[key]?.scriptVariant;
  if (variant === "simplificado") return { id: "simplificado", template: simplificado, notice: null };

  const own = CLINIC_SCRIPTS[clinic.id]?.[key];
  if (own) return { ...own, notice: null };

  return {
    id: `tratamiento:${key}`,
    template: TREATMENT_TEMPLATES[key],
    notice:
      variant === "propio"
        ? "La Master indica un guion propio para esta clínica que aún no está cargado. Se muestra el guion general."
        : null,
  };
}

function render(template: ScriptTemplate, c: ScriptContext): ScriptStep[] {
  return template.steps
    .filter((step) => step.onlyIf?.(c) ?? true)
    .map((step, i) => ({
      number: i + 1,
      title: step.title,
      text: step.text(c),
      note: (typeof step.note === "function" ? step.note(c) : step.note) ?? null,
      rebate: step.rebate?.(c) ?? null,
      highlight: step.highlight ?? false,
    }));
}

/** Guion de una clínica para un tratamiento y un tipo de llamada. null si no ofrece ese tratamiento. */
export function buildScript(clinic: Clinic, key: TreatmentKey, kind: CallKind = "primera"): BuiltScript | null {
  const treatment = clinic.treatments[key];
  if (!treatment) return null;

  const { id, template, notice } = chooseTemplate(clinic, key, kind);
  return {
    template: id,
    label: template.label,
    steps: render(template, buildContext(clinic, key, treatment)),
    rebuttals: template.rebuttals ?? [],
    notice,
  };
}

const plain = (text: string) => text.replace(/\*\*/g, "");

/** Guion en texto plano, para «Copiar todo». */
export function scriptToPlainText(script: BuiltScript, clinicName: string): string {
  const steps = script.steps.map((step) =>
    [
      `${step.number}. ${step.title.toUpperCase()}`,
      plain(step.text),
      step.note ? `Nota: ${plain(step.note)}` : null,
      step.rebate ? `Si no cumple o pone pegas: ${plain(step.rebate)}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [`${clinicName} · ${script.label}`, ...steps].join("\n\n");
}
