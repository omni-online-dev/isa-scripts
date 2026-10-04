/**
 * Guiones propios de una clínica, heredados de la app anterior.
 *
 * OJO: llevan direcciones y precios escritos a mano, que NO se actualizan desde la
 * Master. Son deuda conocida (docs/adr/0001): lo deseable es que estos datos pasen a
 * la ficha y estos guiones desaparezcan.
 */
import type { TreatmentKey } from "../../schema";
import type { ScriptTemplate } from "../types";
import { estricto } from "./variants";

const fonseca: ScriptTemplate = {
  label: "Implantes (Fonseca)",
  steps: [
    {
      title: "Saludo + Ubicación",
      text: () =>
        "Hola **[Nombre]**, te llamo de **Clínica Dental Fonseca y Obando** porque dejaste una solicitud para una cita de valoración gratuita de **implantes dentales**, ¿correcto? Estamos ubicados en la **Calle del General Ricardos, 138**. ¿La zona te suena?",
      note: "→ Si no conoce: enviaremos ubicación por WhatsApp.",
    },
    {
      title: "Autoridad + Oferta",
      text: () =>
        "Esta llamada puede ser grabada por motivos de calidad.\n\nAhora mismo tenemos una promoción vigente de **prótesis provisional gratuita** con tu tratamiento, válida para las primeras reservas.",
    },
    {
      title: "Motivo de la visita",
      text: () => "¿Qué es exactamente lo que necesitas? ¿Una rehabilitación completa o solo una pieza en concreto?",
      note: "→ Resumir en 1 frase.",
    },
    {
      title: "Cualificación documental",
      text: () => "Para abrirte la ficha médica, ¿tienes DNI, NIE…?",
      rebate: () =>
        "Te entiendo perfectamente, nos encantaría poder ayudarte. El tema es que para esta campaña específica trabajamos con una financiera que nos exige presentar documentación válida en vigor. ¿Te aviso si cambian las condiciones? **(Finalizar)**",
    },
    {
      title: "Cualificación económica (camuflada)",
      text: () =>
        "Para mirar qué hueco nos queda libre con el especialista... **¿eres de los que trabaja de mañana o lo haces por la tarde?**",
      note: "→ Si confirma que trabaja: «¡Perfecto! En caso de que te agrade el presupuesto, contamos con financiación. ¿Recibes ingresos por nómina o eres autónomo?»\n→ Si no tiene ingresos: preguntar si un familiar podría figurar como titular.",
    },
    {
      title: "Valor + Urgencia",
      text: () =>
        "Perfecto, entonces sí puedes optar tanto al diagnóstico como a la financiación. La promoción de prótesis provisional gratuita es para las primeras 10 reservas.",
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
      text: () =>
        "La oferta es prótesis provisional gratuita con tu tratamiento. Tu cita queda para el [día] a las [hora] en **Fonseca y Obando** (Calle del General Ricardos, 138). Te envío info por WhatsApp.",
    },
  ],
};

const ardenne: ScriptTemplate = {
  label: "Implantes (Ardenne Dental)",
  steps: [
    {
      title: "Saludo + Encaje + Ubicación",
      text: () =>
        "Hola **[Nombre]**, te llamo de **Ardenne Dental** porque dejaste una solicitud para una cita de valoración gratuita de **implantes dentales**, ¿correcto?\n\nEstamos ubicados en **Avenida España, 61, en Segur de Calafell**. ¿La zona te suena?\n\nAntes de seguir, te comento que esta llamada puede ser grabada por motivos de calidad.",
      note: "→ Si no conoce la zona: No pasa nada, luego te enviamos la ubicación exacta por WhatsApp para que lo tengas más fácil.",
    },
    {
      title: "Explicación breve de la llamada",
      text: () =>
        "Te explico rápidamente, **[Nombre]**.\n\nEn Ardenne Dental estamos gestionando solicitudes de pacientes interesados en implantes dentales y ahora mismo contamos con precios promocionales en varios tratamientos. Además, la primera valoración es gratuita.",
      note: "Importante: en esta clínica no cerramos fecha y hora definitiva. Solo confirmamos si el precio encaja para el lead y recepción de la clínica confirma disponibilidad de cita.",
    },
    {
      title: "Motivo de la visita",
      text: () =>
        "Para orientarte bien, ¿qué es exactamente lo que necesitas?\n\n¿Te falta una pieza concreta, varias piezas, o estás buscando una rehabilitación más completa?",
      note: "→ Escuchar respuesta y resumir: «Perfecto, entonces en tu caso sería ______.»",
    },
    {
      title: "Cantidad aproximada de piezas",
      text: () =>
        "Y más o menos, para ubicarte mejor, ¿cuántas piezas te faltan o cuántas zonas te gustaría tratar?",
      note: "→ Si no lo sabe: «No pasa nada, es normal. En la valoración el doctor lo revisa con exactitud, pero te lo pregunto para poder orientarte con el rango de precios antes de que te contacte recepción.»",
    },
    {
      title: "Comunicar precio según el caso",
      text: () =>
        "Según lo que me comentas, te puedo orientar con los precios promocionales actuales:\n\n**Si necesita una pieza individual:**\nPara una pieza individual, el implante está en promoción de **1.199 € a 855 €**.\nLa funda sobre implante está en promoción de **599 € a 486 €**.\n\n**Si necesita 2 implantes con sobredentadura:**\nPara el tratamiento de **2 implantes con sobredentadura**, el precio promocional es de **2.835 €**. Antes estaba en 3.199 €.\n\n**Si necesita 4 implantes con sobredentadura:**\nPara **4 implantes con sobredentadura y sistema Locator**, el precio promocional es de **4.650 €**. Antes estaba en 5.650 €.\n\n**Si necesita rehabilitación fija con 6 implantes:**\nPara una rehabilitación de **6 implantes con 12 fundas de metal y cerámica** sobre implantes, el precio promocional es de **10.960 €**. Antes estaba en 13.000 €. Este tratamiento no incluye provisional.\n\n**Si necesita rehabilitación fija con 8 implantes:**\nPara una rehabilitación de **8 implantes con 12 fundas de metal y cerámica** sobre implantes, el precio promocional es de **12.670 €**. Antes estaba en 15.000 €. Este tratamiento no incluye provisional.",
    },
    {
      title: "Aclaración importante: no hay financiación",
      text: () =>
        "En este caso, Ardenne Dental **no dispone de financiación** para esta promoción, por lo que el tratamiento tendría que abonarse de forma particular, según las condiciones que te expliquen directamente en la clínica.",
    },
    {
      title: "Cualificación por capacidad real de pago",
      text: () =>
        "Teniendo en cuenta que el tratamiento estaría aproximadamente en **[precio según caso]**, y que no hay financiación, ¿crees que podrías asumirlo de forma particular si el diagnóstico confirma que ese es el tratamiento que necesitas?",
      note: "→ Si puede asumirlo: «Perfecto, recepción te contactará en breve para revisar disponibilidad y confirmarte la cita de valoración gratuita.»\n→ Si tiene dudas: «Lo entiendo perfectamente, es una decisión importante. Si el doctor confirma que el tratamiento está en ese rango, ¿crees que podrías organizarte para asumirlo?»\n→ Si necesita financiación: «Te lo comento con total transparencia: Ardenne Dental no trabaja con financiación para esta promoción, por lo que tendría que pagarse de forma particular.»",
    },
    {
      title: "Confirmación de datos básicos",
      highlight: true,
      text: () =>
        "Antes de pasar tu solicitud a recepción, necesito confirmar tus datos para dejar bien registrada la información.\n\n¿Me confirmas tu nombre y apellidos, por favor?\n\n¿Me indicas una fecha y hora aproximada en la que podrías acudir?",
      note: "→ No prometer hueco definitivo. Recepción confirmará fecha y hora según disponibilidad.",
    },
  ],
  rebuttals: [
    {
      label: "Necesita financiación",
      response:
        "Entiendo. En ese caso te lo comento con total transparencia: Ardenne Dental no trabaja con financiación para esta promoción, por lo que el tratamiento tendría que pagarse de forma particular. Si necesitas financiarlo obligatoriamente, probablemente esta opción no encaje contigo ahora mismo. Si cambian las condiciones, te contactaremos nuevamente.",
      cierre: "¿Crees que podrías asumirlo de forma particular o ahora mismo dependerías totalmente de financiación?",
    },
    {
      label: "Pregunta si puede pagar poco a poco",
      response:
        "Ahora mismo no tenemos opción de financiación externa ni cuotas gestionadas por la clínica. Lo que sí puede hacer recepción es explicarte las condiciones concretas de pago, pero no sería una financiación como tal.",
      cierre: "Teniendo esto en cuenta, ¿crees que podría encajarte si el diagnóstico confirma ese tratamiento?",
    },
  ],
};

/**
 * Guion propio por clínica y tratamiento. La clave es el `id` de la clínica
 * (slug del nombre de su ficha en la Master).
 */
export const CLINIC_SCRIPTS: Record<string, Partial<Record<TreatmentKey, { id: string; template: ScriptTemplate }>>> = {
  "clinica-dental-fonseca-y-obando": { implantes: { id: "clinica:fonseca", template: fonseca } },
  "ardenne-dental": { implantes: { id: "clinica:ardenne", template: ardenne } },
  // Usaban la variante estricta en la app anterior y la Master las marca como «Selectivo».
  castelldent: { implantes: { id: "estricto", template: estricto } },
  "marina-dental": { implantes: { id: "estricto", template: estricto } },
  "clinica-dental-soniadent": { implantes: { id: "estricto", template: estricto } },
};
