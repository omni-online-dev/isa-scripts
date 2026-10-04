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
| WP-02 Andamiaje | Hecho |
| WP-03 Esquemas, lista blanca y diccionario de etiquetas | Hecho (pendiente de revisión) |
| WP-01 Provisión de Google Cloud y Firebase | Hecho, salvo App Hosting y Authentication |
| WP-04 en adelante | Pendiente |
