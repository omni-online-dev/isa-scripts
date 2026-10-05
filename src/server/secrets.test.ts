import { describe, expect, it } from "vitest";
import { bearerToken, secretMatches } from "./secrets";

describe("secretMatches", () => {
  it("acepta el secreto correcto, también con espacios alrededor", () => {
    expect(secretMatches("s3creto-de-prueba", "s3creto-de-prueba")).toBe(true);
    expect(secretMatches("  s3creto-de-prueba\n", "s3creto-de-prueba ")).toBe(true);
  });

  it("rechaza un secreto distinto, aunque tenga otra longitud", () => {
    expect(secretMatches("s3creto-de-pruebA", "s3creto-de-prueba")).toBe(false);
    expect(secretMatches("s3creto", "s3creto-de-prueba")).toBe(false);
    expect(secretMatches("s3creto-de-prueba-y-algo-más", "s3creto-de-prueba")).toBe(false);
  });

  it("rechaza siempre si el secreto no está configurado", () => {
    expect(secretMatches("cualquiera", undefined)).toBe(false);
    expect(secretMatches("cualquiera", "")).toBe(false);
    expect(secretMatches("", "")).toBe(false);
    expect(secretMatches("   ", "   ")).toBe(false);
    expect(secretMatches(undefined, undefined)).toBe(false);
  });

  it("rechaza si no llega ningún secreto", () => {
    expect(secretMatches(null, "s3creto-de-prueba")).toBe(false);
    expect(secretMatches("", "s3creto-de-prueba")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extrae el token de la cabecera Authorization", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer   abc123  ")).toBe("abc123");
  });

  it("devuelve null si la cabecera falta o tiene otro formato", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Basic abc123")).toBeNull();
    expect(bearerToken("abc123")).toBeNull();
  });
});
