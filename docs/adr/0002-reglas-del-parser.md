# ADR 0002 · Reglas del parser de la Master

**Estado:** aplicado en WP-05 y WP-06. Los puntos marcados «a confirmar» necesitan el visto bueno de Operaciones.

## Reglas

1. **Activos es el índice.** Una clínica se publica si alguna de sus filas enlaza a una ficha. La unión es el hipervínculo de «Link a Horarios», no el nombre.
2. **El nombre visible es el de la ficha**, no el de Activos.
3. **Varias filas del mismo tratamiento** (canales Meta, Google…) se unen en un tratamiento con varios canales. Manda el estado más favorable.
4. **Dos pistas independientes en la ficha:** la columna A (etiquetas y secciones) y las columnas B–D (horarios). Comparten filas, pero no se condicionan.
5. **Alcance por tratamiento.** Un dato sin tratamiento indicado vale para todos. Si la etiqueta nombra tratamientos («Puntos de valor (implantes)», «Criterios de financiación Ortodoncia»), vale solo para esos.
6. **PROMOCIÓN es una sección cerrada.** Todo lo que hay hasta «CRITERIOS PARA FORMULARIO…» es promoción, aunque una línea empiece como otra etiqueta («Financiación: a 48 meses»). Los subtítulos «Implantes:», «Ortodoncia:» reparten las líneas.
7. **No se publica nunca:** la columna E (notas), la sección «CRITERIOS PARA FORMULARIO MB» ni «Información para el MB».
8. **Una ficha vecina sin enlace no se absorbe.** La ficha termina donde empieza otra (línea sin etiqueta seguida de una dirección).

## A confirmar con Operaciones

- **Ficha sin horario** (p. ej. «Leer Nota»): se publica con aviso, sin tabla de horarios. Alternativa: no publicarla.
- **Tratamiento con horario en la ficha pero sin fila en Activos** (p. ej. blanqueamiento): se publica con el estado de la clínica. Alternativa: exigir la fila en Activos.
- **Fila con ficha pero sin tratamiento en el nombre:** no se publica y se avisa al editor.
