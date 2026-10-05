/** Minúsculas y sin tildes, para buscar. */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "2026-08-01" → "1 de agosto". */
export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(
    new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1),
  );
}

/** Fecha y hora cortas para "última actualización". */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}
