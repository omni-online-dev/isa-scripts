# Roadmap · OmniScripts ISA

| | |
|---|---|
| **Proyecto** | OmniScripts ISA (sucesor de `omni-dental-scripts` / App ISA) |
| **Responsable** | Orlidan Montesdeoca · Especialista en IA |
| **Metodología** | Desarrollo multiagéntico asistido por IA |
| **Plazo** | 3 semanas: 2 de desarrollo + 1 de pruebas (15 días hábiles, D1–D15) |
| **Esfuerzo** | 110 h (100 h + 10 % de reserva) |
| **Versión** | 1.0 · 04/10/2026 |
| **Documento base** | `Viabilidad_Sincronizacion_Master_App_ISA.pdf` v2.0 (PRD, TRD, análisis de la Master) |

Este roadmap convierte la propuesta de viabilidad en un plan ejecutable. Fija los parámetros del proyecto, el stack, la arquitectura, los criterios de UX/UI, la organización de los agentes y los paquetes de trabajo día a día, hasta dejar el sistema listo para publicar.

---

## 1. Parámetros del proyecto

| Parámetro | Valor | Estado |
|---|---|---|
| Nombre en Google Cloud / Firebase | **OmniScripts ISA** | Por crear |
| ID de proyecto (propuesto) | `omniscripts-isa` (si no está libre, Google añade un sufijo) | Por confirmar |
| Repositorio | `omni-online-dev/omniscripts-isa`, **privado**, repositorio nuevo | Por crear |
| Organización de GitHub | `omni-online-dev` (la misma de `omni_voice_new` y `dashomni`) | Existe |
| Alojamiento | **Firebase App Hosting** (como Omni Voice y Omni Dashboard) | Por crear |
| Región | `europe-west4` (la de los proyectos hermanos) | Fijado |
| Base de datos | Cloud Firestore | Por crear |
| Fuente de datos | Master Operativa `(Master) CLIENTES`: pestañas `Activos` y `'Horarios '` | Existe |
| Repositorio actual | `danielvomni/omni-dental-scripts`: queda como **referencia de solo lectura** y se archiva tras el corte | Existe |
| Producción actual | `omni-dental-scripts.vercel.app`: sigue activa hasta el corte (D15) | Existe |

### Cambio respecto al documento de viabilidad

El documento de viabilidad proponía una SPA con Vite, Firebase Hosting clásico y Cloud Functions. Al alinear el stack con Omni Voice y Omni Dashboard, la implementación cambia así. El alcance funcional, el PRD y la estimación **no cambian**.

| Tema | Viabilidad v2.0 | Este roadmap |
|---|---|---|
| Framework | React + Vite (SPA) | **Next.js 16 (App Router)** + React 19 |
| Alojamiento | Firebase Hosting clásico | **Firebase App Hosting** (Cloud Run gestionado) |
| Backend de sincronización | Cloud Functions | **Route handlers de Next** (`/api/sync`, `/api/cron`), como en los proyectos hermanos |
| Despliegue | GitHub Actions → Hosting | **Rollout automático de App Hosting** al hacer push; GitHub Actions solo valida (CI) |
| Repositorio | Transferir el actual | **Repositorio nuevo**; el actual es la referencia funcional |

---

## 2. Stack tecnológico

Se toma como base `dashomni` (el más reciente) y se añaden las primitivas de interfaz de `omni_voice_new`.

| Capa | Tecnología | Referencia |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 estricto | `dashomni` |
| Estilos | Tailwind CSS v4 (`@tailwindcss/postcss`) | `dashomni` |
| Componentes | Primitivas Radix UI + `class-variance-authority` + `clsx` + `tailwind-merge` (patrón shadcn) | `omni_voice_new` |
| Iconos y avisos | `lucide-react`, `sonner` | ambos |
| Tipografía | Inter (variable `--font-inter`) | ambos |
| Validación | Zod (esquema único para parser, API e interfaz) | ambos |
| Datos | Cloud Firestore: SDK web en cliente (tiempo real), `firebase-admin` en servidor | `omni_voice_new` |
| Autenticación | Firebase Authentication + cookie de sesión + `middleware.ts` + lista de usuarios permitidos | ambos |
| Lectura de la Master | `googleapis` (Sheets API v4) con la cuenta de servicio de App Hosting | `dashomni` ya usa `googleapis` |
| Secretos | Google Secret Manager, declarados en `apphosting.yaml` | ambos |
| Tareas programadas | Cloud Scheduler → `/api/cron/*` protegido con secreto | `omni_voice_new` |
| Disparador en la Master | Google Apps Script, versionado con `clasp` | nuevo |
| Tests | Vitest (unidad y paridad), Playwright (E2E), Firebase Emulator (reglas) | `dashomni` usa Vitest |
| Calidad | ESLint 9 + `eslint-config-next`, `tsc --noEmit` | ambos |
| Agentes | Claude Code con `CLAUDE.md`, `AGENTS.md` y la skill de diseño `impeccable` | `omni_voice_new` |

> **Regla heredada de `dashomni/AGENTS.md`:** Next.js 16 tiene cambios incompatibles con versiones anteriores. Todo agente debe leer la guía correspondiente en `node_modules/next/dist/docs/` antes de escribir código.

---

## 3. Arquitectura

```
 Master Operativa (Google Sheets)                      OmniScripts ISA (Firebase App Hosting)
┌──────────────────────────────┐   «sincroniza»   ┌──────────────────────────────────────────────┐
│ Activos      'Horarios '     │ ───────────────► │ POST /api/sync/master      (Apps Script)     │
│ Apps Script: onEdit+debounce │                  │ GET  /api/cron/sync-master (Scheduler 15min) │
│ menú «Publicar ahora»        │ ◄─────────────── │   1 lee (Sheets API, solo lectura)           │
└──────────────────────────────┘   lee la hoja    │   2 parsea Activos + fichas                  │
                                                  │   3 valida (Zod) + informe de calidad        │
                                                  │   4 diff + publicación atómica               │
                                                  └───────────────────┬──────────────────────────┘
                                                                      ▼
                                                  ┌──────────────────────────────────────────────┐
                                                  │ Firestore: clinics · meta · syncRuns ·       │
                                                  │            snapshots · users                 │
                                                  └───────────────────┬──────────────────────────┘
                                                                      ▼ tiempo real (onSnapshot)
                                                  ┌──────────────────────────────────────────────┐
                                                  │ Interfaz (agentes ISA, sesión obligatoria)   │
                                                  │ /  guion  ·  /admin  sincronización y usuarios│
                                                  └──────────────────────────────────────────────┘

 GitHub omni-online-dev/omniscripts-isa ── push a main ──► rollout automático de App Hosting
                                        └─ PR ──► GitHub Actions: lint · tipos · tests · build
```

### Estructura del repositorio

```
omniscripts-isa/
├─ src/
│  ├─ app/
│  │  ├─ (app)/                 Interfaz del agente (guion) y layout con sesión
│  │  ├─ admin/                 Sincronización, informe de calidad, usuarios
│  │  ├─ login/
│  │  └─ api/
│  │     ├─ sync/master/        Disparo desde Apps Script
│  │     ├─ cron/sync-master/   Conciliación programada
│  │     ├─ admin/              Rollback, forzar sincronización, usuarios
│  │     └─ auth/               Cookie de sesión
│  ├─ core/                     Lógica pura, sin dependencias de Next ni Firebase
│  │  ├─ schema/                Esquemas Zod y tipos
│  │  ├─ master/                Parser de Activos, parser de fichas, lista blanca, diccionario
│  │  └─ scripts/               Motor de guiones y plantillas por tratamiento
│  ├─ server/                   Sheets, Firestore admin, servicio de sincronización, auth
│  ├─ components/ui/            Primitivas (button, card, badge, tabs, select, dialog…)
│  ├─ components/script/        Selector, buscador, pasos del guion, ficha, horarios, negativas
│  ├─ hooks/  lib/
│  └─ middleware.ts
├─ apps-script/                 Trigger de la Master (clasp)
├─ fixtures/                    Fichas anonimizadas + salida de referencia de la app actual
├─ tests/                       unit · parity · rules · e2e
├─ firestore.rules  firestore.indexes.json  firebase.json  apphosting.yaml
├─ .github/workflows/ci.yml
├─ CLAUDE.md  AGENTS.md  PRODUCT.md  UI_DESIGN.md
└─ docs/                        Runbook, guía para editores de la Master, decisiones (ADR)
```

`src/core` no importa nada de Next ni de Firebase. Así el parser y el motor de guiones se prueban de forma aislada y los agentes pueden trabajar en ellos en paralelo sin tocar la interfaz.

---

## 4. Qué se aprovecha del repositorio actual

El repositorio actual es la **especificación funcional viva**: define qué ve y qué dice el agente. Se porta la lógica; no se copia el código.

| Origen (`omni-dental-scripts`) | Destino (`omniscripts-isa`) | Tratamiento |
|---|---|---|
| `scripts.js`: plantillas por tratamiento y variantes (simplificado, estricto, reprogramación, recontacto) | `src/core/scripts/templates/*.ts` | Portar a TypeScript y separar el texto de la lógica |
| `app.js`: `getScriptKey`, `shouldEconQualify`, `renderScript`, `formatClinicLocation`, `stripPostalCode` | `src/core/scripts/engine.ts` | Portar como funciones puras con tests |
| `app.js`: `extractSegmentedPromo` y las reglas de promoción por tratamiento | `src/core/master/` (parser) | Se resuelve **al sincronizar**, no en el navegador |
| `app.js`: horarios, sedes y datos operativos | `src/components/script/` | Rediseñar como componentes |
| `index.html` + `app.js`: buscador, selector, ficha lateral, negativas, «Copiar todo» | `src/components/script/` | Rediseñar con paridad funcional |
| `style.css`: identidad OMNI Dental | `UI_DESIGN.md` + tokens de Tailwind | Unificar con los tokens de Omni Dashboard |
| `clinics-data*.js`, `clinic-schedules.js` (38 clínicas) | `fixtures/reference/` | Solo como **referencia de paridad**; los datos reales vienen de la Master |
| `*_IMPORTANTE.txt` | `docs/` | Reglas de negocio ya acordadas (promociones y puntos de valor por tratamiento) |
| Clave SHA-256 en cliente, `script.js`, `clinics.json` | — | Se descartan |

---

## 5. Principios de UX/UI

El usuario es un agente **en una llamada en vivo**. La interfaz debe leerse en un vistazo y no exigir más de dos acciones para llegar al guion.

### Principios

1. **El guion es el protagonista.** Ocupa la columna principal, con tipografía grande y los datos variables resaltados. Todo lo demás es apoyo.
2. **Dos acciones hasta el guion.** Buscar la clínica (con el teclado) y elegir el tratamiento. Si la clínica tiene un solo tratamiento, se elige solo.
3. **Jerarquía por pasos.** Cada bloque del guion es un paso numerado con su nota y su respuesta a la objeción, plegable.
4. **Estado siempre visible.** Fecha de la última actualización, aviso «Datos actualizados» y avisos de clínica en pausa o de vacaciones.
5. **Nada bloquea al agente.** Si falla la red, se usa la última versión guardada y se indica. Si falta un dato, se muestra «Sin dato» en lugar de un hueco.
6. **Consistencia con la familia Omni.** Mismos tokens que Omni Dashboard: Inter, escala slate, acento cyan/teal, tarjetas `rounded-xl` con borde suave.
7. **Accesibilidad.** Contraste AA, navegación completa por teclado, foco visible, objetivos táctiles de 40 px o más y respeto a `prefers-reduced-motion`.
8. **Texto de interfaz claro.** Etiquetas en lenguaje del agente, sin jerga técnica y con el mismo nombre para la misma cosa en toda la app.

### Pantallas

| Pantalla | Contenido |
|---|---|
| **Guion** (`/`) | Barra superior con buscador de clínica (atajo `/` o `Ctrl+K`), selector de tratamiento y «Copiar todo». Columna principal con los pasos del guion. Panel lateral con dirección, referencia, oferta, documentación, financiación, ayudas, seguros, WhatsApp, recordatorio, agendamiento y horarios por sede. Panel de negativas. |
| **Estado vacío** | Buscador centrado, clínicas recientes y número de clínicas activas. |
| **Inicio de sesión** (`/login`) | Acceso con Google o con email y contraseña. |
| **Administración** (`/admin`) | Última sincronización, informe de calidad por ficha, «Forzar sincronización», historial y restauración, usuarios y roles. |

### Tokens de diseño (base Omni Dashboard)

| Elemento | Valor |
|---|---|
| Tipografía | Inter; `tabular-nums` en horarios y cifras |
| Fondo de página / tarjeta | `slate-50` / blanco con `border-slate-100`, `rounded-xl`, `shadow-sm` |
| Texto principal / secundario | `slate-900` / `slate-500` |
| Acento y acción primaria | `cyan-600` (hover `cyan-700`); barra superior con degradado cyan → teal |
| Estados | Éxito `emerald`, aviso `amber`, error `red`, informativo `cyan` |
| Datos variables del guion | Negrita con fondo `cyan-50` |

El detalle se documenta en `UI_DESIGN.md` del nuevo repositorio. Antes de dar por cerrada la interfaz se pasa la revisión de la skill `impeccable`, como en Omni Voice.

---

## 6. Metodología multiagéntica

Un **orquestador humano** (Orlidan) dirige a varios agentes especializados que trabajan en paralelo. Cada agente recibe un paquete de trabajo acotado, con contrato de entrada y salida, y entrega un PR con tests.

### Agentes y responsabilidades

| Agente | Responsabilidad | Carpetas que toca |
|---|---|---|
| **Orquestador** (humano + sesión principal) | Descompone, asigna, integra, decide y aprueba | Todo (solo revisión y merge) |
| **Arquitecto** | Esquemas Zod, contratos entre módulos, ADR, `CLAUDE.md` | `src/core/schema`, `docs/` |
| **Datos** | Parser de `Activos` y de fichas, lista blanca, diccionario, informe de calidad | `src/core/master`, `fixtures/` |
| **Motor** | Motor de guiones y plantillas portadas del repositorio actual | `src/core/scripts` |
| **Backend** | Lectura de Sheets, servicio de sincronización, rutas API, reglas de Firestore | `src/server`, `src/app/api`, `firestore.rules` |
| **Interfaz** | Primitivas, pantallas, estados, accesibilidad | `src/components`, `src/app/(app)`, `src/app/admin` |
| **QA** | Tests de paridad, de reglas y E2E; escenarios de sincronización | `tests/` |
| **Revisor** | Revisión de cada PR: seguridad, lista blanca, calidad y simplicidad | Solo lectura |
| **Diseño** (`impeccable`) | Crítica y pulido de la interfaz | `src/components` |

### Reglas de trabajo

1. **Contrato primero.** Ningún agente empieza sin el esquema Zod y las interfaces de `src/core/schema` aprobados (D2).
2. **Un paquete, una rama, un PR.** Cada agente trabaja en su `worktree`. Los paquetes no comparten archivos, salvo `src/core/schema`, que solo cambia el Arquitecto.
3. **Los tests son el oráculo.** Fixtures de las 53 fichas y salida de referencia de las 38 clínicas actuales. Un PR sin tests en verde no se revisa.
4. **Doble revisión.** Primero el agente Revisor y después el orquestador humano. Las decisiones de seguridad y de lista blanca son siempre humanas.
5. **Datos protegidos.** Los agentes solo ven fixtures anonimizadas. No acceden a la Master real ni a credenciales de producción.
6. **Integración continua.** Se fusiona a `main` varias veces al día. Las ramas no viven más de un día.
7. **Trazabilidad.** Cada PR enlaza su paquete (WP-xx) y deja constancia de las decisiones en `docs/adr/`.

### Definición de hecho (por paquete)

- Cumple los criterios de aceptación del paquete.
- `lint`, `typecheck`, tests y `build` en verde.
- Sin secretos, sin datos reales y sin campos fuera de la lista blanca.
- Revisado por el agente Revisor y aprobado por el orquestador.
- Documentación actualizada si cambia un contrato o una regla de negocio.

---

## 7. Roadmap

Leyenda: **∥** = se ejecuta en paralelo con los paquetes del mismo día. Las horas son de dedicación del especialista.

### Fase 0 · Arranque (antes de D1) — requisitos previos

| # | Tarea | Responsable |
|---|---|---|
| P-1 | Aprobar el roadmap y las decisiones de la sección 11 | Dirección |
| P-2 | Crear el proyecto **OmniScripts ISA** y vincular la cuenta de facturación (plan Blaze) | Soporte |
| P-3 | Crear el repositorio privado `omni-online-dev/omniscripts-isa` | Soporte |
| P-4 | Crear una **copia de pruebas** de la Master solo con `Activos` y `'Horarios '` | Operaciones |
| P-5 | Designar al propietario de la Master que instalará el disparador y compartirá la hoja | Operaciones |

### Semana 1 · Base, datos y sincronización (D1–D5 · 41 h)

| Día | WP | Paquete | Agente | Entregable | h |
|---|---|---|---|---|---|
| D1 | WP-01 | Provisión: Firebase (Firestore, Auth, App Hosting), secretos, cuenta de servicio, protección de `main` | Orquestador | Proyecto y backend creados (sección 8) | 3 |
| D1 | WP-02 ∥ | Andamiaje: Next 16, Tailwind 4, ESLint, Vitest, `apphosting.yaml`, CI, `CLAUDE.md`, `AGENTS.md` | Arquitecto | «Hola mundo» desplegado por rollout automático | 2 |
| D1–D2 | WP-03 | Especificación ejecutable: esquemas Zod, lista blanca, diccionario de etiquetas, contratos | Arquitecto | `src/core/schema` aprobado | 5 |
| D1–D2 | WP-04 ∥ | Fixtures: 53 fichas anonimizadas y salida de referencia de las 38 clínicas actuales | Datos + QA | `fixtures/` con tests que fallan (rojo) | 3 |
| D2–D4 | WP-05 | Parser de `Activos`: por cabecera, tolerante a columnas nuevas, estados y fechas | Datos | Tests en verde con la copia de la Master | 4 |
| D2–D4 | WP-06 ∥ | Parser de fichas: secciones, tratamientos, sedes, horarios, promociones | Datos | ≥ 95 % de fichas sin errores | 10 |
| D2–D4 | WP-07 ∥ | Motor de guiones: plantillas y variantes portadas | Motor | Paridad con las 38 clínicas | 4 |
| D4–D5 | WP-08 | Servicio de sincronización: lectura con hipervínculos, validación, diff, publicación atómica, historial | Backend | `/api/sync/master` operativo en staging | 6 |
| D5 | WP-09 ∥ | Disparadores: Apps Script (filtrado por pestaña, debounce, «Publicar ahora») y Cloud Scheduler | Backend | Edición en la copia → Firestore en ≤ 2 min | 4 |

**Hito H1 (fin de D5):** la copia de la Master sincroniza con Firestore en staging y se entrega a Operaciones el **informe de calidad de las 53 fichas**.

### Semana 2 · Aplicación y seguridad (D6–D10 · 34 h)

| Día | WP | Paquete | Agente | Entregable | h |
|---|---|---|---|---|---|
| D6 | WP-10 | Sistema de diseño: tokens, primitivas `ui/`, layout, `UI_DESIGN.md` | Interfaz + Diseño | Primitivas listas | 4 |
| D6–D7 | WP-11 ∥ | Autenticación: Firebase Auth, cookie de sesión, `middleware`, usuarios permitidos, roles | Backend | Acceso solo con sesión | 4 |
| D6–D7 | WP-12 ∥ | Reglas de Firestore y sus tests con el emulador | Backend + QA | Sin lectura anónima (test) | 3 |
| D7–D9 | WP-13 | Pantalla de guion: buscador, selector, pasos, variantes, «Copiar todo», negativas | Interfaz | Paridad funcional | 8 |
| D7–D9 | WP-14 ∥ | Panel lateral: ficha, horarios por sede, avisos de pausa y vacaciones | Interfaz | Datos en tiempo real | 4 |
| D8–D9 | WP-15 ∥ | Tiempo real, aviso «Datos actualizados», modo sin conexión, estados de carga y error | Interfaz | Funciona sin red | 2 |
| D9–D10 | WP-16 | Administración: estado de sincronización, informe de calidad, forzar, restaurar, usuarios | Interfaz + Backend | `/admin` operativo | 4 |
| D10 | WP-17 | Migración y conciliación: clínicas actuales frente a la Master, incorporación de las que faltan | Datos | Todas las clínicas activas con ficha, visibles | 3 |
| D10 | WP-18 ∥ | Revisión de diseño (`impeccable`) y accesibilidad | Diseño | Incidencias corregidas | 2 |

**Hito H2 (fin de D10):** código congelado. Aplicación completa en staging, con paridad, acceso autenticado y CI en verde.

### Semana 3 · Pruebas y puesta en producción (D11–D15 · 25 h)

| Día | WP | Paquete | Agente | Entregable | h |
|---|---|---|---|---|---|
| D11–D12 | WP-19 | QA automatizada: paridad completa, reglas, E2E del flujo del agente | QA | Informe de pruebas | 5 |
| D11–D12 | WP-20 ∥ | Escenarios de sincronización: alta y baja de clínica, columna nueva, ficha mal formada, restauración | QA + Backend | Escenarios superados | 5 |
| D11–D14 | WP-21 | UAT con agentes piloto, en paralelo con la app actual | Orquestador | Incidencias registradas | 5 |
| D13–D14 | WP-22 | Corrección de incidencias y auditoría de seguridad final | Todos + Revisor | Sin incidencias graves | 5 |
| D14 | WP-23 | Documentación: runbook, guía para editores de la Master, `PRODUCT.md` | Arquitecto | `docs/` completo | 2 |
| D15 | WP-24 | Puesta en producción: Master real, dominio, corte, redirección desde Vercel, formación | Orquestador | Producción en Firebase | 3 |

**Hito H3 (fin de D15):** OmniScripts ISA en producción, Vercel retirado y repositorio antiguo archivado.

### Vista general

```
              D1  D2  D3  D4  D5 │ D6  D7  D8  D9  D10 │ D11 D12 D13 D14 D15
Provisión     ██                 │                     │
Especificación██  ██             │                     │
Parsers           ██  ██  ██     │                     │
Motor guiones     ██  ██  ██     │                     │
Sincronización            ██  ██ │                     │
Diseño + Auth                    │ ██  ██              │
Interfaz                         │     ██  ██  ██      │
Administración                   │             ██  ██  │
QA + escenarios                  │                     │ ██  ██
UAT + correcciones               │                     │ ██  ██  ██  ██
Producción                       │                     │                 ██
Hitos                         H1 │                 H2  │                 H3
```

> Si el arranque es el lunes 05/10/2026, el 12/10 (Fiesta Nacional en España) cae en D6. Habrá que desplazar un día el calendario o absorberlo con la reserva.

---

## 8. Provisión del proyecto «OmniScripts ISA»

Lista de comprobación para WP-01. Los nombres entre `< >` se confirman al ejecutar.

**Google Cloud / Firebase**

- [ ] Crear el proyecto con nombre visible **OmniScripts ISA** e ID `omniscripts-isa`.
- [ ] Vincular la cuenta de facturación de Omni (plan Blaze) y crear una alerta de presupuesto de 10 €/mes.
- [ ] Activar las API: Firestore, Firebase App Hosting, Identity Toolkit, Google Sheets, Secret Manager, Cloud Scheduler, Cloud Build, Cloud Run.
- [ ] Crear Firestore en modo nativo, región `europe-west4`.
- [ ] Activar Authentication con los proveedores acordados (Google y/o email y contraseña).
- [ ] Crear el backend de App Hosting `omniscripts-isa` en `europe-west4`, conectado al repositorio y a la rama `main`, con rollout automático.
- [ ] Crear el backend `omniscripts-isa-staging` conectado a la rama `develop`, con un espacio de datos separado.
- [ ] Crear los secretos `SYNC_SECRET` y `CRON_SECRET` y dar acceso al backend.
- [ ] Declarar las variables en `apphosting.yaml`: `NEXT_PUBLIC_FIREBASE_*`, `MASTER_SPREADSHEET_ID`, `ADMIN_EMAILS`, `DATA_NAMESPACE`.
- [ ] Compartir la Master con la cuenta de servicio del backend, con rol **Lector**.
- [ ] Crear el trabajo de Cloud Scheduler `sync-master` cada 15 minutos, zona `Europe/Madrid`, con el secreto en **cabecera** (no en la URL).

**GitHub**

- [ ] Crear `omni-online-dev/omniscripts-isa` como privado.
- [ ] Proteger `main`: PR obligatorio, una aprobación y CI en verde.
- [ ] Instalar la aplicación de GitHub de Firebase App Hosting en el repositorio.
- [ ] Añadir el workflow `ci.yml`.

**Master**

- [ ] Instalar el Apps Script con el menú «App ISA → Publicar ahora» y el disparador de edición.
- [ ] Guardar `SYNC_SECRET` y la URL del backend en las propiedades del script.
- [ ] Renombrar la pestaña heredada `'Horarios'` (sin espacio final).

---

## 9. CI/CD

| Evento | Qué ocurre | Resultado |
|---|---|---|
| PR hacia `develop` o `main` | GitHub Actions: `lint` → `typecheck` → tests de unidad y paridad → tests de reglas (emulador) → `build` | El PR no se puede fusionar si falla |
| Push a `develop` | Rollout automático en `omniscripts-isa-staging` | Staging actualizado en minutos |
| Push a `main` | Rollout automático en `omniscripts-isa` | Producción actualizada en minutos |
| Edición en la Master | Apps Script → `/api/sync/master` → parser → validación → Firestore | Agentes actualizados en 1–2 min, sin despliegue |
| Fallo de sincronización | No se publica; aviso al editor y a Soporte | Producción conserva la última versión válida |

Buenas prácticas que se aplican desde D1: commits pequeños y descriptivos, ramas de vida corta, sin secretos en el repositorio (`.env.local` ignorado y `.env.example` documentado), dependencias fijadas con `package-lock.json` y TypeScript en modo estricto.

---

## 10. Criterios de «listo para publicar»

- [ ] Todas las clínicas con `Estado` activo y ficha aparecen en la app.
- [ ] Las 38 clínicas actuales generan el mismo guion que hoy, salvo las correcciones documentadas.
- [ ] Un cambio en la Master llega a la app abierta en ≤ 2 minutos, sin recargar.
- [ ] Una columna nueva en `Activos` no altera la app y queda registrada.
- [ ] Ningún documento de Firestore es legible sin sesión (test de reglas).
- [ ] Ningún campo fuera de la lista blanca se publica (test automático).
- [ ] La restauración de una versión anterior funciona.
- [ ] CI en verde y rollout automático verificado en staging y en producción.
- [ ] UAT aprobada por los agentes piloto y por Operaciones.
- [ ] Runbook y guía para editores entregados.
- [ ] Alerta de presupuesto y alertas de sincronización activas.

---

## 11. Decisiones pendientes

| # | Decisión | Necesaria antes de |
|---|---|---|
| 1 | Aprobación del roadmap y fecha de arranque | D1 |
| 2 | Cuenta de facturación para el proyecto y quién lo crea | D1 |
| 3 | Estados visibles: si «Pausa Temporal», «Presupuesto Agotado» y «Pago Error» ocultan la clínica o muestran un aviso | D2 |
| 4 | Equivalencia de variantes de guion: «Selectivo» de la Master frente a «estricto» de la app, y los guiones propios (p. ej. «Script Adeje») | D2 |
| 5 | Propietario de la Master que instala el disparador | D5 |
| 6 | Método de acceso de los agentes: Google corporativo o email y contraseña | D6 |
| 7 | Dominio de la app (subdominio corporativo o el de App Hosting) | D14 |

---

## 12. Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Variaciones de formato en las fichas | Diccionario de sinónimos, tests con las 53 fichas e informe de calidad desde H1 para que Operaciones corrija en paralelo |
| Publicación de datos sensibles de la Master | Lista blanca en el código, test automático y revisión humana obligatoria |
| Plazo comprimido | Paquetes pequeños en paralelo, hitos semanales y reserva del 10 %. Si se tensa, se pospone la interfaz de restauración y parte del panel de administración, nunca las pruebas |
| Conflictos entre agentes en paralelo | Carpetas separadas por agente, contrato único en `src/core/schema` e integración diaria |
| Cambios incompatibles de Next.js 16 | Regla en `AGENTS.md` y andamiaje copiado de `dashomni` |
| Retraso en la provisión o en los permisos | Fase 0 con responsables asignados. Sin P-2 a P-5 completos no arranca D1 |

---

## 13. Después del lanzamiento (fase 2)

- Guiones editables desde la Master (pestaña `Guiones`).
- Métricas de uso por agente y por clínica.
- Integración con Omni Dashboard (enlace a la ficha de la clínica) y con Omni Voice (misma fuente de datos de clínicas).
- Evaluar si las fichas de `'Horarios '` deben pasar a un formato tabular cuando Operaciones lo vea conveniente.
