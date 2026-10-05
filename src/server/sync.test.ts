import { afterEach, describe, expect, it, vi } from "vitest";
import { masterFixture } from "../../fixtures/master.fixture";
import type { MasterInput } from "@/core/master";
import { parseMaster } from "@/core/master";
import { MasterSheetNotFoundError, type MasterSource } from "./master/source";
import { MemoryClinicStore } from "./store";
import {
  SnapshotNotFoundError,
  SyncBusyError,
  checksumOf,
  diffClinics,
  rollbackTo,
  runSync,
  stableStringify,
} from "./sync";

const sourceOf = (input: MasterInput): MasterSource => ({ read: async () => input });
const fixtureSource = sourceOf(masterFixture);
const expected = parseMaster(masterFixture).clinics;

/** Cambia una celda de la columna A de las fichas (la primera que coincide). */
function editFicha(from: string, to: string): MasterInput {
  const at = masterFixture.fichas.values.findIndex((row) => row[0] === from);
  if (at < 0) throw new Error(`La fixture no tiene la línea «${from}»`);
  const values = masterFixture.fichas.values.map((row, i) => (i === at ? [to, ...row.slice(1)] : row));
  return { ...masterFixture, fichas: { values } };
}

/** Deja Activos con la cabecera y las `rows` primeras filas de datos. */
const firstRows = (rows: number): MasterInput => ({
  ...masterFixture,
  activos: {
    values: masterFixture.activos.values.slice(0, rows + 1),
    hyperlinks: masterFixture.activos.hyperlinks?.slice(0, rows + 1),
  },
});

const published = async () => {
  const store = new MemoryClinicStore();
  await runSync({ source: fixtureSource, store, trigger: "manual" });
  return store;
};

afterEach(() => vi.restoreAllMocks());

describe("runSync", () => {
  it("la primera ejecución publica la versión 1", async () => {
    const store = new MemoryClinicStore();
    const now = new Date("2026-10-05T08:00:00.000Z");
    const run = await runSync({ source: fixtureSource, store, trigger: "edit", now: () => now });

    expect(run).toMatchObject({
      status: "published",
      trigger: "edit",
      version: 1,
      clinicCount: expected.length,
      startedAt: now.toISOString(),
    });
    expect(run.id).toBeTruthy();
    expect(expected.length).toBeGreaterThan(3);

    const current = await store.getCurrent();
    expect(current?.version).toBe(1);
    expect(current?.clinics.map((c) => c.id).sort()).toEqual(expected.map((c) => c.id).sort());
    expect(store.publications[0]?.publishedAt).toBe(now.toISOString());
    expect(await store.listRuns(5)).toEqual([run]);
  });

  it("una segunda ejecución idéntica no escribe nada salvo el registro", async () => {
    const store = await published();
    const run = await runSync({ source: fixtureSource, store, trigger: "schedule" });

    expect(run).toMatchObject({ status: "unchanged", version: 1, clinicCount: expected.length });
    expect(store.publications).toHaveLength(1);
    expect(store.runs).toHaveLength(2);
  });

  it("al cambiar una línea de promoción republica solo esa clínica", async () => {
    const store = await published();
    const before = await store.getCurrent();
    const run = await runSync({
      source: sourceOf(editFicha("Descuento: 20%", "Descuento: 25%")),
      store,
      trigger: "edit",
    });

    expect(run).toMatchObject({ status: "published", version: 2, clinicCount: expected.length });
    const last = store.publications.at(-1);
    expect(last?.changed.map((c) => c.id)).toEqual(["clinica-dental-norte"]);
    expect(last?.removed).toEqual([]);
    expect(last?.changed[0]?.treatments.implantes?.promo).toEqual(["Descuento: 25%"]);

    const after = await store.getCurrent();
    expect(after?.version).toBe(2);
    expect(after?.checksum).not.toBe(before?.checksum);
    expect(after?.clinics).toHaveLength(expected.length);
  });

  it("retira de la app las clínicas que ya no están en la Master", async () => {
    const store = await published();
    const sinUltimas = firstRows(7); // se queda sin Clínica Oeste
    const run = await runSync({ source: sourceOf(sinUltimas), store, trigger: "edit" });

    expect(run.status).toBe("published");
    expect(store.publications.at(-1)?.removed).toEqual(["clinica-oeste"]);
    expect(store.publications.at(-1)?.changed).toEqual([]);
    expect((await store.getCurrent())?.clinics.map((c) => c.id)).not.toContain("clinica-oeste");
  });

  it("si falta una columna obligatoria se bloquea y la versión 1 sigue intacta", async () => {
    const store = await published();
    const before = await store.getCurrent();
    const sinEstado: MasterInput = {
      ...masterFixture,
      activos: {
        ...masterFixture.activos,
        values: masterFixture.activos.values.map((row, i) =>
          i === 0 ? row.map((v) => (v === "Estado" ? "" : v)) : row,
        ),
      },
    };
    const run = await runSync({ source: sourceOf(sinEstado), store, trigger: "edit" });

    expect(run).toMatchObject({ status: "blocked", version: null });
    expect(run.issues[0]).toMatchObject({ code: "missing_required_column", severity: "error" });
    expect(await store.getCurrent()).toEqual(before);
    expect(store.publications).toHaveLength(1);
  });

  it("si desaparece una pestaña se bloquea con `sheet_not_found`", async () => {
    const store = await published();
    const source: MasterSource = {
      read: async () => {
        throw new MasterSheetNotFoundError("Horarios ");
      },
    };
    const run = await runSync({ source, store, trigger: "schedule" });

    expect(run.status).toBe("blocked");
    expect(run.issues).toEqual([
      expect.objectContaining({ code: "sheet_not_found", severity: "error", sheet: "Horarios " }),
    ]);
    expect((await store.getCurrent())?.version).toBe(1);
  });

  it("no publica una caída brusca del número de clínicas", async () => {
    const store = await published();
    for (const input of [firstRows(1), firstRows(0)]) {
      const run = await runSync({ source: sourceOf(input), store, trigger: "edit" });
      expect(run).toMatchObject({ status: "blocked", version: null });
      expect(run.issues.at(-1)).toMatchObject({ code: "suspicious_drop", severity: "error" });
      expect(run.issues.at(-1)?.message).toContain(`${expected.length} en la app`);
    }
    expect(store.publications).toHaveLength(1);
    expect((await store.getCurrent())?.clinics).toHaveLength(expected.length);
  });

  it("un error inesperado queda como `failed`, se registra y libera el cerrojo", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = await published();
    const source: MasterSource = {
      read: async () => {
        throw new Error("credenciales caducadas");
      },
    };
    const run = await runSync({ source, store, trigger: "schedule" });

    expect(run).toMatchObject({ status: "failed", version: null, clinicCount: 0, issues: [] });
    expect(JSON.stringify(run)).not.toContain("credenciales");
    expect(log).toHaveBeenCalled();
    expect(store.runs.at(-1)?.status).toBe("failed");
    expect(await store.acquireLock(1000)).toBe(true);
  });

  it("si hay otra sincronización en marcha lanza SyncBusyError", async () => {
    const store = new MemoryClinicStore();
    expect(await store.acquireLock(60_000)).toBe(true);

    await expect(
      runSync({ source: fixtureSource, store, trigger: "edit", lockWaitMs: 0 }),
    ).rejects.toBeInstanceOf(SyncBusyError);
    expect(store.runs).toHaveLength(0);

    await store.releaseLock();
    const run = await runSync({ source: fixtureSource, store, trigger: "edit", lockWaitMs: 0 });
    expect(run.status).toBe("published");
  });

  it("espera un momento a que termine la otra sincronización", async () => {
    const store = new MemoryClinicStore();
    await store.acquireLock(60_000);
    setTimeout(() => void store.releaseLock(), 100);

    const run = await runSync({ source: fixtureSource, store, trigger: "edit", lockWaitMs: 3000 });
    expect(run.status).toBe("published");
  });
});

describe("rollbackTo", () => {
  it("publica el contenido antiguo como versión nueva", async () => {
    const store = await published();
    const v1 = await store.getCurrent();
    await runSync({
      source: sourceOf(editFicha("Descuento: 20%", "Descuento: 25%")),
      store,
      trigger: "edit",
    });

    const run = await rollbackTo(1, store);
    expect(run).toMatchObject({ status: "published", trigger: "admin", version: 3 });

    const current = await store.getCurrent();
    expect(current?.version).toBe(3);
    expect(current?.checksum).toBe(v1?.checksum);
    expect(store.publications.at(-1)?.changed.map((c) => c.id)).toEqual(["clinica-dental-norte"]);
    // Las copias anteriores siguen ahí: el historial no se reescribe.
    expect((await store.getSnapshot(2))?.clinics).toHaveLength(expected.length);
  });

  it("restaurar la versión vigente no publica nada", async () => {
    const store = await published();
    const run = await rollbackTo(1, store);
    expect(run).toMatchObject({ status: "unchanged", trigger: "admin", version: 1 });
    expect(store.publications).toHaveLength(1);
  });

  it("falla con un error propio si la versión no existe", async () => {
    const store = await published();
    await expect(rollbackTo(9, store)).rejects.toBeInstanceOf(SnapshotNotFoundError);
    expect(store.runs).toHaveLength(1);
  });
});

describe("huella y diferencias", () => {
  it("la huella no depende del orden de las claves ni de las clínicas", () => {
    expect(stableStringify({ b: 1, a: [{ d: null, c: "x" }] })).toBe('{"a":[{"c":"x","d":null}],"b":1}');
    expect(checksumOf([...expected].reverse())).toBe(checksumOf(expected));
    expect(checksumOf(expected)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("diffClinics separa altas, cambios y bajas", () => {
    const [a, b, c] = expected;
    if (!a || !b || !c) throw new Error("La fixture necesita al menos tres clínicas");
    expect(diffClinics([a, b], [{ ...b, reminder: !b.reminder }, c])).toEqual({
      added: [c.id],
      changed: [b.id],
      removed: [a.id],
    });
  });
});
