# ADR 0001 · Variantes de guion

**Estado:** pendiente de decisión (necesaria antes de WP-07).

## Contexto

La Master nombra la variante de guion en cada ficha: «Script Selectivo» (36 apariciones), «Script Simplificado» (20) y guiones propios de una clínica («Script Adeje», «Script Ardenne»). La app actual solo conoce las plantillas `simplificado` y `estricto`, además de la estándar.

## Decisión provisional

El esquema guarda la variante **tal como la nombra la Master** (`estandar`, `simplificado`, `selectivo`, `propio`). El motor de guiones decidirá qué plantilla usar para cada una.

## Preguntas abiertas

1. ¿«Selectivo» equivale a la plantilla `estricto` de la app actual?
2. ¿Qué plantilla usan las clínicas con guion propio?
3. Una ficha sin línea «Script …», ¿usa la plantilla estándar?
