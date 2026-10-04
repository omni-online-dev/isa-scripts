/**
 * Master ficticia para los tests. Reproduce la ESTRUCTURA y las variantes de formato
 * de la Master real, con clínicas, direcciones y condiciones inventadas.
 * No contiene ningún dato real.
 */
import type { MasterInput, SheetData } from "@/core/master";

type Row = [a?: string, b?: string, c?: string, d?: string, e?: string];

/** Fichas en orden. Cada una empieza en la fila que indica `anchors`. */
const FICHAS: Record<string, Row[]> = {
  // Un tratamiento, formato canónico.
  norte: [
    ["Clínica Dental Norte"],
    ["", "", "Implantes"],
    ["Dirección: Calle del Río, 10, 28001 Madrid (frente a la estación)", "Lunes y Miércoles", "10:00 a 19:30", "30min", "nota interna que no se publica"],
    ["Puntos de valor: más de 20 años de experiencia y carga inmediata", "Viernes", "10:00 a 13:30", "30min"],
    ["Script Simplificado"],
    ["Criterios de financiación"],
    ["DNI: Nómina, Jubilados, Autónomos"],
    ["Financiación: hasta 60 meses sin intereses"],
    [],
    ["Ayuda: No reciben pacientes con ayudas"],
    ["Seguros: no aceptan seguros"],
    ["Recordatorio: SI"],
    ["WhatsApp: Subcuenta \"WhatsApp\""],
    ["Agendamiento el mismo día: NO"],
    ["Agendamiento a largo plazo(+ de 72 horas de antelación): SI"],
    [],
    ["PROMOCIÓN"],
    ["Descuento: 20%"],
    [],
    ["CRITERIOS PARA FORMULARIO MB:"],
    ["ZONA, DNI + Nómina"],
  ],
  // Varios tratamientos: criterios, promociones, puntos de valor y agendamiento por tratamiento.
  sur: [
    ["Clínica Dental Sur"],
    ["", "", "Implantes y Blanqueamiento"],
    ["Dirección: Av. del Mar, 34, 11010 Cádiz (cerca del estadio)", "Lunes", "10:00 a 13:00", "30min"],
    ["Puntos de valor (implantes): carga inmediata y sedación", "Martes", "10:30 a 13:00 / 16:00 a 19:00", "30min"],
    ["Script Simplificado Implantes y Ortodoncia"],
    ["Script Selectivo Blanqueamiento"],
    ["Criterios de financiación Implantes", "", "Ortodoncia"],
    ["DNI: Nómina, Jubilados", "Miercoles y Jueves", "10:00 a 13:30", "30min"],
    ["NIE: Nómina"],
    ["Pasaporte: Cuenta bancaria"],
    ["Criterios de financiación Ortodoncia y Blanqueamiento"],
    ["No cualificamos económicamente, solo confirmar documentación"],
    [],
    ["Ayuda: Podemos citar ayudas con DNI"],
    ["Seguros: Se aceptan dos aseguradoras"],
    ["Recordatorio: SI"],
    ["Whatsapp: Subcuenta \"Sur\""],
    ["Agendamiento el mismo día: SI"],
    ["Agendamiento a largo plazo Implantes y Blanqueamiento (+ de 72 horas de antelación): NO"],
    ["Agendamiento a largo plazo Ortodoncia (+ de 72 horas de antelación): SI"],
    [],
    ["PROMOCIÓN"],
    ["Implantes:"],
    ["Descuento: 30%"],
    ["Implante + Corona: desde 900€"],
    ["Financiación: a 48 meses"],
    ["Ortodoncia:"],
    ["Descuento: 25%"],
    ["Blanqueamiento:"],
    ["Blanqueamiento + 2 jeringas: 99€."],
    [],
    ["CRITERIOS PARA FORMULARIO MB:"],
    ["Implantes"],
    ["ZONA, DNI/NIE"],
  ],
  // Cabecera de tratamiento en la misma fila del nombre.
  centro: [
    ["Instituto Dental Centro", "", "Implantes"],
    ["", "Martes y Jueves", "10:00 a 13:30 / 16:00 a 19:30", "30min"],
    ["Dirección: Vía Principal, 70, 28805 Alcalá"],
    ["Puntos de valor: 8 años abierta"],
    ["Recordatorio: SI"],
    ["PROMOCIÓN"],
    ["Descuento: 20%"],
  ],
  // Varias sedes con horario propio.
  islas: [
    ["Dr. Ejemplo ı Dental Islas"],
    ["", "", "Implantes"],
    [],
    ["Dirección Los Pinos: Calle Uno 1, Local 5", "", "Los Pinos"],
    ["", "Lunes", "10:00 a 13:00 / 15:00 a 17:30", "30min"],
    [],
    ["Dirección La Vega: Calle Dos, 58 (junto al mercado)", "", "La Vega"],
    ["", "Martes y Miércoles", "10:00 a 17:00", "30min"],
    ["", "Jueves", "09:00 a 17:00", "30min"],
    [],
    ["Puntos de valor: implantólogos con años de experiencia"],
    ["Script Selectivo Implantes"],
    ["Criterios de financiación"],
    ["DNI: Nómina"],
    ["Financiación: hasta 24 meses sin intereses"],
    ["Recordatorio: SI. Revisar plataforma antes"],
    ["PROMOCIÓN"],
    ["Implantes:"],
    ["Descuento: 10%"],
    ["Información para el MB: carga inmediata"],
    ["CRITERIOS PARA FORMULARIO MB:"],
    ["SOLO ZONA"],
  ],
  // Sin tabla de horarios ("Leer Nota") y sin cabecera de tratamiento.
  plaza: [
    ["Clínicas Plaza ı Centro Comercial"],
    ["Dirección: (Huelva) - Centro Comercial Plaza, Ronda Exterior", "", "Leer Nota"],
    ["Puntos de valor: año y medio abierta"],
    ["Script Simplificado"],
    ["Criterios de financiación"],
    ["No cualificamos, solo preguntar si poseen documentación"],
    ["Recordatorio: SI"],
    ["PROMOCIÓN"],
    ["Higiene dental gratis."],
  ],
  // Cabecera de tratamiento en la fila de la dirección, grupos de horario y una línea suelta.
  oeste: [
    ["Clínica Oeste"],
    [],
    ["Dirección: Calle Libre 46, 28801 Alcalá", "", "Implantes -Pacientes con DNI"],
    ["Puntos de valor:", "Lunes a Jueves", "10:00 a 13:00 / 16:00 a 19:00", "60min"],
    ["Script Selectivo (+ASNEF)", "", "Implantes - Pacientes portugueses"],
    ["Horario especial en agosto", "Viernes", "10:00 a 13:00", "60min"],
    ["Criterios de financiación", "", "Ortodoncia"],
    ["DNI: Nómina superior al SMI", "Lunes", "10:00 a 13:45", "60min"],
    ["Recordatorio: NO"],
  ],
  // Ficha cuya fila de Activos no se puede usar, pegada a la anterior: no debe absorberse.
  huerfana: [
    ["Clínica Sin Enlace"],
    ["", "", "Implantes"],
    ["Dirección: Calle Perdida 1", "Sábado", "09:00 a 14:00", "30min"],
  ],
  // Ficha sin dirección.
  rota: [["Clínica Sin Dirección"], ["", "", "Implantes"], ["Puntos de valor: algo"], ["Recordatorio: SI"]],
};

const GAP = 3; // filas en blanco entre fichas
const fichaRows: string[][] = [["", "Dias ", "Horario ", "Duracion de la cita", "Notas"]];
export const anchors: Record<string, number> = {};
for (const [key, rows] of Object.entries(FICHAS)) {
  anchors[key] = fichaRows.length + 1;
  for (const row of rows) fichaRows.push([0, 1, 2, 3, 4].map((i) => row[i] ?? ""));
  for (let i = 0; i < GAP; i++) fichaRows.push(["", "", "", "", ""]);
}

const link = (key: string) => `#gid=111&range=A${anchors[key]}`;

/** Activos con las columnas desordenadas y una columna nueva, como pasará en la realidad. */
const ACTIVOS_HEADER = [
  "Clínica - Tratamiento",
  "Link a Horarios",
  "IA Status",
  "IA Voz Francés", // columna nueva, no conocida
  "Estado",
  "Presup.",
  "Fecha inicio de vacaciones",
  "Fecha de finalización de las vacaciones",
  "Fecha de pausa de ISA/IA",
  "Fecha de reactivación de ISA/IA",
];

type ActivosRow = [name: string, fichaKey: string | null, estado: string, rest?: string[]];
const ACTIVOS: ActivosRow[] = [
  ["Clínica Dental Norte - Implantes", "norte", "Activa", ["46235", "46250", "", ""]],
  ["Clínica Dental Sur - Implantes", "sur", "Activa"],
  ["Clínica Dental Sur - Ortodoncia", "sur", "Pausa Temporal", ["", "", "46233", "46247"]],
  ["Instituto Dental Centro - Implantes Meta", "centro", "Activa"],
  ["Instituto Dental Centro - Implantes Google", "centro", "Presupuesto Agotado"],
  ["Dr. Ejemplo - Dental Islas - Implantes", "islas", "Activa"],
  ["Clínicas Plaza - Implantes", "plaza", "Activa"],
  ["Clínica Oeste - Implantes", "oeste", "Activa"],
  ["Clínica Oeste - Ortodoncia", "oeste", "Activa"],
  ["Clínica Sin Dirección - Implantes", "rota", "Activa"],
  ["Grupo Láser - Láser Corporal", null, "Activa"],
  ["Clínica Sin Ficha - Implantes", null, "Activa"],
  ["EN PROCESO DE ONBOARDING", null, ""],
  ["Clínica Sin Enlace", "huerfana", "Activa"], // tiene ficha, pero el nombre no lleva tratamiento
];

const activosValues: string[][] = [ACTIVOS_HEADER];
const activosLinks: (string | null)[][] = [ACTIVOS_HEADER.map(() => null)];
for (const [name, key, estado, rest = ["", "", "", ""]] of ACTIVOS) {
  activosValues.push([name, key ? "Hoja Horarios" : "", "Activa", "", estado, "1000", ...rest]);
  activosLinks.push([null, key ? link(key) : null, ...Array(8).fill(null)]);
}

export const activosSheet: SheetData = { values: activosValues, hyperlinks: activosLinks };
export const fichasSheet: SheetData = { values: fichaRows };
export const masterFixture: MasterInput = { activos: activosSheet, fichas: fichasSheet };
