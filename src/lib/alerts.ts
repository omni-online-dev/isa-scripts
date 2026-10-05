import type { Clinic, ClinicTreatment, Period, TreatmentStatus } from "@/core/schema";
import { formatDay } from "./text";

export interface ClinicAlert {
  tone: "warning" | "info";
  message: string;
}

const STATUS_MESSAGES: Partial<Record<TreatmentStatus, string>> = {
  pausa_temporal: "Campaña en pausa temporal. Confirma con tu responsable antes de agendar.",
  presupuesto_agotado: "Presupuesto de campaña agotado. Confirma con tu responsable antes de agendar.",
  pago_error: "La cuenta tiene una incidencia de pago. Confirma con tu responsable antes de agendar.",
  desconocido: "La Master no indica el estado de este tratamiento.",
};

/** ¿`today` cae dentro del periodo? Un extremo vacío se considera abierto. */
function isWithin(period: Period, today: string): boolean {
  if (period.from && today < period.from) return false;
  if (period.to && today > period.to) return false;
  return true;
}

function periodAlert(period: Period | null, today: string, current: string, upcoming: string): ClinicAlert | null {
  if (!period || (period.to && today > period.to)) return null;
  if (isWithin(period, today)) {
    return { tone: "warning", message: period.to ? `${current} hasta el ${formatDay(period.to)}.` : `${current}.` };
  }
  if (!period.from) return null;
  return {
    tone: "info",
    message: `${upcoming} del ${formatDay(period.from)}${period.to ? ` al ${formatDay(period.to)}` : ""}.`,
  };
}

/** Avisos que el agente debe ver antes de agendar. `today` en formato ISO (2026-10-04). */
export function clinicAlerts(clinic: Clinic, treatment: ClinicTreatment, today: string): ClinicAlert[] {
  const alerts: ClinicAlert[] = [];
  const status = STATUS_MESSAGES[treatment.status];
  if (status) alerts.push({ tone: "warning", message: status });

  const vacation = periodAlert(clinic.vacation, today, "Clínica de vacaciones", "La clínica estará de vacaciones");
  if (vacation) alerts.push(vacation);
  const pause = periodAlert(treatment.pause, today, "Llamadas de ISA en pausa", "Las llamadas de ISA se pausan");
  if (pause) alerts.push(pause);
  return alerts;
}
