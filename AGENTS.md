<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reglas para agentes de OmniScripts ISA

## Contexto

Herramienta interna de Omni Dental. Los agentes del call center (ISA) la usan en llamadas en vivo para leer el guion y los datos de cada clínica. Los datos salen de la Master Operativa (Google Sheets) y se sincronizan solos; nadie los edita en la app. Plan completo en `docs/ROADMAP.md`.

## Arquitectura en una frase

`Master → /api/sync → src/core/master (parser) → Zod → Firestore → interfaz en tiempo real`.

## Fronteras entre carpetas

| Carpeta | Contenido | Puede importar |
|---|---|---|
| `src/core/schema` | Esquemas Zod y tipos. **Contrato único.** | solo `zod` |
| `src/core/master` | Parser de la Master, lista blanca, diccionario | `core/schema` |
| `src/core/scripts` | Motor de guiones y plantillas | `core/schema` |
| `src/server` | Sheets API, Firestore admin, sincronización, auth | `core/*` |
| `src/app/api` | Route handlers | `server/*`, `core/*` |
| `src/components`, `src/app` | Interfaz | `core/schema`, `core/scripts`, `lib/*` |

`src/core` es lógica pura: no importa Next, React ni Firebase (lo comprueba ESLint).

## Reglas

1. **Contrato primero.** Los cambios en `src/core/schema` van en su propio PR y solo los hace el agente Arquitecto.
2. **Lista blanca.** Solo se publican las columnas de `ACTIVOS_COLUMNS` y los campos de `ClinicSchema`. Añadir uno es una decisión de seguridad y la aprueba una persona.
3. **Datos reales fuera del repositorio.** Nada de `.xlsx`, volcados de la Master, presupuestos, notas ni credenciales. Los tests usan fixtures anonimizadas de `fixtures/`.
4. **Columnas por nombre.** Nunca se lee `Activos` por posición.
5. **El parser no lanza excepciones por datos mal escritos.** Devuelve incidencias (`SyncIssue`) con un mensaje que entienda quien edita la Master.
6. **Tests junto al código** (`*.test.ts`). Un PR sin tests en verde no se revisa.
7. **Un paquete, una rama, un PR.** Referencia el paquete del roadmap (WP-xx) en el título.
8. **Textos de interfaz en español**, en el lenguaje del agente y sin jerga técnica.

## Comandos

```bash
npm run dev        # servidor local
npm run check      # lint + tipos + tests (obligatorio antes de abrir un PR)
npm run build      # compilación de producción
```

## Definición de hecho

- Cumple los criterios de aceptación del paquete.
- `npm run check` y `npm run build` en verde.
- Sin secretos, sin datos reales, sin campos fuera de la lista blanca.
- Documentación actualizada si cambia un contrato o una regla de negocio (`docs/adr/`).
