# Sincronización con la Master

La app lee la Master Operativa (Google Sheets) y publica las clínicas en Firestore. La Master **no admite scripts** (ver [ADR 0003](adr/0003-sin-scripts-en-la-master.md)), así que es la app la que vigila la hoja; dentro de la hoja no se instala nada.

## Cómo funciona

```
Cloud Scheduler (cada minuto) ──► GET /api/cron/sync-master
                                     │
                                     ├─ ¿cambió la fecha de modificación de la hoja?   no → «idle» (no lee nada)
                                     ├─ ¿lleva 60 s sin ediciones?                      no → «waiting»
                                     └─ sí → lee la hoja → parser → validación → Firestore

Administración («Sincronizar ahora») ──► POST /api/admin/sync ──► lee la hoja → … → Firestore
```

1. **Comprobación ligera.** Cada minuto se pregunta a Drive la fecha de modificación de la hoja (`modifiedTime`). Es solo un metadato: no se lee el contenido.
2. **Sin cambios, no pasa nada.** Si la fecha es la misma que la última procesada (`meta/watch`), la ruta responde al momento y no registra ninguna ejecución.
3. **Minuto de calma.** Si la hoja cambió hace menos de 60 segundos, se espera a la siguiente pasada. Evita publicar una ficha a medio escribir.
4. **Sincronización.** Se leen `Activos` y `'Horarios '` con la lista blanca aplicada en origen, se interpreta y valida, y se publica solo lo que ha cambiado, en un lote atómico y con versión nueva.
5. **Guardas.** Si falta una columna obligatoria o una pestaña, o si desaparecería más de la mitad de las clínicas, no se publica y la app sigue con la última versión válida.

Tiempo habitual desde la última edición hasta que lo ven los agentes: **entre 1 y 2 minutos**.

La fecha de modificación cambia con cualquier edición del archivo, también en pestañas que la app no usa. En ese caso se lee la hoja, no hay diferencias y la ejecución queda como «Sin cambios».

## Rutas

| Ruta | Quién la llama | Autenticación |
|---|---|---|
| `GET /api/cron/sync-master` | Cloud Scheduler, cada minuto | `Authorization: Bearer <CRON_SECRET>` |
| `POST /api/admin/sync` | Pantalla de administración | Token de Firebase de una persona con rol admin |
| `POST /api/admin/rollback` | Pantalla de administración | Igual |
| `GET /api/admin/runs` | Pantalla de administración | Igual |

## Variables de entorno

| Variable | Para qué | Por defecto |
|---|---|---|
| `MASTER_SPREADSHEET_ID` | ID de la hoja de la Master (o de su copia de pruebas). | — |
| `MASTER_SOURCE` | `sheets` o `file`. | `sheets` si hay `MASTER_SPREADSHEET_ID`; si no, `file` |
| `MASTER_LOCAL_FILE` | Archivo JSON que lee `MASTER_SOURCE=file`. | `fixtures/private/master.json` |
| `STORE` | `firestore` o `memory`. | `firestore` si hay `FIREBASE_PROJECT_ID` o `GOOGLE_CLOUD_PROJECT`; si no, `memory` |
| `FIREBASE_PROJECT_ID` | Proyecto de Firebase. | — |
| `DATA_NAMESPACE` | Espacio de datos: `prod` o `staging`. | `staging` |
| `CRON_SECRET` | Secreto de `/api/cron/sync-master`. Sin él, la ruta rechaza todo. | — |
| `ADMIN_EMAILS` | Administradores de arranque, separados por comas. | — |

En producción las credenciales son las de la cuenta de servicio del backend. Esa cuenta necesita la Master compartida con rol **Lector** y tener activadas en el proyecto las API de Google Sheets y Google Drive.

## Ejecutarla en local

Sin variables de Firebase, la app usa un volcado de la Master en disco y un almacén en memoria:

```bash
npm run dev
curl -X POST http://localhost:3000/api/admin/sync
```

## Cloud Scheduler

```bash
gcloud scheduler jobs create http sync-master \
  --project=omniscripts-isa \
  --location=europe-west4 \
  --schedule="* * * * *" \
  --time-zone="Europe/Madrid" \
  --uri="https://<dominio-de-la-app>/api/cron/sync-master" \
  --http-method=GET \
  --headers="Authorization=Bearer <CRON_SECRET>" \
  --attempt-deadline=120s
```

- `<CRON_SECRET>` es el valor del secreto de Secret Manager. No lo dejes en el historial de la terminal ni en un script.
- Una respuesta `500` o `409` marca la ejecución como fallida en Scheduler; la siguiente pasada lo vuelve a intentar.

## Datos en Firestore

Todo cuelga de `env/{DATA_NAMESPACE}`, para que staging y producción puedan compartir proyecto sin mezclarse.

| Documento | Contenido |
|---|---|
| `env/{ns}/clinics/{clinicId}` | Una clínica publicada (`ClinicSchema`). Es lo que lee la interfaz. |
| `env/{ns}/meta/current` | `{ version, publishedAt, trigger, clinicCount, checksum }` de la versión vigente. |
| `env/{ns}/meta/watch` | `{ modifiedTime }`: fecha de modificación de la hoja ya procesada. |
| `env/{ns}/meta/lock` | `{ owner, expiresAt }`. Cerrojo de la sincronización; caduca solo a los 2 minutos. |
| `env/{ns}/syncRuns/{autoId}` | Una ejecución (`SyncRunSchema`): estado, disparador, duración, incidencias. |
| `env/{ns}/snapshots/{version}` | Copia de cada versión, con `clinics` como texto JSON. |

Notas:

- La publicación es un único lote atómico. Solo se trocea si supera las 450 escrituras.
- `syncRuns` y `snapshots` crecen sin límite. La limpieza de los antiguos está pendiente.
- Las reglas de acceso están en `firestore.rules`.
