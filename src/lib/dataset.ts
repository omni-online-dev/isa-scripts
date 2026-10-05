"use client";

import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ClinicSchema, type Clinic } from "@/core/schema";
import { DATA_NAMESPACE, firebaseEnabled, getDb } from "./firebase";
import { fold } from "./text";

export interface DatasetMeta {
  version: number;
  publishedAt: string | null;
}

export type Dataset =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; clinics: Clinic[]; meta: DatasetMeta | null; fromCache: boolean };

const byName = (a: Clinic, b: Clinic) => fold(a.name).localeCompare(fold(b.name));

/** Un documento que no cumple el contrato se descarta: mejor una clínica menos que un guion roto. */
function parseClinics(raw: unknown[]): Clinic[] {
  return raw
    .flatMap((item) => {
      const parsed = ClinicSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    })
    .sort(byName);
}

function toIso(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString();
  }
  return null;
}

const LOAD_ERROR = "No se pudieron cargar los datos. Revisa tu conexión.";

/**
 * Clínicas publicadas, en tiempo real. `enabled` evita abrir la conexión antes de
 * que la sesión esté lista.
 */
export function useDataset(enabled: boolean): Dataset {
  const [dataset, setDataset] = useState<Dataset>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;

    if (!firebaseEnabled) {
      let cancelled = false;
      fetch("/api/local/dataset")
        .then(async (response) => {
          const body = await response.json();
          if (cancelled) return;
          if (!response.ok) return setDataset({ status: "error", message: body.error ?? LOAD_ERROR });
          setDataset({
            status: "ready",
            clinics: parseClinics(body.clinics),
            meta: { version: body.meta.version, publishedAt: body.meta.publishedAt },
            fromCache: false,
          });
        })
        .catch(() => {
          if (!cancelled) setDataset({ status: "error", message: LOAD_ERROR });
        });
      return () => {
        cancelled = true;
      };
    }

    const db = getDb();
    let clinics: Clinic[] | null = null;
    let meta: DatasetMeta | null = null;
    let fromCache = false;
    const emit = () => {
      if (clinics) setDataset({ status: "ready", clinics, meta, fromCache });
    };

    const stopClinics = onSnapshot(
      collection(db, "env", DATA_NAMESPACE, "clinics"),
      { includeMetadataChanges: true },
      (snapshot) => {
        clinics = parseClinics(snapshot.docs.map((d) => d.data()));
        fromCache = snapshot.metadata.fromCache;
        emit();
      },
      () => setDataset({ status: "error", message: LOAD_ERROR }),
    );
    const stopMeta = onSnapshot(
      doc(db, "env", DATA_NAMESPACE, "meta", "current"),
      (snapshot) => {
        const data = snapshot.data();
        meta = data ? { version: Number(data.version ?? 0), publishedAt: toIso(data.publishedAt) } : null;
        emit();
      },
      () => undefined, // sin metadatos la app sigue siendo usable
    );
    return () => {
      stopClinics();
      stopMeta();
    };
  }, [enabled]);

  return dataset;
}
