# OmniScripts ISA

Guiones de llamada para clínicas dentales, sincronizados con la Master Operativa. Herramienta interna de Omni Dental; sucede a `omni-dental-scripts`.

- **Plan:** [docs/ROADMAP.md](docs/ROADMAP.md)
- **Reglas de desarrollo:** [AGENTS.md](AGENTS.md)
- **Decisiones:** [docs/adr/](docs/adr/)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zod · Firestore · Firebase App Hosting · Vitest.

## Desarrollo

```bash
npm install
cp .env.example .env.local
npm run dev
```

```bash
npm run check   # lint + tipos + tests
npm run build
```

## Estado

| Paquete | Estado |
|---|---|
| WP-01 Provisión de Google Cloud y Firebase | Hecho, salvo App Hosting, Authentication y compartir la Master |
| WP-02 Andamiaje · WP-03 Contratos | Hecho |
| WP-04 Fixtures · WP-05 Parser de Activos · WP-06 Parser de fichas | Hecho |
| WP-07 Motor de guiones | Hecho |
| WP-08 Sincronización · WP-09 Disparadores | Hecho en código; sin probar contra Sheets y Firestore reales |
| WP-10 Diseño · WP-13 Guion · WP-14 Ficha · WP-15 Tiempo real | Hecho; probado en modo local |
| WP-11 Autenticación · WP-12 Reglas | Hecho en código y reglas publicadas; faltan los tests con emulador |
| WP-16 Administración | Hecho; probado en modo local |
| WP-17 a WP-24 (conciliación, QA, UAT, producción) | Pendiente |

## Modo local

Sin variables de Firebase en `.env.local`, la app no pide sesión y lee los datos de
`fixtures/private/master.json` (volcado de la Master real, ignorado por git) o, si no existe,
de `fixtures/demo-master.json` (Master ficticia).
