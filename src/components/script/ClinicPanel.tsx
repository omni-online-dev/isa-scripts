import type { ReactNode } from "react";
import type { Clinic, ClinicTreatment, ScheduleRow } from "@/core/schema";

const yesNo = (value: boolean | null) => (value === null ? null : value ? "Sí" : "No");

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm leading-snug text-slate-900">
        {children ?? <span className="text-slate-400">Sin dato</span>}
      </dd>
    </div>
  );
}

/** Agrupa los horarios por sede o condición, conservando el orden de la ficha. */
function groupSchedules(schedules: ScheduleRow[]): Array<[group: string | null, rows: ScheduleRow[]]> {
  const groups = new Map<string | null, ScheduleRow[]>();
  for (const row of schedules) groups.set(row.group, [...(groups.get(row.group) ?? []), row]);
  return [...groups];
}

function Schedules({ schedules }: { schedules: ScheduleRow[] }) {
  if (schedules.length === 0) {
    return <p className="text-sm text-slate-500">La ficha no tiene horario. Consulta la disponibilidad en la plataforma.</p>;
  }
  return (
    <div className="space-y-4">
      {groupSchedules(schedules).map(([group, rows]) => (
        <div key={group ?? "-"}>
          {group && <p className="mb-1 text-sm font-semibold text-slate-900">{group}</p>}
          <table className="w-full text-sm tabular-nums">
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={i} className="align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium text-slate-700">
                    {row.days}
                  </th>
                  <td className="py-1.5 text-slate-900">
                    {row.hours}
                    {row.duration && <span className="ml-2 whitespace-nowrap text-xs text-slate-500">{row.duration}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

const DOCUMENTS = [
  ["dni", "DNI"],
  ["nie", "NIE"],
  ["pasaporte", "Pasaporte"],
] as const;

/** Ficha de la clínica para el tratamiento elegido: lo que el agente consulta durante la llamada. */
export function ClinicPanel({ clinic, treatment }: { clinic: Clinic; treatment: ClinicTreatment }) {
  const { qualification } = treatment;
  const documents = DOCUMENTS.filter(([field]) => qualification[field]);

  return (
    <div className="space-y-4">
      <section className="card p-5" aria-labelledby="panel-horario">
        <h2 id="panel-horario" className="eyebrow mb-3">
          Horario de citas
        </h2>
        <Schedules schedules={treatment.schedules} />
        <dl className="mt-3 grid grid-cols-2 gap-x-4 border-t border-line pt-1">
          <Row label="Agendar el mismo día">{yesNo(clinic.sameDayBooking)}</Row>
          <Row label="Agendar a más de 72 h">{yesNo(treatment.longTermBooking)}</Row>
        </dl>
      </section>

      <section className="card p-5" aria-labelledby="panel-ficha">
        <h2 id="panel-ficha" className="eyebrow mb-1">
          Ficha de la clínica
        </h2>
        <dl className="divide-y divide-line">
          <Row label="Dirección">
            {clinic.locations.length > 1 ? (
              <ul className="space-y-1">
                {clinic.locations.map((location) => (
                  <li key={location.name}>
                    <span className="font-medium">{location.name}:</span> {location.address}
                  </li>
                ))}
              </ul>
            ) : (
              clinic.address
            )}
          </Row>
          {clinic.reference && <Row label="Referencia">{clinic.reference}</Row>}
          <Row label="Promoción">
            {treatment.promo.length > 0 && (
              <ul className="space-y-0.5">
                {treatment.promo.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </Row>
          <Row label="Documentación y criterios">
            {(documents.length > 0 || qualification.note) && (
              <div className="space-y-1">
                {documents.map(([field, label]) => (
                  <p key={field}>
                    <span className="font-medium">{label}:</span> {qualification[field]}
                  </p>
                ))}
                {qualification.note && <p>{qualification.note}</p>}
              </div>
            )}
          </Row>
          <Row label="Financiación">{clinic.financing}</Row>
          <Row label="Ayudas">{clinic.aid}</Row>
          <Row label="Seguros">{clinic.insurance}</Row>
          <Row label="WhatsApp">{clinic.whatsapp}</Row>
          <Row label="Recordatorio de cita">{yesNo(clinic.reminder)}</Row>
        </dl>
      </section>
    </div>
  );
}
