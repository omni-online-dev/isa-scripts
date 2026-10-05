import { ChevronDown } from "lucide-react";
import type { Rebuttal } from "@/core/scripts";
import { RichText } from "@/components/ui/RichText";

/** Respuestas a objeciones frecuentes. Se despliegan de una en una con <details> nativo. */
export function Rebuttals({ rebuttals }: { rebuttals: Rebuttal[] }) {
  if (rebuttals.length === 0) return null;
  return (
    <section className="card p-5" aria-labelledby="panel-objeciones">
      <h2 id="panel-objeciones" className="eyebrow mb-2">
        Objeciones frecuentes
      </h2>
      <div className="divide-y divide-line">
        {rebuttals.map((rebuttal) => (
          <details key={rebuttal.label} name="objeciones" className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg py-2 text-sm font-medium text-slate-900 hover:text-omni">
              {rebuttal.label}
              <ChevronDown aria-hidden className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="pb-3 text-sm leading-relaxed text-slate-700">
              <RichText text={rebuttal.response} />
              <p className="mt-3 rounded-lg bg-cyan-50 p-3 font-medium text-cyan-900">Cierre: «{rebuttal.cierre}»</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
