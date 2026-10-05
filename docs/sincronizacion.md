# Sincronización de la Master

Cómo llegan los datos de la Master Operativa a la app (WP-08 y WP-09 del [roadmap](./ROADMAP.md)).

## Cómo funciona

```
Edición en la Master ──► Apps Script (espera 1 min) ──► POST /api/sync/master ─┐
«Publicar ahora»     ──► Apps Script (inmediato)    ──► POST /api/sync/master ─┤
Cloud Scheduler (cada 15 min) ───────────────────────► GET /api/cron/sync-master┤
                                                                                ▼
                                    runSync: cerrojo → lectura → parser → guardas → diff → publicación
```

Los tres caminos ejecutan lo mismo, `runSync` (`src/server/sync.ts`):

1. **Cerrojo.** Solo corre una sincronización a la vez. Si hay otra en marcha, espera hasta 10 s; si sigue ocupada, la ruta responde `409`.
2. **Lectura** (`src/server/master/source.ts`). Una sola llamada a la API de Sheets, en solo lectura, para `Activos` y `'Horarios '`. La **lista blanca se aplica aquí**: de `Activos` solo salen la cabecera y las columnas de `ACTIVOS_COLUMNS`; de las fichas, las columnas A–D. La columna E (notas) y el resto de columnas de `Activos` no pasan de esta función.
3. **Parser** (`src/core/master`). Devuelve clínicas e incidencias. No lanza por datos mal escritos.
4. **Guardas.** No se publica (estado `blocked`) si:
   - falta una columna obligatoria o una pestaña (`missing_required_column`, `sheet_not_found`);
   - el resultado tiene 0 clínicas o menos de la mitad de las publicadas (`suspicious_drop`).
5. **Diff.** Se calcula una huella (SHA-256 del JSON con claves ordenadas). Si coincide con la publicada, el estado es `unchanged` y no se escribe nada salvo el registro.
6. **Publicación atómica.** Un único lote de Firestore escribe las clínicas nuevas o cambiadas, borra las que desaparecen, guarda la copia de la versión y actualiza `meta/current`. La versión es la anterior + 1.
7. **Registro.** Toda ejecución queda en `syncRuns`, con su estado, duración e incidencias. El cerrojo se libera siempre.

| Estado | Significado | ¿Cambia la app? |
|---|---|---|
| `published` | Había cambios y se han publicado. | Sí |
| `unchanged` | La Master coincide con lo publicado. | No |
| `blocked` | La Master tiene un problema grave. Se detalla en `issues`. | No: sigue la última versión válida |
| `failed` | Error técnico (credenciales, red…). El detalle solo está en los registros del servidor. | No |

En `syncRuns`, `version` es la versión publicada en esa ejecución; con `unchanged` es la versión vigente, y con `blocked` o `failed` es `null`.

### Restaurar una versión

`rollbackTo(version, store)` vuelve a publicar la copia de `snapshots/{version}` como **versión nueva** (disparador `admin`). El historial no se reescribe. La ruta de administración que lo expone llega en WP-16.

## Rutas

| Ruta | Quién la llama | Autenticación | Respuesta |
|---|---|---|---|
| `POST /api/sync/master` | Apps Script de la Master | Cabecera `x-sync-secret: <SYNC_SECRET>` | `{ status, version, clinicCount, issues }` (solo incidencias `error` y `warning`) |
| `GET /api/cron/sync-master` | Cloud Scheduler | Cabecera `Authorization: Bearer <CRON_SECRET>` | `{ status, version, clinicCount }` |

- `POST /api/sync/master` admite un cuerpo opcional `{ "trigger": "edit" | "manual" }` (por defecto `edit`).
- Códigos: `200` (`published`, `unchanged`, `blocked`), `400` cuerpo no válido, `401` secreto incorrecto o **no configurado**, `409` sincronización en marcha, `500` (`failed`).
- Los secretos se comparan en tiempo constante. Las respuestas no incluyen nunca trazas de error.

## Variables de entorno

| Variable | Para qué | Por defecto |
|---|---|---|
| `MASTER_SPREADSHEET_ID` | ID de la hoja de la Master (o de su copia de pruebas). | — |
| `MASTER_SOURCE` | `sheets` o `file`. | `sheets` si hay `MASTER_SPREADSHEET_ID`; si no, `file` |
| `MASTER_LOCAL_FILE` | Archivo JSON que lee `MASTER_SOURCE=file`. | `fixtures/private/master.json` |
| `STORE` | `firestore` o `memory`. | `firestore` si hay `FIREBASE_PROJECT_ID` o `GOOGLE_CLOUD_PROJECT`; si no, `memory` |
| `FIREBASE_PROJECT_ID` | Proyecto de Firebase (en App Hosting basta `GOOGLE_CLOUD_PROJECT`, que ya viene dado). | — |
| `DATA_NAMESPACE` | Espacio de datos: `prod` o `staging`. | `staging` |
| `SYNC_SECRET` | Secreto de `/api/sync/master`. Sin él, la ruta rechaza todo. | — |
| `CRON_SECRET` | Secreto de `/api/cron/sync-master`. Sin él, la ruta rechaza todo. | — |

En producción las credenciales son las de la cuenta de servicio del backend (Application Default Credentials). Esa cuenta necesita la Master compartida con rol **Lector** y acceso a Firestore.

## Ejecutarla en local

Sin credenciales de Google: la Master se lee de un archivo y los datos se guardan en memoria.

1. Deja un JSON con la forma de `MasterInput` (`{ "activos": { "values": [...], "hyperlinks": [...] }, "fichas": { "values": [...] } }`) en `fixtures/private/master.json`. La carpeta está ignorada por git: **nunca se sube**.
2. En `.env.local`:

   ```bash
   MASTER_SOURCE=file
   STORE=memory
   SYNC_SECRET=<una clave cualquiera para local>
   CRON_SECRET=<otra clave cualquiera para local>
   ```

3. Arranca con `npm run dev` y lanza la sincronización:

   ```bash
   curl -X POST http://localhost:3000/api/sync/master \
     -H "x-sync-secret: $SYNC_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"trigger":"manual"}'

   curl http://localhost:3000/api/cron/sync-master -H "Authorization: Bearer $CRON_SECRET"
   ```

El archivo local pasa por la misma lista blanca que la lectura de Sheets. Con `STORE=memory` los datos se pierden al reiniciar el servidor. Para probar contra Firestore, usa `STORE=firestore`, `FIREBASE_PROJECT_ID` y `gcloud auth application-default login`.

## Cloud Scheduler

El secreto va en una **cabecera**, nunca en la URL (las URL quedan en los registros).

```bash
gcloud scheduler jobs create http sync-master \
  --project=omniscripts-isa \
  --location=europe-west1 \
  --schedule="*/15 * * * *" \
  --time-zone="Europe/Madrid" \
  --uri="https://<dominio-de-la-app>/api/cron/sync-master" \
  --http-method=GET \
  --headers="Authorization=Bearer <CRON_SECRET>" \
  --attempt-deadline=120s
```

- `<CRON_SECRET>` es el valor del secreto de Secret Manager (`gcloud secrets versions access latest --secret=CRON_SECRET`). No lo dejes en el historial de la terminal ni en un script.
- Cloud Scheduler no existe en todas las regiones; `europe-west1` es la más cercana a `europe-west4`.
- Para cambiar el secreto: `gcloud scheduler jobs update http sync-master --update-headers="Authorization=Bearer <nuevo>"`.
- Una respuesta `500` o `409` marca la ejecución como fallida en Scheduler; la siguiente pasada (15 min) lo vuelve a intentar.

## Disparador en la Master

Código y guía de instalación en [`apps-script/`](../apps-script/README.md). Resumen:

- Un disparador de edición apunta en las propiedades del script que hay cambios pendientes (`pendingSince`, `lastEdit`), solo si la pestaña editada es `Activos` u `Horarios `.
- Un disparador de cada minuto llama a `/api/sync/master` cuando la última edición tiene al menos 60 s. Con `LockService` no se solapan dos llamadas.
- Si la app responde `409` o `5xx`, o no responde, lo reintenta cada minuto durante 15 minutos. Después lo deja: la conciliación programada lo recoge.
- «Publicar ahora» llama al momento con `trigger: "manual"` y muestra el resultado.

## Datos en Firestore

Todo cuelga de `env/{DATA_NAMESPACE}`, para que staging y producción puedan compartir proyecto sin mezclarse.

| Documento | Contenido |
|---|---|
| `env/{ns}/clinics/{clinicId}` | Una clínica publicada (`ClinicSchema`). Es lo que lee la interfaz. |
| `env/{ns}/meta/current` | `{ version, publishedAt, trigger, clinicCount, checksum }` de la versión vigente. |
| `env/{ns}/meta/lock` | `{ owner, expiresAt }`. Cerrojo de la sincronización; caduca solo a los 2 minutos. |
| `env/{ns}/syncRuns/{autoId}` | Una ejecución (`SyncRunSchema`): estado, disparador, duración, incidencias. |
| `env/{ns}/snapshots/{version}` | Copia de cada versión: `{ version, publishedAt, checksum, clinicCount, clinics }`, con `clinics` como texto JSON. |

Notas:

- La publicación es un único lote atómico. Solo se trocea si supera las 450 escrituras (más de ~440 clínicas cambiadas a la vez); en ese caso `meta/current` va en el último lote.
- `syncRuns` y `snapshots` crecen sin límite. La limpieza de los antiguos está pendiente (fase de administración).
- Las reglas de acceso (`firestore.rules`) deben cubrir estas rutas con el prefijo `env/{ns}/`: se definen en WP-12.
