# ADR 0003 · Sin scripts en la Master

**Estado:** aplicado (06/10/2026). Sustituye al paquete WP-09 del roadmap.

## Contexto

El plan original instalaba un Apps Script en la Master para avisar a la app en cada edición y ofrecer un menú «Publicar ahora». Operaciones no lo permite: la Master es un archivo de acceso restringido y los scripts dificultan el seguimiento de las ediciones.

## Decisión

Dentro de la hoja no se instala nada. La app vigila la hoja desde fuera:

- Cloud Scheduler llama a `/api/cron/sync-master` **cada minuto**.
- La ruta consulta a Drive la fecha de modificación del archivo. Si no ha cambiado, termina sin leer la hoja.
- Si cambió y lleva 60 segundos sin ediciones, sincroniza.
- «Publicar ahora» pasa a ser el botón «Sincronizar ahora» de la pantalla de administración.

## Consecuencias

- La Master queda intacta: sin scripts, sin disparadores y sin menús añadidos.
- Los cambios llegan a los agentes entre 1 y 2 minutos después de la última edición, igual que con el disparador.
- La cuenta de servicio solo necesita permiso de **Lector**. Además de Sheets, usa la API de Drive, limitada a metadatos del archivo.
- Los editores no reciben el informe de errores dentro de la hoja. Lo consulta Soporte en Administración.
- Una edición en una pestaña que la app no usa provoca una lectura que termina en «Sin cambios».

## Alternativas descartadas

- **Notificaciones de Drive (`files.watch`)**: instantáneas, pero los canales caducan y hay que renovarlos; más piezas que mantener para ganar menos de un minuto.
- **Solo cada 15 minutos**: demasiado lento para un cambio de promoción en plena campaña.
