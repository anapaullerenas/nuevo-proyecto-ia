import type { StaticArchetype } from "@/lib/ai/static-machine";

export type CuratedStaticFormat = StaticArchetype & {
  version: string;
  thumbnail_path: string;
  short_description: string;
  use_when: string;
  visual_keys: string[];
  objectives: string[];
  required_evidence: StaticEvidence[];
  unlock_message?: string;
  prompt_template_ref: string;
  layouts: Record<StaticAspectRatio, StaticLayoutRecipe>;
  copy_limits: {
    headline_max_characters: number;
    support_max_characters: number;
    cta_max_characters: number;
  };
};

export type StaticAspectRatio = "1:1" | "4:5" | "9:16";
export type StaticEvidence = "testimonial" | "verified_numbers" | "before_after" | "price_comparison";
export type StaticLayoutRecipe = {
  composition: string;
  safe_zone: string;
  visual_scale: string;
};

export type BrandEvidence = Record<StaticEvidence, boolean>;

const sharedRules = [
  "Tomar la arquitectura visual de la referencia, nunca su categoría, marca, oferta, texto, colores o claims.",
  "Una idea principal, lectura en dos segundos, márgenes de 6-8% y al menos 30% de aire visual.",
  "Usar únicamente activos, beneficios y pruebas verdaderas de la marca activa.",
];

const BASE_CURATED_STATIC_FORMATS = [
  {
    id: "oferta_directa",
    name: "oferta_protagonista",
    label_visible: "Oferta protagonista",
    stage: "Conversión",
    thumbnail_path: "/archetypes/curated/oferta-protagonista.webp",
    short_description: "La propuesta se entiende primero; la evidencia visual y el CTA cierran la lectura.",
    use_when: "Lanzamientos, registros, reservas, bundles o promociones con una condición simple.",
    visual_keys: ["Oferta arriba", "Evidencia al centro", "CTA visible"],
    prompt_fragment: "Oferta comercial protagonista con headline breve en el tercio superior, una evidencia visual real en el centro —producto, persona, resultado, interfaz o experiencia— y un único CTA en el tercio inferior. Mostrar con claridad qué recibe la audiencia y bajo qué condición, sin convertir la pieza en un volante saturado.",
    structure: {
      reference_blueprint: {
        layout: "Composición vertical de tres niveles: oferta dominante, evidencia visual, acción.",
        hierarchy: ["beneficio u oferta", "evidencia principal", "condición y CTA"],
        product_treatment: "Activo real, persona, resultado o interfaz grande y reconocible; manos sólo si aportan contexto.",
        copy_pattern: "Una oferta de máximo dos líneas, una condición breve y un CTA.",
        density: "Media, con un solo sello opcional y aire alrededor del protagonista.",
        cta_behavior: "Botón sólo cuando la acción y la condición son inequívocas.",
      },
      estructura: {
        zona_superior: "Oferta o beneficio de entrada en tipografía dominante.",
        zona_media: "Oferta, resultado o activo protagonista con escala clara.",
        zona_inferior: "CTA único y condición breve sin letra microscópica.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Convertir la oferta en la primera lectura y hacer tangible lo que se recibe o consigue.",
        camara_y_encuadre: "Frontal limpio; protagonista visual entre 42% y 55% del lienzo.",
        superficie_y_entorno: "Fondo simple derivado de la identidad, sin decoraciones gratuitas.",
        props: "Sólo manos o un objeto funcional que explique el bundle.",
      },
      rules: sharedRules,
    },
  },
  {
    id: "beneficios_apilados",
    name: "beneficios_en_un_vistazo",
    label_visible: "Beneficios en un vistazo",
    stage: "Consideración",
    thumbnail_path: "/archetypes/curated/beneficios-vistazo.webp",
    short_description: "La oferta se rodea de razones de compra breves y fáciles de escanear.",
    use_when: "Una oferta necesita explicar de dos a cuatro beneficios concretos.",
    visual_keys: ["Oferta protagonista", "3-4 beneficios", "Jerarquía limpia"],
    prompt_fragment: "Oferta central representada por producto, persona, resultado, interfaz o experiencia, con máximo cuatro beneficios breves distribuidos en módulos consistentes alrededor. Cada apoyo debe tener cuatro palabras o menos y responder a una razón de compra distinta. Mantener mucha separación y una sola dirección visual.",
    structure: {
      reference_blueprint: {
        layout: "Protagonista visual central y apoyos laterales equilibrados.",
        hierarchy: ["nombre o promesa", "oferta representada", "beneficios escaneables"],
        product_treatment: "Producto, persona, resultado o interfaz fiel a los activos y la categoría real.",
        copy_pattern: "Headline corto y entre tres y cuatro apoyos de máximo cuatro palabras.",
        density: "Media-baja; todos los módulos comparten forma, tamaño y estilo.",
        cta_behavior: "Normalmente sin botón; la oferta y sus beneficios hacen la venta.",
      },
      estructura: {
        zona_superior: "Promesa o categoría en una sola línea fuerte.",
        zona_media: "Oferta o resultado central con beneficios alrededor.",
        zona_inferior: "Beneficio final o descriptor, sin repetir el headline.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer que la oferta se lea como la respuesta y los beneficios como evidencia.",
        camara_y_encuadre: "Frontal o 3/4, protagonista centrado ocupando cerca de la mitad del lienzo.",
        superficie_y_entorno: "Superficie, escena o fondo coherente con el uso de la oferta.",
        props: "Máximo un elemento relacionado con el contexto real de uso.",
      },
      rules: sharedRules,
    },
  },
  {
    id: "antes_despues_sutil",
    name: "antes_y_despues",
    label_visible: "Antes y después",
    stage: "Consideración",
    thumbnail_path: "/archetypes/curated/antes-despues.webp",
    short_description: "Dos estados comparables que muestran progreso sin exagerarlo.",
    use_when: "Existe evidencia real, comparable y permitida de una transformación visual.",
    visual_keys: ["Mismo encuadre", "Dos estados", "Resultado honesto"],
    prompt_fragment: "Comparación lado a lado con dos estados honestos y equivalentes. Etiquetas claras de antes y después, una promesa prudente y la oferta como respaldo secundario. Puede mostrar una escena, proceso, métrica, interfaz o resultado real; nunca dramatizar ni inventar evidencia.",
    structure: {
      reference_blueprint: {
        layout: "Dos marcos equivalentes en paralelo con etiquetas inequívocas.",
        hierarchy: ["tensión o promesa", "comparación visual", "oferta secundaria"],
        product_treatment: "Oferta o activo pequeño pero reconocible, sin tapar la evidencia.",
        copy_pattern: "Una línea de contexto y etiquetas descriptivas, sin claims absolutos.",
        density: "Baja; la comparación es el mensaje.",
        cta_behavior: "Opcional y discreto.",
      },
      estructura: {
        zona_superior: "Contexto breve de la transformación.",
        zona_media: "Dos imágenes comparables con etiquetas antes/después.",
        zona_inferior: "Oferta o resultado prudente y CTA opcional.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer creíble la transformación mediante consistencia visual, no dramatización.",
        camara_y_encuadre: "Misma distancia, focal, iluminación y recorte en ambos estados.",
        superficie_y_entorno: "Fondo neutro que no altere la percepción del resultado.",
        props: "Ninguno salvo un activo real que conecte ambos estados.",
      },
      rules: [...sharedRules, "No generar evidencia clínica ni cambios corporales ficticios."],
    },
  },
  {
    id: "problema_solucion",
    name: "problema_solucion",
    label_visible: "Problema → solución",
    stage: "Descubrimiento",
    thumbnail_path: "/archetypes/curated/problema-solucion.webp",
    short_description: "Divide el lienzo para que la tensión y la respuesta se entiendan de inmediato.",
    use_when: "La audiencia reconoce bien el problema y necesita ver una salida concreta.",
    visual_keys: ["Tensión clara", "Respuesta humana", "Contraste lateral"],
    prompt_fragment: "Composición dividida en dos mitades: a la izquierda la tensión cotidiana expresada con frases breves y a la derecha una escena creíble que representa la solución mediante persona, resultado, proceso, interfaz o producto real. El contraste debe sentirse narrativo, no como una tabla técnica.",
    structure: {
      reference_blueprint: {
        layout: "Split vertical asimétrico: problema textual y solución visual.",
        hierarchy: ["problema", "persona o resultado", "oferta"],
        product_treatment: "Oferta integrada a una situación real mediante el activo adecuado a su categoría.",
        copy_pattern: "Una tensión principal y máximo tres síntomas o fricciones breves.",
        density: "Media sólo del lado problema; lado solución más limpio.",
        cta_behavior: "CTA opcional al final de la lectura.",
      },
      estructura: {
        zona_superior: "Rótulos problema y solución claramente diferenciados.",
        zona_media: "Fricciones breves frente a una escena humana aspiracional.",
        zona_inferior: "Oferta real y cierre de confianza.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Contraponer la carga del problema con la sencillez de la solución.",
        camara_y_encuadre: "Split 50/50 o 45/55 con persona, resultado, interfaz o activo principal visible.",
        superficie_y_entorno: "Situación cotidiana congruente con el avatar.",
        props: "Sólo objetos que pertenezcan a la rutina mostrada.",
      },
      rules: sharedRules,
    },
  },
  {
    id: "comparacion_ancla",
    name: "comparativa_de_valor",
    label_visible: "Comparativa de valor",
    stage: "Conversión",
    thumbnail_path: "/archetypes/curated/comparativa-valor.webp",
    short_description: "Reencuadra el precio comparándolo con un gasto o alternativa reconocible.",
    use_when: "La principal objeción es el precio y existe una comparación justa y verificable.",
    visual_keys: ["Dos alternativas", "Precio ancla", "Decisión simple"],
    prompt_fragment: "Comparativa visual de dos alternativas mediante tarjetas equivalentes. Presentar un gasto o alternativa conocida frente al valor de la oferta, con cifras verdaderas y una conclusión clara. La composición debe ayudar a decidir sin atacar ni nombrar competidores.",
    structure: {
      reference_blueprint: {
        layout: "Headline superior y dos tarjetas inclinadas o paralelas con el mismo peso visual.",
        hierarchy: ["comparación", "dos alternativas", "conclusión/CTA"],
        product_treatment: "Oferta representada de forma completa dentro de su tarjeta de valor.",
        copy_pattern: "Un precio o costo por opción y una conclusión corta.",
        density: "Baja; evitar listas largas y letra pequeña.",
        cta_behavior: "Botón corto opcional bajo la comparación.",
      },
      estructura: {
        zona_superior: "Pregunta o comparación de valor.",
        zona_media: "Dos tarjetas equivalentes con precio y visual.",
        zona_inferior: "Conclusión y CTA breve.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer que el valor se entienda al comparar dos decisiones reales.",
        camara_y_encuadre: "Frontal gráfico con fotografías naturales dentro de las tarjetas.",
        superficie_y_entorno: "Fondo sobrio de marca que sostenga la comparación.",
        props: "Ninguno fuera de los dos elementos comparados.",
      },
      rules: [...sharedRules, "Toda cifra comparativa debe venir del brief o de datos reales de la marca."],
    },
  },
  {
    id: "prueba_social_flotante",
    name: "testimonio_verificado",
    label_visible: "Testimonio verificado",
    stage: "Retargeting",
    thumbnail_path: "/archetypes/curated/testimonio-verificado.webp",
    short_description: "Una voz real lidera la pieza y la oferta aparece como respuesta tangible.",
    use_when: "Hay una reseña real, específica y autorizada que resuelve una objeción.",
    visual_keys: ["Cita dominante", "Prueba real", "Producto secundario"],
    prompt_fragment: "Testimonio auténtico como protagonista dentro de una tarjeta limpia, con nombre o señal de compra verificada sólo si existe. Oferta, resultado o activo real debajo como respaldo y un único CTA. Nunca inventar nombres, estrellas, porcentajes, resultados ni reseñas.",
    structure: {
      reference_blueprint: {
        layout: "Gran cita superior, tarjeta de reseña central, oferta y CTA en la base.",
        hierarchy: ["frase humana", "reseña", "oferta", "acción"],
        product_treatment: "Oferta, resultado o activo sobrio, secundario a la voz del testimonio.",
        copy_pattern: "Cita breve más una reseña específica; máximo dos bloques.",
        density: "Media-baja, con abundante espacio neutro.",
        cta_behavior: "Un botón simple después de la prueba.",
      },
      estructura: {
        zona_superior: "Frase principal tomada de una reseña real.",
        zona_media: "Testimonio con atribución verificable.",
        zona_inferior: "Oferta representada y CTA único.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Dar protagonismo a una experiencia humana específica, no a una promesa de marca.",
        camara_y_encuadre: "Composición frontal editorial, evidencia de la oferta en escala media.",
        superficie_y_entorno: "Fondo cálido, neutro y creíble.",
        props: "Ninguno; la reseña y la evidencia de la oferta bastan.",
      },
      rules: [...sharedRules, "Si no existe testimonio verificable, convertir el formato en cita de marca sin fingir clientes."],
    },
  },
  {
    id: "ugc_casual",
    name: "ugc_demostracion",
    label_visible: "UGC demostración",
    stage: "Descubrimiento",
    thumbnail_path: "/archetypes/curated/ugc-demostracion.webp",
    short_description: "Una persona demuestra la oferta en una escena real con anotaciones mínimas.",
    use_when: "Se busca cercanía, demostración de uso o proceso y sensación de recomendación orgánica.",
    visual_keys: ["Persona real", "Oferta en acción", "Anotaciones mínimas"],
    prompt_fragment: "Fotografía UGC creíble de una persona adulta usando, explicando o demostrando la oferta en contexto real. Puede mostrar producto, proceso, interfaz, espacio o resultado según la categoría. Añadir como máximo dos anotaciones editoriales breves que aclaren uso o beneficio, sin inventar activos.",
    structure: {
      reference_blueprint: {
        layout: "Fotografía humana a sangre con dos pequeñas cajas o flechas de apoyo.",
        hierarchy: ["persona/acción", "oferta", "anotaciones"],
        product_treatment: "Oferta integrada a la acción mediante un activo, interfaz, proceso o producto real.",
        copy_pattern: "Un hook conversacional y hasta dos apoyos breves.",
        density: "Baja; conservar la sensación de contenido real.",
        cta_behavior: "Texto discreto, no botón de ecommerce rígido.",
      },
      estructura: {
        zona_superior: "Hook conversacional sobre la escena.",
        zona_media: "Persona adulta usando, explicando o demostrando la oferta.",
        zona_inferior: "Una explicación breve o CTA nativo.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Capturar un momento de uso que parezca vivido, no producido por una plantilla.",
        camara_y_encuadre: "Primer plano móvil, ligero ángulo espontáneo y manos anatómicamente correctas.",
        superficie_y_entorno: "Casa, exterior o rutina real de la audiencia.",
        props: "Sólo objetos que ya existirían en esa escena.",
      },
      rules: sharedRules,
    },
  },
  {
    id: "busqueda_solucion",
    name: "busqueda_respuesta",
    label_visible: "Búsqueda → respuesta",
    stage: "Descubrimiento",
    thumbnail_path: "/archetypes/curated/busqueda-respuesta.webp",
    short_description: "Convierte una pregunta real de la audiencia en una respuesta visual de la oferta.",
    use_when: "La audiencia expresa su necesidad como una búsqueda, duda o pregunta concreta.",
    visual_keys: ["Pregunta real", "Respuesta clara", "Escena contextual"],
    prompt_fragment: "Una búsqueda o pregunta real de la audiencia aparece arriba y la oferta responde visualmente debajo mediante producto, persona, resultado, interfaz o proceso. La barra debe ser una convención editorial simple, no una copia exacta de Google ni una interfaz engañosa.",
    structure: {
      reference_blueprint: {
        layout: "Pregunta superior en cápsula editorial y respuesta fotográfica debajo.",
        hierarchy: ["búsqueda", "solución", "oferta representada"],
        product_treatment: "Activo, resultado, interfaz, persona o producto protagonista dentro de una escena coherente.",
        copy_pattern: "Una pregunta natural y una etiqueta de respuesta.",
        density: "Baja; la pregunta y la imagen cuentan todo.",
        cta_behavior: "Opcional; la solución puede cerrar sin botón.",
      },
      estructura: {
        zona_superior: "Pregunta o búsqueda auténtica del avatar.",
        zona_media: "Rótulo de solución y representación real de la oferta.",
        zona_inferior: "Entorno o resultado que completa la respuesta.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer que la marca se perciba como respuesta directa a una pregunta existente.",
        camara_y_encuadre: "Frontal con la pregunta aislada y la respuesta visual bien anclada.",
        superficie_y_entorno: "Contexto real relacionado con el deseo de la búsqueda.",
        props: "Máximo un elemento que haga reconocible la rutina.",
      },
      rules: [...sharedRules, "No replicar logos, pestañas o resultados de motores de búsqueda."],
    },
  },
  {
    id: "producto_heroe_editorial",
    name: "producto_heroe",
    label_visible: "Producto héroe",
    stage: "Consideración",
    thumbnail_path: "/archetypes/curated/producto-heroe.webp",
    short_description: "El empaque domina la escena y una sola promesa explica por qué importa.",
    use_when: "Hay un producto visualmente fuerte, novedad, ingrediente o beneficio diferenciador.",
    visual_keys: ["Packshot grande", "Una promesa", "Textura premium"],
    prompt_fragment: "Producto real en escala heroica con fotografía comercial táctil, una promesa dominante y hasta tres datos o beneficios reales. La escena debe sentirse como campaña premium, con reflejos, líquidos, ingredientes o superficie sólo cuando tengan relación verdadera con el producto.",
    structure: {
      reference_blueprint: {
        layout: "Headline superior, producto de gran escala en centro/base y apoyos mínimos.",
        hierarchy: ["promesa", "producto", "datos/beneficios"],
        product_treatment: "Packshot extremadamente fiel con volumen, textura y sombra de contacto.",
        copy_pattern: "Una promesa corta y hasta tres datos concretos.",
        density: "Baja; el producto ocupa entre 50% y 65%.",
        cta_behavior: "Generalmente sin botón; puede cerrar con descriptor breve.",
      },
      estructura: {
        zona_superior: "Promesa principal con una palabra acentuada.",
        zona_media: "Producto real heroico y textura relevante.",
        zona_inferior: "Hasta tres datos o beneficios verificables.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Convertir el producto en objeto de deseo mediante escala, materialidad y color.",
        iluminacion: "Luz comercial direccional con reflejos controlados y sombras físicas.",
        camara_y_encuadre: "Ángulo frontal bajo o 3/4, empaque dominante sin deformación.",
        superficie_y_entorno: "Set de estudio de una sola decisión cromática.",
        props: "Ingredientes o elementos funcionales reales, máximo dos.",
      },
      rules: sharedRules,
    },
  },
  {
    id: "post_its",
    name: "oferta_nativa",
    label_visible: "Oferta nativa",
    stage: "Retargeting",
    thumbnail_path: "/archetypes/curated/oferta-nativa.webp",
    short_description: "La promoción vive dentro de una escena personal y se siente descubierta, no anunciada.",
    use_when: "Promociones breves, urgencia o bundles que necesitan una lectura más humana.",
    visual_keys: ["Escena real", "Notas físicas", "Urgencia creíble"],
    prompt_fragment: "Escena cotidiana relacionada con la marca y máximo tres notas físicas tipo post-it que comuniquen oferta, beneficio y vigencia. La oferta puede representarse con persona, resultado, interfaz, espacio o producto. Las notas deben verse integradas al entorno con perspectiva y sombra real; nunca como tarjetas digitales flotantes.",
    structure: {
      reference_blueprint: {
        layout: "Fotografía vertical con la oferta representada en primer plano y notas repartidas en profundidad.",
        hierarchy: ["escena", "oferta", "mensaje manuscrito"],
        product_treatment: "Oferta integrada a un escritorio, espacio de trabajo, punto de venta, interfaz o rutina relevante.",
        copy_pattern: "Hasta tres notas: qué, cuánto y hasta cuándo.",
        density: "Media, compensada con una zona amplia sin texto.",
        cta_behavior: "La nota de urgencia funciona como llamada; evitar botón adicional.",
      },
      estructura: {
        zona_superior: "Una nota de apertura o urgencia.",
        zona_media: "Oferta dentro de una escena cotidiana real.",
        zona_inferior: "Nota de porcentaje, beneficio o vigencia.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer que la oferta parezca una anotación encontrada dentro de la rutina.",
        camara_y_encuadre: "Plano cercano con perspectiva real del entorno elegido.",
        superficie_y_entorno: "Escritorio, estudio, punto de venta, hogar o contexto real de uso con luz coherente.",
        props: "Notas físicas y objetos propios de la escena, sin decorado excesivo.",
      },
      rules: sharedRules,
    },
  },
];

const DEFAULT_LAYOUTS: Record<StaticAspectRatio, StaticLayoutRecipe> = {
  "1:1": {
    composition: "Jerarquía compacta y centrada; máximo tres niveles de lectura.",
    safe_zone: "8% libre en los cuatro bordes.",
    visual_scale: "El protagonista ocupa 42-56% del lienzo.",
  },
  "4:5": {
    composition: "Lectura vertical: hook, protagonista y cierre; aire entre niveles.",
    safe_zone: "8% lateral, 7% superior y 9% inferior.",
    visual_scale: "El protagonista ocupa 45-60% del lienzo.",
  },
  "9:16": {
    composition: "Composición en la franja central, sin información crítica en extremos.",
    safe_zone: "14% superior, 20% inferior y 7% lateral completamente libres.",
    visual_scale: "El protagonista ocupa 38-52% de la zona segura.",
  },
};

const FORMAT_RULES: Record<string, Partial<CuratedStaticFormat>> = {
  oferta_directa: { objectives: ["Conversión", "Retargeting"], required_evidence: [] },
  beneficios_apilados: { objectives: ["Consideración", "Conversión"], required_evidence: [] },
  antes_despues_sutil: {
    objectives: ["Consideración", "Retargeting"],
    required_evidence: ["before_after"],
    unlock_message: "Agrega un caso real de antes y después para desbloquear este estilo.",
  },
  problema_solucion: { objectives: ["Descubrimiento", "Consideración"], required_evidence: [] },
  comparacion_ancla: {
    objectives: ["Conversión", "Retargeting"],
    required_evidence: ["price_comparison"],
    unlock_message: "Agrega un precio o comparación verificable para desbloquear este estilo.",
  },
  prueba_social_flotante: {
    objectives: ["Consideración", "Retargeting"],
    required_evidence: ["testimonial"],
    unlock_message: "Agrega un testimonio real a la memoria de marca para desbloquear este estilo.",
  },
  ugc_casual: { objectives: ["Descubrimiento", "Consideración"], required_evidence: [] },
  busqueda_solucion: { objectives: ["Descubrimiento", "Consideración"], required_evidence: [] },
  producto_heroe_editorial: { objectives: ["Descubrimiento", "Consideración"], required_evidence: [] },
  post_its: { objectives: ["Conversión", "Retargeting"], required_evidence: [] },
};

export const CURATED_STATIC_FORMATS: CuratedStaticFormat[] = BASE_CURATED_STATIC_FORMATS.map((format) => ({
  ...format,
  version: "1.0.0",
  objectives: FORMAT_RULES[format.id]?.objectives || [format.stage],
  required_evidence: FORMAT_RULES[format.id]?.required_evidence || [],
  unlock_message: FORMAT_RULES[format.id]?.unlock_message,
  prompt_template_ref: `static/${format.id}/v1`,
  layouts: DEFAULT_LAYOUTS,
  copy_limits: {
    headline_max_characters: format.id === "prueba_social_flotante" ? 74 : 46,
    support_max_characters: 76,
    cta_max_characters: 20,
  },
}));

export function detectBrandEvidence(brand: {
  offer?: string | null;
  strategic_context?: Record<string, unknown> | null;
}): BrandEvidence {
  const source = `${brand.offer || ""} ${JSON.stringify(brand.strategic_context || {})}`.toLowerCase();
  return {
    testimonial: /(testimonio|reseña|review|cliente dijo|caso de cliente|quote)/i.test(source),
    verified_numbers: /(\d+[.,]?\d*\s?%|métrica|dato verificado|resultados?)/i.test(source),
    before_after: /(antes y después|antes\/después|transformación|caso de éxito)/i.test(source),
    price_comparison: /(precio|cuesta|ahorra|ahorro|comparado con|vs\.?|alternativa)/i.test(source),
  };
}

export function isStaticFormatUnlocked(format: CuratedStaticFormat, evidence: BrandEvidence) {
  return format.required_evidence.every((requirement) => evidence[requirement]);
}

export function selectAutomaticStaticFormat({
  stage,
  intent,
  evidence,
  recentArchetypes = [],
  performance = {},
}: {
  stage: string;
  intent: string;
  evidence: BrandEvidence;
  recentArchetypes?: string[];
  performance?: Record<string, number>;
}) {
  const eligible = CURATED_STATIC_FORMATS.filter((format) => isStaticFormatUnlocked(format, evidence));
  const coldStartDefaults: Record<string, string> = {
    Descubrimiento: "problema_solucion",
    Consideración: "beneficios_apilados",
    Conversión: "oferta_directa",
    Retargeting: evidence.testimonial ? "prueba_social_flotante" : "post_its",
  };
  const normalizedIntent = intent.toLowerCase();
  const scored = eligible.map((format) => {
    let score = format.objectives.includes(stage) ? 40 : 0;
    if (format.id === coldStartDefaults[stage]) score += 12;
    if (/testimonio|reseña|confianza/.test(normalizedIntent) && format.id === "prueba_social_flotante") score += 28;
    if (/precio|oferta|promoción|descuento|venta/.test(normalizedIntent) && ["oferta_directa", "comparacion_ancla", "post_its"].includes(format.id)) score += 18;
    if (/problema|solución|dolor|frustr/.test(normalizedIntent) && format.id === "problema_solucion") score += 20;
    if (/beneficio|explicar|ventaja/.test(normalizedIntent) && format.id === "beneficios_apilados") score += 18;
    score += Math.max(-20, Math.min(20, performance[format.id] || 0));
    score -= recentArchetypes.slice(0, 5).filter((id) => id === format.id).length * 15;
    return { format, score };
  });
  scored.sort((a, b) => b.score - a.score || a.format.id.localeCompare(b.format.id));
  return scored[0]?.format || CURATED_STATIC_FORMATS[0];
}

export function getCuratedStaticFormat(id?: string | null) {
  return CURATED_STATIC_FORMATS.find((format) => format.id === id) || null;
}

export function staticFormatReferencePayload(id?: string | null) {
  const format = getCuratedStaticFormat(id);
  if (!format) return null;
  return {
    id: format.id,
    nombre: format.label_visible,
    referencia_visual: format.thumbnail_path,
    descripcion: format.short_description,
    ideal_para: format.use_when,
    claves_visuales: format.visual_keys,
    receta: format.structure,
    regla: "Usar la arquitectura, jerarquía y ritmo; nunca copiar categoría, marca, oferta, texto, identidad o claims de la referencia.",
  };
}
