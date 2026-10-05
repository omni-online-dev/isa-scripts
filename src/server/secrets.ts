import { createHash, timingSafeEqual } from "crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Compara un secreto recibido con el configurado, en tiempo constante.
 * Se recortan los espacios de ambos. Si el secreto no está configurado, nadie pasa.
 */
export function secretMatches(
  received: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  const want = expected?.trim() ?? "";
  const got = received?.trim() ?? "";
  if (!want || !got) return false;
  // Se comparan las huellas: misma longitud siempre, sin revelar la del secreto.
  return timingSafeEqual(digest(got), digest(want));
}

/** Extrae el token de una cabecera `Authorization: Bearer <token>`. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S.*)$/i.exec(header?.trim() ?? "");
  return match?.[1]?.trim() ?? null;
}
