/**
 * App ISA · Disparador de la Master.
 *
 * Avisa a OmniScripts ISA cuando cambian las pestañas «Activos» u «Horarios » para
 * que la app publique los datos nuevos. Este script NO envía datos de la hoja: solo
 * avisa. La app lee la Master por su cuenta, en modo solo lectura.
 *
 * Configuración (Configuración del proyecto → Propiedades de la secuencia de comandos):
 *   BACKEND_URL   Dirección de la app, p. ej. https://omniscripts-isa.example.app
 *   SYNC_SECRET   Clave compartida con la app. Nunca se escribe en este archivo.
 */

/** Pestañas que alimentan la app. El espacio final de «Horarios » es real. */
var PESTANAS = ['Activos', 'Horarios '];

/** Espera tras la última edición antes de publicar, para agrupar cambios seguidos. */
var ESPERA_MS = 60 * 1000;

/** Si la app no responde, se deja de reintentar pasado este tiempo. */
var REINTENTOS_MS = 15 * 60 * 1000;

var RUTA = '/api/sync/master';
var MAX_PROBLEMAS = 15;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('App ISA')
    .addItem('Publicar ahora', 'publicarAhora')
    .addItem('Estado de la última publicación', 'mostrarEstado')
    .addToUi();
}

/**
 * Crea los disparadores. Se ejecuta una vez, a mano, desde el editor.
 * Se puede repetir sin miedo: borra los suyos antes de volver a crearlos.
 */
function instalar() {
  var propios = ['alEditar', 'revisarPendientes'];
  ScriptApp.getProjectTriggers().forEach(function (disparador) {
    if (propios.indexOf(disparador.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(disparador);
  });
  ScriptApp.newTrigger('alEditar').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger('revisarPendientes').timeBased().everyMinutes(1).create();

  var faltan = ['BACKEND_URL', 'SYNC_SECRET'].filter(function (clave) {
    return !propiedades_().getProperty(clave);
  });
  Logger.log(
    faltan.length
      ? 'Disparadores creados. Falta configurar: ' + faltan.join(', ')
      : 'Disparadores creados. Todo listo.'
  );
}

/** Disparador de edición: solo apunta que hay cambios pendientes. */
function alEditar(e) {
  if (!e || !e.range) return;
  if (PESTANAS.indexOf(e.range.getSheet().getName()) === -1) return;

  var props = propiedades_();
  var ahora = String(Date.now());
  props.setProperty('lastEdit', ahora);
  if (!props.getProperty('pendingSince')) props.setProperty('pendingSince', ahora);
}

/** Disparador de cada minuto: publica cuando la hoja lleva un minuto sin cambios. */
function revisarPendientes() {
  var cerrojo = LockService.getScriptLock();
  if (!cerrojo.tryLock(1000)) return;
  try {
    var props = propiedades_();
    var pendiente = Number(props.getProperty('pendingSince'));
    var ultima = props.getProperty('lastEdit');
    if (!pendiente) return;
    if (Date.now() - Number(ultima) < ESPERA_MS) return;

    var resultado = llamarBackend_('edit');
    guardarResultado_(resultado);

    var reintentar = resultado.codigo === 0 || resultado.codigo === 409 || resultado.codigo >= 500;
    if (reintentar && Date.now() - pendiente < REINTENTOS_MS) return;
    // Si alguien editó mientras se publicaba, el aviso sigue pendiente para la próxima vuelta.
    if (props.getProperty('lastEdit') === ultima) props.deleteProperty('pendingSince');
    else props.setProperty('pendingSince', props.getProperty('lastEdit'));
  } finally {
    cerrojo.releaseLock();
  }
}

/** Menú «Publicar ahora». */
function publicarAhora() {
  var ui = SpreadsheetApp.getUi();
  var cerrojo = LockService.getScriptLock();
  if (!cerrojo.tryLock(5000)) {
    ui.alert('App ISA', 'Ya hay una publicación en marcha. Espera un minuto y vuelve a intentarlo.', ui.ButtonSet.OK);
    return;
  }
  var resultado;
  try {
    var props = propiedades_();
    var ultima = props.getProperty('lastEdit');
    resultado = llamarBackend_('manual');
    guardarResultado_(resultado);
    if (resultado.codigo === 200 && props.getProperty('lastEdit') === ultima) {
      props.deleteProperty('pendingSince');
    }
  } finally {
    cerrojo.releaseLock();
  }
  ui.alert('App ISA', resumen_(resultado), ui.ButtonSet.OK);
}

/** Menú «Estado de la última publicación». */
function mostrarEstado() {
  var ui = SpreadsheetApp.getUi();
  var props = propiedades_();
  var guardado = props.getProperty('lastResult');
  var texto = 'Todavía no se ha publicado nada desde esta hoja.';
  if (guardado) {
    var resultado = JSON.parse(guardado);
    texto = 'Último intento: ' + fecha_(resultado.cuando) + '\n\n' + resumen_(resultado);
  }
  if (props.getProperty('pendingSince')) {
    texto += '\n\nHay cambios pendientes: se publicarán solos cuando la hoja lleve un minuto sin ediciones.';
  }
  ui.alert('App ISA', texto, ui.ButtonSet.OK);
}

/**
 * Llama a la app. Devuelve siempre un objeto, nunca lanza:
 * { codigo, cuando, datos } — `codigo` 0 significa que no hubo respuesta.
 */
function llamarBackend_(disparador) {
  var resultado = { codigo: 0, cuando: Date.now(), datos: null, aviso: '' };
  var props = propiedades_();
  var url = String(props.getProperty('BACKEND_URL') || '').trim().replace(/\/+$/, '');
  var secreto = String(props.getProperty('SYNC_SECRET') || '').trim();
  if (!url || !secreto) {
    resultado.codigo = -1;
    resultado.aviso = 'Falta configurar BACKEND_URL o SYNC_SECRET en las propiedades del script.';
    return resultado;
  }

  try {
    var respuesta = UrlFetchApp.fetch(url + RUTA, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-sync-secret': secreto },
      payload: JSON.stringify({ trigger: disparador }),
      muteHttpExceptions: true,
      followRedirects: false,
    });
    resultado.codigo = respuesta.getResponseCode();
    try {
      resultado.datos = JSON.parse(respuesta.getContentText());
    } catch (sinJson) {
      resultado.datos = null;
    }
  } catch (error) {
    resultado.aviso = 'No se pudo conectar con la app.';
  }
  return resultado;
}

/** Guarda lo justo para «Estado de la última publicación». */
function guardarResultado_(resultado) {
  var datos = resultado.datos || {};
  var problemas = (datos.issues || []).slice(0, MAX_PROBLEMAS);
  propiedades_().setProperty(
    'lastResult',
    JSON.stringify({
      codigo: resultado.codigo,
      cuando: resultado.cuando,
      aviso: resultado.aviso,
      datos: {
        status: datos.status,
        version: datos.version,
        clinicCount: datos.clinicCount,
        issues: problemas,
        masProblemas: (datos.issues || []).length - problemas.length,
      },
    })
  );
}

/** Explica el resultado en lenguaje llano. */
function resumen_(resultado) {
  var datos = resultado.datos || {};
  if (resultado.codigo === -1) return resultado.aviso;
  if (resultado.codigo === 0) return 'No se pudo conectar con la app. Inténtalo de nuevo en unos minutos.';
  if (resultado.codigo === 401) return 'La app ha rechazado la clave. Avisa a Soporte para revisar SYNC_SECRET.';
  if (resultado.codigo === 409) return 'Ya hay una publicación en marcha. Espera un minuto y vuelve a intentarlo.';

  var problemas = listaProblemas_(datos);
  if (datos.status === 'published') {
    return 'Publicado. Versión ' + datos.version + ' con ' + datos.clinicCount + ' clínicas.' + problemas;
  }
  if (datos.status === 'unchanged') {
    return 'No había cambios que publicar. La app ya está al día (' + datos.clinicCount + ' clínicas).' + problemas;
  }
  if (datos.status === 'blocked') {
    return 'NO se ha publicado. La app sigue con los datos anteriores.' + problemas;
  }
  return 'La app ha tenido un problema y no se ha publicado nada (código ' + resultado.codigo + '). Avisa a Soporte.';
}

function listaProblemas_(datos) {
  var problemas = datos.issues || [];
  if (!problemas.length) return '';
  var lineas = problemas.slice(0, MAX_PROBLEMAS).map(function (p) {
    var donde = [p.clinic, p.row ? p.sheet.trim() + ', fila ' + p.row : ''].filter(String).join(' · ');
    return '• ' + (donde ? donde + ': ' : '') + p.message;
  });
  var resto = problemas.length - lineas.length + (datos.masProblemas || 0);
  if (resto > 0) lineas.push('… y ' + resto + ' más.');
  return '\n\nCosas que revisar:\n' + lineas.join('\n');
}

function fecha_(milisegundos) {
  return Utilities.formatDate(new Date(milisegundos), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}

function propiedades_() {
  return PropertiesService.getScriptProperties();
}
