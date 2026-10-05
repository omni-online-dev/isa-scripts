# App ISA · Disparador de la Master

Este script vive dentro de la hoja de cálculo de la Master. Cuando alguien edita las pestañas `Activos` u `Horarios `, avisa a la app para que publique los cambios. Los agentes los ven en uno o dos minutos, sin que nadie tenga que hacer nada más.

El script **no envía datos de la hoja**. Solo avisa de que hay cambios; la app lee la Master por su cuenta y en modo solo lectura.

## Qué hace

- Añade el menú **App ISA** con dos opciones: **Publicar ahora** y **Estado de la última publicación**.
- Vigila las ediciones en `Activos` y `Horarios `. Los cambios en cualquier otra pestaña no hacen nada.
- Espera a que la hoja lleve **un minuto sin ediciones** y entonces avisa a la app. Así, veinte cambios seguidos se publican de una vez.
- Si la app detecta un problema (por ejemplo, falta una columna), **no publica** y la app sigue con los datos anteriores. El menú muestra qué hay que corregir.

## Instalación (una sola vez)

La hace la persona **propietaria de la Master**. Necesitas dos datos que te dará Soporte: la **dirección de la app** y la **clave de sincronización**.

1. Abre la Master y entra en **Extensiones → Apps Script**.
2. Borra el contenido del archivo `Código.gs` que aparece y pega el contenido completo de [`Code.gs`](./Code.gs). Pulsa el icono de guardar.
3. En el menú de la izquierda, abre **Configuración del proyecto** (la rueda dentada):
   - Marca **Mostrar el archivo de manifiesto "appsscript.json" en el editor**.
   - Baja hasta **Propiedades de la secuencia de comandos**, pulsa **Añadir propiedad de la secuencia de comandos** y crea estas dos:

     | Propiedad | Valor |
     |---|---|
     | `BACKEND_URL` | La dirección de la app, sin barra al final. |
     | `SYNC_SECRET` | La clave de sincronización. |

   - Pulsa **Guardar propiedades de la secuencia de comandos**.
4. Vuelve al **Editor**, abre `appsscript.json` y sustituye su contenido por el de [`appsscript.json`](./appsscript.json). Guarda.
5. Abre de nuevo `Código.gs`. En el desplegable de funciones de la barra superior elige **`instalar`** y pulsa **Ejecutar**.
6. Google pedirá permiso la primera vez: elige tu cuenta y pulsa **Permitir**. El script pide permiso para ver la hoja, conectarse a la app y ejecutarse solo cuando no estás.
7. Recarga la pestaña de la Master. Debe aparecer el menú **App ISA** junto a «Ayuda».
8. Prueba: **App ISA → Publicar ahora**. Debe salir un mensaje como «Publicado. Versión 12 con 53 clínicas.» o «No había cambios que publicar».

Si repites el paso 5, no pasa nada: `instalar` borra sus disparadores antes de crearlos otra vez.

## Uso diario

No hay que hacer nada. Edita la Master como siempre.

- **¿Tienes prisa?** Usa **App ISA → Publicar ahora** y no esperes al minuto.
- **¿Quieres saber si se publicó?** **App ISA → Estado de la última publicación** muestra la fecha del último intento y su resultado.

### Qué significan los mensajes

| Mensaje | Qué ha pasado | Qué hacer |
|---|---|---|
| Publicado. Versión N con X clínicas. | Los cambios ya están en la app. | Nada. |
| No había cambios que publicar. | La app ya tenía esos datos. | Nada. |
| NO se ha publicado. La app sigue con los datos anteriores. | Hay un problema grave en la hoja (falta una columna o una pestaña, o han desaparecido muchas clínicas de golpe). | Corrige lo que indica la lista y vuelve a publicar. |
| Cosas que revisar: … | La app ha publicado, pero alguna ficha tiene un dato que no entiende. Indica la clínica y la fila. | Corrige esas fichas cuando puedas. |
| La app ha rechazado la clave. | La clave `SYNC_SECRET` no coincide con la de la app. | Avisa a Soporte. |
| No se pudo conectar con la app. | La app no responde o la dirección no es correcta. | Espera unos minutos. Si sigue igual, avisa a Soporte. |

## Importante

- **No renombres** las pestañas `Activos` ni `Horarios ` (con su espacio al final). Si cambian de nombre, la app deja de publicar hasta que se restauren.
- **No renombres las columnas** `Clínica - Tratamiento`, `Link a Horarios` y `Estado` de `Activos`. Puedes añadir columnas nuevas y moverlas de sitio sin problema.
- La **clave** va solo en las propiedades del script. No la escribas en el código ni en ninguna celda.
- Aunque el disparador fallara, la app revisa la Master por su cuenta cada 15 minutos.

## Si algo no funciona

- **No aparece el menú:** recarga la hoja. Si sigue sin salir, repite el paso 5.
- **Los cambios no llegan solos, pero «Publicar ahora» sí funciona:** repite el paso 5 para volver a crear los disparadores. Solo se ejecutan con la cuenta que los instaló; si esa persona pierde el acceso a la hoja, otra propietaria debe instalarlos de nuevo.
- **Para ver el detalle técnico:** en el editor de Apps Script, apartado **Ejecuciones**.

## Para Soporte: versionado con clasp

Esta carpeta es la copia de referencia del script. Para subirla con [`clasp`](https://github.com/google/clasp) hay que crear un `.clasp.json` local con el ID del script (no se guarda en el repositorio) y ejecutar `clasp push` desde `apps-script/`.

El script guarda en sus propiedades `pendingSince`, `lastEdit` y `lastResult`; son su estado interno y no hay que tocarlas.
