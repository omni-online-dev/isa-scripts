"use client";

import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import type { BuiltScript, ScriptStep } from "@/core/scripts";
import { RichText } from "@/components/ui/RichText";
import { cn } from "@/lib/utils";

function Step({ step }: { step: ScriptStep }) {
  const [showRebate, setShowRebate] = useState(false);

  return (
    <li className={cn("card p-5", step.highlight && "border-cyan-200 bg-cyan-50/40")}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white tabular-nums"
        >
          {step.number}
        </span>
        <h3 className="eyebrow text-slate-600">{step.title}</h3>
      </div>

      <RichText text={step.text} className="mt-3 text-[17px] leading-relaxed text-slate-900" />

      {step.note && (
        <div className="mt-4 border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-600">
          <RichText text={step.note} className="space-y-1.5" />
        </div>
      )}

      {step.rebate && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={showRebate}
            onClick={() => setShowRebate((value) => !value)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
          >
            Si no cumple o pone pegas
            <ChevronDown aria-hidden className={cn("size-4 transition-transform", showRebate && "rotate-180")} />
          </button>
          {showRebate && (
            <RichText
              text={step.rebate}
              className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-950"
            />
          )}
        </div>
      )}
    </li>
  );
}

export function ScriptSteps({ script }: { script: BuiltScript }) {
  return (
    <div>
      {script.notice && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {script.notice}
        </p>
      )}
      {/* La clave reinicia las respuestas desplegadas al cambiar de guion. */}
      <ol className="space-y-3" key={script.template}>
        {script.steps.map((step) => (
          <Step key={step.number} step={step} />
        ))}
      </ol>
    </div>
  );
}
