import fs from "fs";
import os from "os";
import path from "path";
import type { sheets_v4 } from "googleapis";
import { afterAll, describe, expect, it } from "vitest";
import {
  FileMasterSource,
  MasterSheetNotFoundError,
  SheetsMasterSource,
  applyWhitelist,
  getMasterSource,
  toMasterInput,
} from "./source";

type Cell = sheets_v4.Schema$CellData;
const text = (formattedValue: string): Cell => ({ formattedValue });
const row = (...values: Cell[]): sheets_v4.Schema$RowData => ({ values });
const date = (formattedValue: string, numberValue: number, type = "DATE"): Cell => ({
  formattedValue,
  effectiveValue: { numberValue },
  effectiveFormat: { numberFormat: { type } },
});

/** Respuesta mínima de `spreadsheets.get`, escrita a mano. */
const activosSheet: sheets_v4.Schema$Sheet = {
  properties: { title: "Activos" },
  data: [
    {
      rowData: [
        row(
          text("Clínica - Tratamiento"),
          text("Presup."),
          text("Link a Horarios"),
          text("Estado"),
          text("Fecha inicio de vacaciones"),
          text("Notas Operativa"),
        ),
        row(
          text("Clínica Uno - Implantes"),
          { formattedValue: "1500", hyperlink: "https://ejemplo.test/presupuesto" },
          { formattedValue: "Hoja Horarios", hyperlink: "#gid=111&range=A2" },
          text("Activa"),
          date("8/1/2026", 46235),
          text("nota interna de operativa"),
        ),
        row(
          text("Clínica Dos - Ortodoncia"),
          text("900"),
          {
            formattedValue: "Ver ficha",
            textFormatRuns: [{ startIndex: 0 }, { format: { link: { uri: "#gid=111&range=A9" } } }],
          },
          text("Pausa Temporal"),
          date("1/8/2026 10:30", 46235.4375, "DATE_TIME"),
        ),
        row(),
        row(text("Clínica Tres - Implantes"), text("700"), text(""), text("Activa"), text("pendiente")),
      ],
    },
  ],
};

const fichasSheet: sheets_v4.Schema$Sheet = {
  properties: { title: "Horarios " },
  data: [
    {
      rowData: [
        row(text(""), text("Dias "), text("Horario "), text("Duracion de la cita"), text("Notas")),
        row(text("Clínica Uno"), {}, text("Implantes")),
        row(
          text("Dirección: Calle Uno, 1"),
          text("Lunes"),
          date("10:00 a 13:00", 0.41, "TIME"),
          text("30min"),
          text("nota interna de la ficha"),
          text("otra columna"),
        ),
      ],
    },
  ],
};

const spreadsheet: sheets_v4.Schema$Spreadsheet = { sheets: [fichasSheet, activosSheet] };

describe("toMasterInput", () => {
  const input = toMasterInput(spreadsheet);

  it("conserva la cabecera completa de Activos", () => {
    expect(input.activos.values[0]).toEqual([
      "Clínica - Tratamiento",
      "Presup.",
      "Link a Horarios",
      "Estado",
      "Fecha inicio de vacaciones",
      "Notas Operativa",
    ]);
  });

  it("vacía las columnas que no están en la lista blanca", () => {
    expect(input.activos.values[1]).toEqual([
      "Clínica Uno - Implantes",
      "",
      "Hoja Horarios",
      "Activa",
      "46235",
      "",
    ]);
    const todo = JSON.stringify(input);
    for (const secreto of ["1500", "900", "700", "nota interna", "presupuesto"]) {
      expect(todo).not.toContain(secreto);
    }
  });

  it("entrega las fechas como número de serie y el resto como texto", () => {
    expect(input.activos.values[1]?.[4]).toBe("46235");
    expect(input.activos.values[2]?.[4]).toBe("46235.4375");
    expect(input.activos.values[4]?.[4]).toBe("pendiente");
  });

  it("lee el enlace de la celda o de un tramo del texto, solo en «Link a Horarios»", () => {
    expect(input.activos.hyperlinks).toEqual([
      [null, null, null, null, null, null],
      [null, null, "#gid=111&range=A2", null, null, null],
      [null, null, "#gid=111&range=A9", null, null],
      [],
      [null, null, null, null, null],
    ]);
  });

  it("respeta las filas vacías para no desplazar la numeración", () => {
    expect(input.activos.values).toHaveLength(5);
    expect(input.activos.values[3]).toEqual([]);
  });

  it("de las fichas solo salen las columnas A–D, como texto", () => {
    expect(input.fichas.values).toEqual([
      ["", "Dias ", "Horario ", "Duracion de la cita"],
      ["Clínica Uno", "", "Implantes"],
      ["Dirección: Calle Uno, 1", "Lunes", "10:00 a 13:00", "30min"],
    ]);
    expect(input.fichas.hyperlinks).toBeUndefined();
  });

  it("avisa con un error propio si falta una pestaña", () => {
    expect(() => toMasterInput({ sheets: [activosSheet] })).toThrowError(MasterSheetNotFoundError);
    // «Horarios» sin el espacio final es la pestaña heredada, no la de fichas.
    const heredada = { ...fichasSheet, properties: { title: "Horarios" } };
    expect(() => toMasterInput({ sheets: [activosSheet, heredada] })).toThrowError(/Horarios /);
    expect(() => toMasterInput({})).toThrowError(/Activos/);
  });
});

describe("applyWhitelist", () => {
  it("sin la cabecera de «Link a Horarios» no deja pasar ningún enlace", () => {
    const out = applyWhitelist({
      activos: {
        values: [
          ["Clínica - Tratamiento", "Estado"],
          ["Clínica Uno - Implantes", "Activa"],
        ],
        hyperlinks: [
          [null, null],
          ["https://ejemplo.test/a", "https://ejemplo.test/b"],
        ],
      },
      fichas: { values: [] },
    });
    expect(out.activos.hyperlinks).toEqual([
      [null, null],
      [null, null],
    ]);
  });
});

describe("FileMasterSource", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniscripts-source-"));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("aplica la misma lista blanca que la lectura de Sheets", async () => {
    const file = path.join(dir, "master.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        activos: {
          values: [
            ["Clínica - Tratamiento", "Link a Horarios", "Estado", "Presup."],
            ["Clínica Uno - Implantes", "Hoja Horarios", "Activa", "1500"],
          ],
          hyperlinks: [
            [null, null, null, null],
            [null, "#gid=1&range=A2", null, "https://ejemplo.test/presupuesto"],
          ],
        },
        fichas: { values: [["Clínica Uno", "Lunes", "10:00 a 13:00", "30min", "nota interna"]] },
      }),
    );

    const input = await new FileMasterSource(file).read();
    expect(input.activos.values[1]).toEqual(["Clínica Uno - Implantes", "Hoja Horarios", "Activa", ""]);
    expect(input.activos.hyperlinks?.[1]).toEqual([null, "#gid=1&range=A2", null, null]);
    expect(input.fichas.values[0]).toEqual(["Clínica Uno", "Lunes", "10:00 a 13:00", "30min"]);
  });

  it("trata un archivo sin una de las pestañas como pestaña ausente", async () => {
    const file = path.join(dir, "incompleto.json");
    fs.writeFileSync(file, JSON.stringify({ activos: { values: [] } }));
    await expect(new FileMasterSource(file).read()).rejects.toBeInstanceOf(MasterSheetNotFoundError);
  });
});

describe("getMasterSource", () => {
  const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

  it("usa Sheets si hay ID de hoja y archivo local si no", () => {
    expect(getMasterSource(env({ MASTER_SPREADSHEET_ID: "abc" }))).toBeInstanceOf(SheetsMasterSource);
    expect(getMasterSource(env({}))).toBeInstanceOf(FileMasterSource);
  });

  it("MASTER_SOURCE manda sobre el valor por defecto", () => {
    expect(
      getMasterSource(env({ MASTER_SOURCE: "file", MASTER_SPREADSHEET_ID: "abc" })),
    ).toBeInstanceOf(FileMasterSource);
    expect(() => getMasterSource(env({ MASTER_SOURCE: "sheets" }))).toThrowError(/MASTER_SPREADSHEET_ID/);
    expect(() => getMasterSource(env({ MASTER_SOURCE: "otro" }))).toThrowError(/MASTER_SOURCE/);
  });
});
