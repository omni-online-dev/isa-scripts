import { describe, expect, it } from "vitest";
import { masterFixture } from "../../fixtures/master.fixture";
import type { MasterInput } from "@/core/master";
import type { MasterSource } from "./master/source";
import { MemoryClinicStore } from "./store";
import { checkForChanges } from "./watch";

/** Fuente falsa: cuenta las lecturas completas y permite simular ediciones. */
function fakeSource(modifiedTime: string | null) {
  const state = { modifiedTime, input: masterFixture as MasterInput, reads: 0, fail: false };
  const source: MasterSource = {
    modifiedTime: async () => state.modifiedTime,
    read: async () => {
      state.reads++;
      if (state.fail) throw new Error("Sheets no responde");
      return state.input;
    },
  };
  return { source, state };
}

const at = (iso: string) => () => new Date(iso);
const withoutHeader = (name: string): MasterInput => ({
  ...masterFixture,
  activos: {
    ...masterFixture.activos,
    values: masterFixture.activos.values.map((row, i) => (i === 0 ? row.map((v) => (v === name ? "" : v)) : row)),
  },
});

describe("checkForChanges", () => {
  it("publica cuando la hoja cambió y lleva un minuto sin ediciones", async () => {
    const store = new MemoryClinicStore();
    const { source } = fakeSource("2026-10-06T10:00:00.000Z");

    const result = await checkForChanges({ source, store, now: at("2026-10-06T10:02:00.000Z") });

    expect(result).toMatchObject({ status: "published", version: 1, trigger: "edit" });
    expect(await store.getWatermark()).toBe("2026-10-06T10:00:00.000Z");
  });

  it("no lee la hoja ni registra nada si no ha cambiado", async () => {
    const store = new MemoryClinicStore();
    const { source, state } = fakeSource("2026-10-06T10:00:00.000Z");
    await checkForChanges({ source, store, now: at("2026-10-06T10:02:00.000Z") });

    const result = await checkForChanges({ source, store, now: at("2026-10-06T10:03:00.000Z") });

    expect(result).toEqual({ status: "idle" });
    expect(state.reads).toBe(1);
    expect(store.runs).toHaveLength(1);
  });

  it("espera si alguien sigue editando", async () => {
    const store = new MemoryClinicStore();
    const { source, state } = fakeSource("2026-10-06T10:00:00.000Z");

    expect(await checkForChanges({ source, store, now: at("2026-10-06T10:00:30.000Z") })).toEqual({ status: "waiting" });
    expect(state.reads).toBe(0);

    const later = await checkForChanges({ source, store, now: at("2026-10-06T10:01:30.000Z") });
    expect(later).toMatchObject({ status: "published" });
  });

  it("reintenta en la siguiente pasada tras un fallo técnico", async () => {
    const store = new MemoryClinicStore();
    const { source, state } = fakeSource("2026-10-06T10:00:00.000Z");
    state.fail = true;

    expect(await checkForChanges({ source, store, now: at("2026-10-06T10:02:00.000Z") })).toMatchObject({ status: "failed" });
    expect(await store.getWatermark()).toBeNull();

    state.fail = false;
    expect(await checkForChanges({ source, store, now: at("2026-10-06T10:03:00.000Z") })).toMatchObject({ status: "published" });
  });

  it("no repite cada minuto una publicación bloqueada", async () => {
    const store = new MemoryClinicStore();
    const { source, state } = fakeSource("2026-10-06T10:00:00.000Z");
    state.input = withoutHeader("Estado");

    expect(await checkForChanges({ source, store, now: at("2026-10-06T10:02:00.000Z") })).toMatchObject({ status: "blocked" });
    expect(await checkForChanges({ source, store, now: at("2026-10-06T10:03:00.000Z") })).toEqual({ status: "idle" });

    // Al corregir la hoja cambia su fecha de modificación y se vuelve a intentar.
    state.input = masterFixture;
    state.modifiedTime = "2026-10-06T10:05:00.000Z";
    expect(await checkForChanges({ source, store, now: at("2026-10-06T10:07:00.000Z") })).toMatchObject({ status: "published" });
  });

  it("sin fecha de modificación sincroniza siempre", async () => {
    const store = new MemoryClinicStore();
    const { source, state } = fakeSource(null);

    expect(await checkForChanges({ source, store })).toMatchObject({ status: "published", trigger: "schedule" });
    expect(await checkForChanges({ source, store })).toMatchObject({ status: "unchanged" });
    expect(state.reads).toBe(2);
  });
});
