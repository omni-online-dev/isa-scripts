/**
 * Guiones de primera llamada por tratamiento (variante completa, con cualificación).
 * El texto procede de la app anterior (`scripts.js`) y se mantiene tal cual.
 */
import type { TreatmentKey } from "../../schema";
import type { Rebuttal, ScriptContext, ScriptTemplate } from "../types";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const sentence = (text: string) => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** Introducción + puntos de valor + promoción vigente. */
export function authorityOffer(c: ScriptContext, intro: string, promoSuffix = ""): string {
  let text = intro;
  if (c.valuePoints) text += `\n\n**${sentence(capitalize(c.valuePoints))}**`;
  if (c.promo) {
    const lead = c.valuePoints ? "Y ahora mismo tenemos" : "Ahora mismo tenemos";
    text += `\n\n${lead} una promoción vigente: **${c.promo}**${promoSuffix}.`;
  }
  return text;
}

/** La nota de cualificación de la ficha acompaña siempre a la pregunta de documentación. */
const docsNote = (c: ScriptContext) => (c.qualificationNote ? `→ ${c.qualificationNote}` : null);
const econLines = (c: ScriptContext) =>
  (c.econ ?? "")
    .split("\n")
    .map((line) => `→ ${line}`)
    .join("\n");
const hasEcon = (c: ScriptContext) => c.econ !== null;

const IMPLANTES_REBUTTALS: Rebuttal[] = [
  {
    label: "No quiere agendar en corto plazo",
    response:
      "Claro, no hay problema.\n\nLo que sí te recomiendo es hacer primero la valoración, porque así el especialista puede revisar tu caso con calma y decirte exactamente qué opciones tendrías y qué necesitarías realmente.\n\nAdemás, ahora mismo sigue activa la promoción especial y estamos trabajando con pocos huecos para primeras visitas. Lo ideal sería dejarte ya una cita reservada para que no te quedes sin disponibilidad mientras la promoción sigue vigente.",
    cierre: "¿Qué te suele venir mejor normalmente, mañana o tarde?",
  },
  {
    label: "Quiere saber el precio antes",
    response:
      "Te entiendo perfectamente. Mucha gente nos pregunta eso primero.\n\nLo que pasa es que en implantes el precio cambia bastante según el número de piezas, el estado del hueso y si hace falta algún procedimiento adicional.\n\nPor eso el especialista primero hace la valoración y ya sales con un presupuesto claro y adaptado a tu caso, sin compromiso.",
    cierre: "¿Te viene mejor una visita por la mañana o por la tarde?",
  },
  {
    label: "No quiere ir sin saber información concreta",
    response:
      "Es totalmente normal querer entender bien el tratamiento antes de venir.\n\nPrecisamente la primera visita es gratuita para eso: el especialista revisa tu caso, te explica qué opciones tienes, cómo sería el procedimiento y resuelve todas tus dudas con calma.\n\nY lo más importante: vienes simplemente a informarte y valorar opciones, sin ningún compromiso de empezar el tratamiento.",
    cierre: "¿Qué horario te suele venir mejor?",
  },
  {
    label: "Tiene que pensarlo",
    response:
      "Claro, es una decisión importante y es normal querer pensarlo bien.\n\nDe hecho, muchos pacientes primero vienen a la valoración gratuita precisamente para tener toda la información clara antes de decidir nada.\n\nAsí puedes valorar opciones, tiempos y presupuesto con tranquilidad y sin compromiso.",
    cierre: "¿Te dejo un hueco y ya luego decides con calma?",
  },
  {
    label: "Tiene que consultarlo con su pareja o familia",
    response:
      "Perfecto, es completamente normal.\n\nDe hecho, muchas veces viene la pareja o un familiar para escuchar toda la información juntos y así tomar la decisión con tranquilidad.\n\nSi quieres, podéis venir los dos a la valoración y el especialista os explica todo directamente.",
    cierre: "¿Qué día os encajaría mejor?",
  },
  {
    label: "Miedo al dentista",
    response:
      "Es más común de lo que imaginas, de verdad.\n\nMuchos pacientes vienen con ese mismo miedo y precisamente por eso el especialista suele ir explicando todo con mucha calma y sin hacer nada que el paciente no entienda o no quiera.\n\nAdemás, en esta primera visita solo se hace la valoración y te explican el procedimiento paso a paso.",
    cierre: "¿Te parece si te reservamos un hueco tranquilo para que puedas informarte sin presión?",
  },
  {
    label: "«Yo me paso por la clínica»",
    response:
      "Perfecto, también puedes acercarte directamente si lo prefieres.\n\nLo único es que la primera visita gratuita forma parte de esta campaña y solo podemos garantizarla a las personas que dejan la cita reservada previamente por este medio.\n\nSi vienes sin cita, por supuesto te atenderán con gusto, pero dependiendo de la disponibilidad y del tipo de valoración, la visita podría tener coste.\n\nSi quieres, te la dejo reservada ahora mismo y así te aseguras la valoración gratuita.",
    cierre: "¿Te suele venir mejor por la mañana o por la tarde?",
  },
];

const implantes: ScriptTemplate = {
  label: "Implantes dentales",
  steps: [
    {
      title: "Saludo + Encaje + Ubicación",
      text: (c) =>
        `Hola **[Nombre]**, te llamo de **${c.name}** porque dejaste una solicitud para una cita de valoración gratuita de **implantes dentales**, ¿correcto? ${c.location}`,
      note: "→ Si no conoce la zona: No hay problema, le enviaremos la ubicación exacta y el enlace de Google Maps por WhatsApp.",
    },
    {
      title: "Autoridad + Oferta",
      text: (c) =>
        authorityOffer(
          c,
          "Perfecto. Antes de seguir, te explico muy rápido: esta llamada puede ser grabada por motivos de calidad.",
          ", válida solo durante esta semana o mes para las primeras reservas",
        ),
    },
    {
      title: "Motivo de la visita",
      text: () =>
        "Para ayudarte bien, ¿qué es exactamente lo que necesitas? ¿Una rehabilitación completa o solo una pieza en concreto?",
      note: "→ Escuchar respuesta y resumir: «Perfecto, entonces vienes por ______.»",
    },
    {
      title: "Cualificación documental",
      text: (c) =>
        `Para poder abrir tu ficha y que el especialista te atienda, ¿qué documentación tienes disponible? Aceptamos: **${c.docs}**.`,
      note: docsNote,
      rebate: (c) =>
        `Te entiendo perfectamente [Nombre], nos encantaría poder ayudarte. El tema es que para esta campaña específica trabajamos con una financiera externa que, por normativa, nos exige presentar **${c.docs}**.\n\nSé que es un fastidio... si te parece bien, dejo tu ficha anotada y en cuanto cambien las condiciones te doy un aviso, ¿te parece bien? **(Finalizar llamada)**`,
    },
    {
      title: "Cualificación económica",
      onlyIf: hasEcon,
      text: () =>
        "Cuando un paciente quiere financiar el tratamiento, las entidades suelen pedir cierta documentación. ¿Qué situación laboral o de ingresos tienes tú ahora mismo?",
      note: (c) =>
        `Aceptamos:\n${econLines(c)}\n→ Si menciona ingresos regulares: pasamos al siguiente bloque.\n→ Si solo dice «Trabajo»: «¿Cómo recibes tus ingresos? ¿Por nómina o eres autónomo?»`,
      rebate: () =>
        "Te comprendo totalmente. El tema es que las entidades financieras nos piden ingresos regulares (nómina, jubilación, autónomo) para poder aprobarlo.\n\nNo te preocupes, lo dejamos anotado. Si más adelante tu situación cambia, avísanos con confianza y retomamos. ¡Mucho ánimo! **(Finalizar llamada)**",
    },
    {
      title: "Valor + Urgencia",
      text: (c) =>
        `Perfecto, entonces sí puedes optar tanto al diagnóstico como a la financiación.${
          c.promo ? ` Como te decía, la promoción de **${c.promo}** es para las primeras 10 personas que reserven.` : ""
        }`,
    },
    {
      title: "Verificación de datos",
      text: () =>
        "Antes de agendar, necesito confirmar tus datos para abrir bien tu ficha. ¿Me confirmas tu nombre y apellido?",
      note: "→ Si solo da nombre: «¿Me podrías facilitar también tus apellidos? Es para que tu ficha quede registrada correctamente.»",
    },
    {
      title: "Agendamiento",
      text: () => "¿Te viene mejor por la mañana o por la tarde?",
      note: "→ Ofrecer un único horario exacto dentro de las próximas 72h.",
      rebate: () =>
        "No pasa nada. Tengo otra opción dentro de los próximos 3 días: [alternativa]. Si prefieres más adelante, te llamo dos días antes. ¿A qué hora te viene bien?",
    },
    {
      title: "Resumen final",
      highlight: true,
      text: (c) =>
        `Perfecto: tu cita queda programada para el [Día] a las [Hora], en **${c.name}** (${c.address}). Ahora te envío por WhatsApp la ubicación e información. ¿Tienes alguna duda rápida?`,
    },
  ],
  rebuttals: IMPLANTES_REBUTTALS,
};

const ortodoncia: ScriptTemplate = {
  label: "Ortodoncia",
  steps: [
    {
      title: "Saludo + Encaje + Ubicación",
      text: (c) =>
        `Hola **[Nombre]**, te llamo de **${c.name}** porque dejaste una solicitud para una cita de valoración gratuita de **ortodoncia**, ¿correcto? ${c.location}`,
      note: "→ Si no conoce la zona: enviaremos ubicación por WhatsApp.",
    },
    {
      title: "Autoridad + Oferta",
      text: (c) => authorityOffer(c, "Perfecto. Esta llamada puede ser grabada por motivos de calidad."),
    },
    {
      title: "Motivo de la visita",
      text: () =>
        "Para ayudarte bien, ¿qué es exactamente lo que necesitas? ¿Es un tratamiento desde cero o una revisión de algo que ya llevas?",
      note: "→ Resumir: «Perfecto, entonces vienes por ______.»",
    },
    {
      title: "Cualificación documental",
      text: (c) => `Para poder abrir tu ficha, ¿qué documentación tienes disponible? Aceptamos: **${c.docs}**.`,
      note: docsNote,
      rebate: (c) =>
        `Te entiendo perfectamente, nos encantaría poder ayudarte. El tema es que para esta campaña específica trabajamos con una financiera que, por normativa, nos exige presentar **${c.docs}**. ¿Te parece que te avise si cambian estas condiciones? **(Finalizar)**`,
    },
    {
      title: "Cualificación económica",
      onlyIf: hasEcon,
      text: () => "¿Qué situación laboral o de ingresos tienes ahora mismo?",
      note: (c) => `Aceptamos:\n${econLines(c)}`,
      rebate: () =>
        "Te comprendo totalmente. El tema es que las entidades financieras nos piden ingresos regulares. No te preocupes, lo dejamos anotado por si más adelante cambia tu situación. ¡Mucho ánimo! **(Finalizar)**",
    },
    {
      title: "Valor + Urgencia",
      text: (c) =>
        `Perfecto.${c.promo ? ` La promoción de **${c.promo}** es para las primeras 10 personas que reserven.` : ""}`,
    },
    {
      title: "Verificación de datos",
      text: () => "¿Me confirmas tu nombre y apellido?",
      note: "→ Pedir apellidos si solo da nombre.",
    },
    {
      title: "Agendamiento",
      text: () => "¿Te viene mejor por la mañana o por la tarde?",
      rebate: () => "No pasa nada. Tengo otra opción dentro de los próximos 3 días.",
    },
    {
      title: "Resumen final",
      highlight: true,
      text: (c) =>
        `${c.promo ? `La oferta actual es **${c.promo}**. ` : ""}Tu cita queda para el [día] a las [hora] en **${c.name}** (${c.address}). Te envío info por WhatsApp. ¿Alguna duda?`,
    },
  ],
};

const carillas: ScriptTemplate = {
  label: "Carillas",
  steps: [
    {
      title: "Saludo + Encaje + Ubicación",
      text: (c) =>
        `Hola **[Nombre]**, te llamo de **${c.name}** porque dejaste una solicitud para una cita de valoración gratuita de **carillas**, ¿correcto? ${c.location}`,
      note: "→ Si no conoce la zona: enviaremos ubicación por WhatsApp.",
    },
    {
      title: "Autoridad + Oferta",
      text: (c) => authorityOffer(c, "Esta llamada puede ser grabada por motivos de calidad."),
    },
    {
      title: "Motivo de la visita",
      text: () => "¿Qué es exactamente lo que te gustaría mejorar de tus dientes? ¿Color, forma, desgaste…?",
      note: "→ Resumir: «Perfecto, entonces vienes por ______.»",
    },
    {
      title: "Cualificación documental",
      text: (c) => `¿Qué documentación tienes disponible? Aceptamos: **${c.docs}**.`,
      note: docsNote,
      rebate: (c) =>
        `Te entiendo perfectamente, nos encantaría poder ayudarte. El tema es que para esta campaña específica trabajamos con una financiera que nos exige presentar **${c.docs}**. ¿Te aviso si cambian las condiciones? **(Finalizar)**`,
    },
    {
      title: "Cualificación económica",
      onlyIf: hasEcon,
      text: () => "¿Qué situación laboral o de ingresos tienes?",
      note: (c) => `Aceptamos:\n${econLines(c)}`,
      rebate: () =>
        "Te comprendo totalmente. Las entidades nos piden ingresos regulares. Lo dejamos anotado por si más adelante cambia tu situación. **(Finalizar)**",
    },
    {
      title: "Valor + Urgencia",
      text: (c) => `Perfecto.${c.promo ? ` La promoción de **${c.promo}** es para las primeras 10 reservas.` : ""}`,
    },
    { title: "Verificación de datos", text: () => "¿Me confirmas tu nombre y apellido?" },
    {
      title: "Agendamiento",
      text: () => "¿Te viene mejor por la mañana o por la tarde?",
      rebate: () => "Tengo otra opción en los próximos 3 días.",
    },
    {
      title: "Resumen final",
      highlight: true,
      text: (c) =>
        `${c.promo ? `Oferta: **${c.promo}**. ` : ""}Cita para el [día] a las [hora] en **${c.name}**. Te envío info por WhatsApp.`,
    },
  ],
};

const blanqueamiento: ScriptTemplate = {
  label: "Blanqueamiento",
  steps: [
    {
      title: "Saludo + Encaje + Ubicación",
      text: (c) =>
        `Hola **[Nombre]**, te llamo de **${c.name}** porque dejaste una solicitud para una cita de valoración gratuita de **blanqueamiento dental**, ¿correcto? ${c.location}`,
    },
    {
      title: "Autoridad + Oferta",
      text: (c) => authorityOffer(c, "Esta llamada puede ser grabada por motivos de calidad."),
    },
    {
      title: "Motivo de la visita",
      text: () => "¿Qué te gustaría mejorar con el blanqueamiento? ¿Aclarar manchas o mejorar el aspecto general?",
      note: "→ Resumir: «Perfecto, entonces vienes por ______.»",
    },
    {
      title: "Cualificación documental",
      text: (c) => `¿Qué documentación tienes? Aceptamos: **${c.docs}**.`,
      note: docsNote,
      rebate: (c) =>
        `Te entiendo perfectamente. Solo tramitamos con **${c.docs}** por exigencia de la financiera. ¿Te aviso si cambia? **(Finalizar)**`,
    },
    {
      title: "Valor + Urgencia",
      text: (c) =>
        c.promo
          ? `La promoción de **${c.promo}** es para las primeras 10 reservas.`
          : "Perfecto, procedemos a agendar tu cita.",
    },
    { title: "Verificación de datos", text: () => "¿Me confirmas tu nombre y apellido?" },
    { title: "Agendamiento", text: () => "¿Te viene mejor por la mañana o por la tarde?" },
    {
      title: "Resumen final",
      highlight: true,
      text: (c) =>
        `${c.promo ? `Oferta: **${c.promo}**. ` : ""}Cita el [día] a las [hora] en **${c.name}**. Te envío info por WhatsApp.`,
    },
  ],
};

const estetica: ScriptTemplate = {
  label: "Estética · FHOS Bioluminiscente",
  steps: [
    {
      title: "Saludo + Ubicación",
      text: (c) =>
        `Hola **[Nombre]**, te llamo de **${c.name}** porque dejaste una solicitud para una cita de valoración gratuita de **FHOS Bioluminiscente**, ¿correcto? ${c.location}`,
    },
    {
      title: "Pitch de valor",
      text: () =>
        "Esta llamada puede ser grabada por motivos de calidad.\n\nEl FHOS Bioluminiscente es un tratamiento innovador de bioestimulación facial que utiliza luz fría para activar el colágeno, mejorar la elasticidad de la piel y aportar un efecto rejuvenecedor visible desde la primera sesión.\n\nY la primera visita ahora mismo sigue siendo totalmente gratuita dentro de la campaña activa.",
    },
    {
      title: "Verificación de datos",
      text: () => "Antes de agendar, necesito confirmar tus datos. ¿Me confirmas tu nombre y apellido?",
    },
    {
      title: "Agendamiento",
      text: () => "¿Te viene mejor por la mañana o por la tarde?",
      rebate: () => "No pasa nada. Tengo otra opción en los próximos 3 días.",
    },
    {
      title: "Resumen final",
      highlight: true,
      text: (c) =>
        `Tu cita queda para el [día] a las [hora] en **${c.name}** (${c.address}). Te envío info por WhatsApp. ¿Alguna duda?`,
    },
  ],
};

const apnea: ScriptTemplate = {
  label: "Apnea del sueño",
  steps: [
    {
      title: "Saludo + Encaje + Ubicación",
      text: (c) =>
        `Hola **[Nombre]**, te llamo de **${c.name}**. Te contacto porque solicitaste una cita por internet para el tratamiento de Apnea del sueño.\n\n${c.location}`,
      note: "→ Si dice que no conoce la zona: No hay problema, le enviaremos la ubicación exacta y el enlace de Google Maps por WhatsApp.",
    },
    {
      title: "Mini pitch de autoridad + oferta + explicación de cita",
      text: () =>
        "Perfecto. Antes de seguir, te explico muy rápido:\nEsta llamada puede ser grabada por motivos de calidad.\n\nTe explico brevemente. La apnea del sueño es un problema que puede afectar al descanso, provocando síntomas como ronquidos, despertares durante la noche, cansancio durante el día o sensación de no haber descansado bien.\n\nEn la clínica contamos con especialistas que valoran este tipo de casos y estudian cada paciente de forma personalizada para conocer el origen del problema y recomendar el tratamiento más adecuado.\n\nLa primera cita consiste en una valoración gratuita donde se realiza el estudio del sueño, se analiza tu caso y se planifica el posible tratamiento.\n\nAdemás, por WhatsApp te enviaremos una imagen con las instrucciones de cómo prepararte para la cita, para que llegues con todo listo y el estudio se pueda realizar correctamente.",
    },
    {
      title: "Verificación de datos básicos",
      text: () =>
        "Antes de agendar, necesito confirmar tus datos para abrir bien tu historia clínica.\n\n¿Me confirmas tu nombre y apellido?",
      note: "→ Si solo da nombre: «¡Perfecto, [Nombre]! ¿Y me podrías facilitar también tus apellidos? Es para asegurarnos de que tu ficha quede registrada correctamente.»\n→ Actualización: «Perfecto, lo actualizo aquí.»",
    },
    {
      title: "Agendamiento",
      text: () => "¿Te viene mejor por la mañana o por la tarde?",
      note: "→ Ofrecer un único horario exacto dentro de las próximas 72h, según disponibilidad real.",
      rebate: () =>
        "No pasa nada. Tengo otra opción dentro de los próximos 3 días: [alternativa].\n\nSi prefieres una fecha más adelante, guardo tu número y te llamo dos días antes de la fecha que te interesa para darte un hueco.\n\n¿A qué hora te viene bien que te llame ese día?",
    },
    {
      title: "Cierre con resumen final",
      highlight: true,
      text: (c) =>
        `Perfecto, antes de finalizar te hago un resumen:\n\nTu cita queda programada para el [día] a las [hora], en **${c.name}** (${c.address}).\n\nAhora te envío por WhatsApp la ubicación e información de la cita para que lo tengas más cómodo.\n\n¿Tienes alguna duda rápida antes de que te lo mande?`,
    },
  ],
};

export const TREATMENT_TEMPLATES: Record<TreatmentKey, ScriptTemplate> = {
  implantes,
  ortodoncia,
  carillas,
  blanqueamiento,
  estetica,
  apnea,
};
