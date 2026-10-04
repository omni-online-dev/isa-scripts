/**
 * Variantes de guion que no dependen del tratamiento.
 * El texto procede de la app anterior (`scripts.js`) y se mantiene tal cual.
 */
import type { ScriptTemplate } from "../types";
import { authorityOffer } from "./treatments";

/** Guion corto, sin cualificación: clínicas con «Script Simplificado» en la Master. */
export const simplificado: ScriptTemplate = {
  label: "Guion simplificado",
  steps: [
    {
      title: "Saludo",
      text: (c) => `Hola, buenos días. Soy [Tu Nombre], de **${c.name}**. ¿Hablo con **[Nombre Paciente]**?`,
    },
    {
      title: "Motivo de llamada",
      text: (c) =>
        `Hola, **[Nombre Paciente]**. Le llamo porque solicitó una valoración gratuita de ${c.treatment}, ¿correcto? Le informo que la llamada se grabará por motivos de calidad.`,
    },
    {
      title: "Ubicación",
      text: (c) => c.location,
      note: "→ Si dice que no conoce la zona: No hay problema, le enviaremos la ubicación exacta y el enlace de Google Maps por WhatsApp.",
    },
    { title: "Agendamiento", text: () => "¿Le viene mejor venir por la mañana o por la tarde?" },
    { title: "Confirmación", text: () => "Perfecto. Tengo libre el [Horario más cercano]. ¿Le va bien esa hora?" },
    {
      title: "Despedida",
      highlight: true,
      text: () =>
        "Excelente. Pues le espero el [Horario acordado].\n\nEn breve recibirá un mensaje con la información de la cita. ¡Que tenga un buen día!",
    },
  ],
};

/** Implantes con cualificación estricta. Solo se usa en las clínicas de CLINIC_SCRIPTS. */
export const estricto: ScriptTemplate = {
  label: "Implantes (estricto)",
  steps: [
    {
      title: "Saludo + Encaje + Ubicación",
      text: (c) =>
        `Hola **[Nombre]**, te llamo de **${c.name}** porque dejaste una solicitud para implantes dentales. ${c.location}`,
      note: "→ Si dice que no conoce la zona: No hay problema, le enviaremos la ubicación exacta y el enlace de Google Maps por WhatsApp.",
    },
    {
      title: "Mini pitch de autoridad + oferta + explicación de cita",
      text: (c) => {
        let text = authorityOffer(
          { ...c, promo: null },
          "Perfecto. Antes de seguir, te explico muy rápido:\nEsta llamada puede ser grabada por motivos de calidad.",
        );
        if (c.promo) text += `\nY ahora mismo tenemos una promoción vigente: **${c.promo}** para las primeras reservas.`;
        return `${text}\nAdemás, la primera cita es totalmente gratuita.`;
      },
    },
    {
      title: "Motivo de la visita",
      text: () =>
        "Para ayudarte bien, ¿qué es exactamente lo que necesitas?\n¿Una rehabilitación completa o solo una pieza en concreto?",
      note: "→ Escuchar respuesta.\n→ Resumir en 1 frase: «Perfecto, entonces vienes por ______.»",
    },
    {
      title: "Cualificación documental (estricta)",
      text: (c) =>
        `Para poder abrir tu ficha y que el especialista te atienda, ¿qué documentación tienes disponible?\nAceptamos: **${c.docs}**.`,
      note: (c) => (c.qualificationNote ? `→ ${c.qualificationNote}` : null),
      rebate: (c) =>
        `Te cuento, [Nombre]: Para esta campaña específica de salud dental, trabajamos con una entidad financiera externa que es la que gestiona las cuotas. Actualmente, sus condiciones de aprobación son muy estrictas y, por un tema de su propio sistema de riesgos, solo nos permiten tramitar solicitudes con **${c.docs}**.\n\nMe sabe fatal, porque me encantaría poder darte el hueco ya mismo, pero el sistema no me deja avanzar sin ese documento concreto. ¿Te parece que te avise si cambian estas condiciones?\n(Finalizar llamada si no cualifica.)`,
    },
    {
      title: "Cualificación económica (pregunta abierta)",
      onlyIf: (c) => c.econ !== null,
      text: () =>
        "Cuando un paciente quiere financiar el tratamiento, las entidades suelen pedir cierta documentación.\n¿Qué situación laboral o de ingresos tienes tú ahora mismo?",
      note: (c) =>
        `Aceptamos:\n${(c.econ ?? "")
          .split("\n")
          .map((line) => `→ ${line}`)
          .join("\n")}\n\nSi el paciente menciona solamente «Trabajo»: «Genial. Te pregunto porque las financieras diferencian entre nómina, autónomos o pensión. ¿Cómo recibes tú tus ingresos?»\n\nSi menciona ingresos regulares (nómina, autónomo, jubilado, tercero con nómina…): pasamos al siguiente bloque.`,
      rebate: () =>
        "Si menciona ingresos irregulares o ambiguos:\n«Entiendo. En este caso, las entidades prefieren ingresos regulares.\nSi tu situación cambia, nos avisas y reabrimos la opción de financiación.»\n\nSi menciona que no tiene ingresos:\n«Lo siento, para acceder a la financiación necesitamos que el paciente tenga un ingreso regular.\nCuando tu situación cambie, estaremos encantados de ayudarte.»\n(Finalizar llamada si no cualifica.)",
    },
    {
      title: "Refuerzo de valor + Cierre con urgencia real",
      text: (c) =>
        c.promo
          ? `Perfecto, entonces sí puedes optar tanto al diagnóstico como a la financiación.\nComo te decía, la promoción de **${c.promo}** es para las 10 primeras personas que reserven.`
          : "Perfecto, entonces sí puedes optar tanto al diagnóstico como a la financiación.\nComo te decía, tenemos cupos limitados para las valoraciones gratuitas y me quedan pocas plazas libres esta semana.",
    },
    {
      title: "Verificación de datos básicos",
      text: () =>
        "Antes de agendar, necesito confirmar tus datos para abrir bien tu ficha.\n¿Me confirmas tu nombre y apellido?",
      note: "→ Si pregunta por qué no sirve solo con el nombre: «¡Perfecto, [Nombre]! ¿Y me podrías facilitar también tus apellidos? Es para asegurarnos de que tu ficha quede registrada correctamente.»\n→ Actualización: «Perfecto, lo actualizo aquí.»",
    },
    {
      title: "Agendamiento",
      text: () => "¿Te viene mejor por la mañana o por la tarde?",
      note: "→ Ofrecer un único horario exacto dentro de las próximas 72h, según disponibilidad real.",
      rebate: () =>
        "No pasa nada. Tengo otra opción dentro de los próximos 3 días: [alternativa].\nSi prefieres una fecha más adelante, guardo tu número y te llamo dos días antes de la fecha que te interesa para darte un hueco.\n¿A qué hora te viene bien que te llame ese día?",
    },
    {
      title: "Cierre con resumen final",
      highlight: true,
      text: (c) =>
        `Perfecto: tu cita queda programada para el [día] a las [hora], en **${c.name}** (${c.address}).\nAhora te envío por WhatsApp la ubicación e información de la cita para que lo tengas más cómodo.\n¿Tienes alguna duda rápida antes de que te lo mande?`,
    },
  ],
};

export const reprogramacion: ScriptTemplate = {
  label: "Reprogramación",
  steps: [
    {
      title: "Introducción",
      text: (c) =>
        `Hola **[Nombre]**, te hablo de **${c.name}**, ¿cómo estás?\n\nTenías una cita con nosotros el [Fecha] y veo que no lograste acudir, ¿correcto?`,
    },
    {
      title: "Agendar nueva cita",
      text: (c) =>
        `${
          c.promo ? `Por esta semana tenemos vigente la promoción **${c.promo}**. ` : ""
        }¿Deseas agendar una nueva cita?\n\nNos quedan poquitas plazas. ¿Qué tal te viene si te doy una cita para [horario más cercano]?`,
    },
    {
      title: "WhatsApp",
      highlight: true,
      text: (c) =>
        `Nuestra dirección es **${c.address}**. Te compartiremos la información de la cita vía WhatsApp.`,
    },
  ],
};

export const recontacto: ScriptTemplate = {
  label: "Recontacto",
  steps: [
    {
      title: "Saludo + Reenganche",
      text: (c) =>
        `Hola **[Nombre]**, te llamo de **${c.name}**. Hace un tiempo nos dejaste tus datos para informarte sobre ${c.treatment}, pero al final se nos quedó la cita pendiente. Antes de cerrar el expediente, quería confirmar si todavía te interesa aprovechar la revisión gratuita y la promoción especial.`,
      note: "→ Si NO está interesado: «Solo te lo decía porque tu ficha sigue abierta y puedes beneficiarte del descuento. ¿Qué días te suele venir mejor?»",
    },
    { title: "Autoridad + Oferta", text: (c) => authorityOffer(c, "Perfecto. Te explico muy rápido:") },
    {
      title: "Motivo + Cualificación",
      text: (c) =>
        `¿Qué es lo que necesitas exactamente?\n\n¿Qué documentación tienes? Aceptamos: **${c.docs}**.`,
    },
    {
      title: "Verificación + Agendamiento",
      text: () => "¿Me confirmas nombre y apellido? ¿Te viene mejor mañana o tarde?",
    },
    {
      title: "Resumen final",
      highlight: true,
      text: (c) =>
        `${c.promo ? `Oferta: **${c.promo}**. ` : ""}Cita el [día] a las [hora] en **${c.name}**. Te envío info por WhatsApp.`,
    },
  ],
};
