"use client";

import { AlertTriangle, Check, Copy, Info, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TREATMENT_KEYS, TREATMENT_LABELS, type Clinic, type TreatmentKey } from "@/core/schema";
import { CALL_KINDS, CALL_KIND_LABELS, buildScript, scriptToPlainText, type CallKind } from "@/core/scripts";
import { clinicAlerts } from "@/lib/alerts";
import type { Dataset } from "@/lib/dataset";
import { formatDateTime } from "@/lib/text";
import { cn } from "@/lib/utils";
import { ClinicPanel } from "./ClinicPanel";
import { ClinicSearch } from "./ClinicSearch";
import { Rebuttals } from "./Rebuttals";
import { ScriptSteps } from "./ScriptSteps";

const RECENTS_KEY = "omniscripts:recientes";
const MAX_RECENTS = 6;

const treatmentsOf = (clinic: Clinic) => TREATMENT_KEYS.filter((key) => clinic.treatments[key]);

function readRecents(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Grupo de botones excluyentes (tratamiento, tipo de llamada). */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-line bg-white p-0.5 shadow-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-9 rounded-md px-3 text-sm font-medium transition-colors",
            option.value === value ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-omni px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cyan-700"
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      {copied ? "Copiado" : "Copiar guion"}
    </button>
  );
}

export function Workspace({ dataset, header }: { dataset: Extract<Dataset, { status: "ready" }>; header: React.ReactNode }) {
  const { clinics, meta, fromCache } = dataset;
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [treatmentKey, setTreatmentKey] = useState<TreatmentKey | null>(null);
  const [kind, setKind] = useState<CallKind>("primera");
  // Este componente solo se monta en el navegador, con los datos ya cargados.
  const [recents, setRecents] = useState<string[]>(readRecents);

  // Avisa cuando llega una publicación nueva de la Master con la app abierta.
  const lastVersion = useRef<number | null>(null);
  useEffect(() => {
    if (!meta) return;
    if (lastVersion.current !== null && meta.version > lastVersion.current) toast.success("Datos actualizados desde la Master");
    lastVersion.current = meta.version;
  }, [meta]);

  // La clínica se busca en cada render: así refleja al instante los cambios de la Master.
  const clinic = useMemo(() => clinics.find((c) => c.id === clinicId) ?? null, [clinics, clinicId]);
  const available = clinic ? treatmentsOf(clinic) : [];
  const activeKey = treatmentKey && available.includes(treatmentKey) ? treatmentKey : (available[0] ?? null);
  const treatment = clinic && activeKey ? clinic.treatments[activeKey] : undefined;
  const script = clinic && activeKey ? buildScript(clinic, activeKey, kind) : null;

  const select = (next: Clinic) => {
    setClinicId(next.id);
    setTreatmentKey(null);
    setKind("primera");
    const updated = [next.id, ...recents.filter((id) => id !== next.id)].slice(0, MAX_RECENTS);
    setRecents(updated);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
    } catch {
      // Sin almacenamiento local solo se pierde la lista de recientes.
    }
    window.scrollTo({ top: 0 });
  };

  const status = (
    <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
      {fromCache && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
          <WifiOff aria-hidden className="size-3.5" />
          Sin conexión
        </span>
      )}
      {meta?.publishedAt && <span>Actualizado {formatDateTime(meta.publishedAt)}</span>}
    </p>
  );

  if (!clinic || !activeKey || !treatment || !script) {
    const recentClinics = recents.flatMap((id) => clinics.find((c) => c.id === id) ?? []);
    return (
      <div className="flex min-h-full flex-col">
        {header}
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 pb-32 pt-12">
          <h1 className="text-center text-2xl font-bold text-slate-900">¿A qué clínica llamas?</h1>
          <p className="mb-6 mt-1 text-center text-sm text-slate-500">
            {clinics.length} clínicas disponibles. Escribe el nombre o la ciudad.
          </p>
          <ClinicSearch clinics={clinics} selected={null} onSelect={select} autoFocus size="lg" />
          {recentClinics.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-2">Recientes</p>
              <div className="flex flex-wrap gap-2">
                {recentClinics.map((recent) => (
                  <button
                    key={recent.id}
                    type="button"
                    onClick={() => select(recent)}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    {recent.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-8 flex justify-center">{status}</div>
        </main>
      </div>
    );
  }

  const alerts = clinicAlerts(clinic, treatment, todayIso());

  return (
    <div className="flex min-h-full flex-col">
      {header}
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <div className="w-full sm:w-80">
            <ClinicSearch clinics={clinics} selected={clinic} onSelect={select} />
          </div>
          {available.length > 1 && (
            <Segmented
              label="Tratamiento"
              value={activeKey}
              onChange={setTreatmentKey}
              options={available.map((key) => ({ value: key, label: TREATMENT_LABELS[key] }))}
            />
          )}
          <Segmented
            label="Tipo de llamada"
            value={kind}
            onChange={setKind}
            options={CALL_KINDS.map((value) => ({ value, label: CALL_KIND_LABELS[value] }))}
          />
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden xl:block">{status}</span>
            <CopyButton text={scriptToPlainText(script, clinic.name)} />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">{clinic.name}</h1>
          <p className="text-sm text-slate-500">
            {TREATMENT_LABELS[activeKey]} · {script.label}
          </p>
        </header>

        {alerts.length > 0 && (
          <ul className="mb-4 space-y-2" aria-label="Avisos">
            {alerts.map((alert) => (
              <li
                key={alert.message}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-3 text-sm font-medium",
                  alert.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-cyan-200 bg-cyan-50 text-cyan-900",
                )}
              >
                {alert.tone === "warning" ? (
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                )}
                {alert.message}
              </li>
            ))}
          </ul>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <ScriptSteps script={script} />
          <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pb-2">
            <ClinicPanel clinic={clinic} treatment={treatment} />
            <Rebuttals rebuttals={script.rebuttals} />
          </aside>
        </div>
      </main>
    </div>
  );
}
