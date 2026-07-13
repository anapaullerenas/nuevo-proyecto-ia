import type { StaticArchetype } from "@/lib/ai/static-machine";

export type CuratedStaticFormat = StaticArchetype & {
  thumbnail_path: string;
  short_description: string;
  use_when: string;
  visual_keys: string[];
};

const sharedRules = [
  "Tomar la arquitectura visual de la referencia, nunca su marca, producto, texto, colores o claims.",
  "Una idea principal, lectura en dos segundos, márgenes de 6-8% y al menos 30% de aire visual.",
  "Usar únicamente activos, beneficios y pruebas verdaderas de la marca activa.",
];

export const CURATED_STATIC_FORMATS: CuratedStaticFormat[] = [
  {
    id: "oferta_directa",
    name: "oferta_protagonista",
    label_visible: "Oferta protagonista",
    stage: "Conversión",
    thumbnail_path: "/archetypes/curated/oferta-protagonista.webp",
    short_description: "La promoción se entiende primero; el producto y el CTA cierran la lectura.",
    use_when: "Lanzamientos, bundles, regalo con compra o promociones con una condición simple.",
    visual_keys: ["Oferta arriba", "Producto al centro", "CTA visible"],
    prompt_fragment: "Oferta comercial protagonista con headline breve en el tercio superior, producto o bundle real sostenido o presentado en el centro y un único CTA ancho en el tercio inferior. Mostrar con claridad qué recibe la clienta y bajo qué condición, sin convertir la pieza en un volante saturado.",
    structure: {
      reference_blueprint: {
        layout: "Composición vertical de tres niveles: oferta dominante, producto tangible, acción.",
        hierarchy: ["beneficio u oferta", "producto/kit", "condición y CTA"],
        product_treatment: "Producto real grande, limpio y reconocible; manos sólo si aportan escala y deseo.",
        copy_pattern: "Una oferta de máximo dos líneas, una condición breve y un CTA.",
        density: "Media, con un solo sello opcional y aire alrededor del producto.",
        cta_behavior: "Botón sólo cuando la acción y la condición son inequívocas.",
      },
      estructura: {
        zona_superior: "Oferta o beneficio de entrada en tipografía dominante.",
        zona_media: "Producto, bundle o regalo protagonista con escala real.",
        zona_inferior: "CTA único y condición breve sin letra microscópica.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Convertir la oferta en la primera lectura y hacer tangible todo lo que se recibe.",
        camara_y_encuadre: "Frontal limpio; producto entre 42% y 55% del lienzo.",
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
    short_description: "Producto héroe rodeado por razones de compra breves y fáciles de escanear.",
    use_when: "El producto necesita explicar de dos a cuatro beneficios concretos.",
    visual_keys: ["Producto héroe", "3-4 beneficios", "Jerarquía limpia"],
    prompt_fragment: "Producto héroe central con máximo cuatro beneficios breves distribuidos en módulos consistentes alrededor. Cada apoyo debe tener cuatro palabras o menos y apuntar a una razón de compra distinta. Mantener el empaque intacto, mucha separación y una sola dirección fotográfica.",
    structure: {
      reference_blueprint: {
        layout: "Producto vertical central y apoyos laterales equilibrados.",
        hierarchy: ["nombre o promesa", "producto", "beneficios escaneables"],
        product_treatment: "Packshot húmedo, táctil o editorial, siempre fiel al activo real.",
        copy_pattern: "Headline corto y entre tres y cuatro apoyos de máximo cuatro palabras.",
        density: "Media-baja; todos los módulos comparten forma, tamaño y estilo.",
        cta_behavior: "Normalmente sin botón; el producto y los beneficios hacen la venta.",
      },
      estructura: {
        zona_superior: "Promesa o categoría en una sola línea fuerte.",
        zona_media: "Producto real central con beneficios alrededor.",
        zona_inferior: "Beneficio final o descriptor, sin repetir el headline.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer que el producto se lea como la respuesta y los beneficios como evidencia.",
        camara_y_encuadre: "Frontal o 3/4, producto centrado ocupando cerca de la mitad del lienzo.",
        superficie_y_entorno: "Superficie o fondo coherente con el uso del producto.",
        props: "Máximo un prop relacionado con uso o ingrediente real.",
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
    prompt_fragment: "Comparación lado a lado con dos estados honestos, misma luz, escala, ángulo y recorte. Etiquetas claras de antes y después, una promesa prudente y el producto como respaldo secundario. No dramatizar, suavizar ni inventar resultados.",
    structure: {
      reference_blueprint: {
        layout: "Dos marcos equivalentes en paralelo con etiquetas inequívocas.",
        hierarchy: ["tensión o promesa", "comparación visual", "producto/oferta secundaria"],
        product_treatment: "Producto pequeño pero reconocible, sin tapar la evidencia.",
        copy_pattern: "Una línea de contexto y etiquetas descriptivas, sin claims absolutos.",
        density: "Baja; la comparación es el mensaje.",
        cta_behavior: "Opcional y discreto.",
      },
      estructura: {
        zona_superior: "Contexto breve de la transformación.",
        zona_media: "Dos imágenes comparables con etiquetas antes/después.",
        zona_inferior: "Producto o resultado prudente y CTA opcional.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer creíble la transformación mediante consistencia visual, no dramatización.",
        camara_y_encuadre: "Misma distancia, focal, iluminación y recorte en ambos estados.",
        superficie_y_entorno: "Fondo neutro que no altere la percepción del resultado.",
        props: "Ninguno salvo el producto como puente.",
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
    prompt_fragment: "Composición dividida en dos mitades: a la izquierda la tensión cotidiana expresada con frases breves y a la derecha una escena humana creíble usando o mostrando el producto como solución. El contraste debe sentirse narrativo, no como una tabla técnica.",
    structure: {
      reference_blueprint: {
        layout: "Split vertical asimétrico: problema textual y solución visual.",
        hierarchy: ["problema", "persona/resultado", "producto"],
        product_treatment: "Producto en mano o integrado a la rutina, nunca flotando.",
        copy_pattern: "Una tensión principal y máximo tres síntomas o fricciones breves.",
        density: "Media sólo del lado problema; lado solución más limpio.",
        cta_behavior: "CTA opcional al final de la lectura.",
      },
      estructura: {
        zona_superior: "Rótulos problema y solución claramente diferenciados.",
        zona_media: "Fricciones breves frente a una escena humana aspiracional.",
        zona_inferior: "Producto real y cierre de confianza.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Contraponer la carga del problema con la sencillez de la solución.",
        camara_y_encuadre: "Split 50/50 o 45/55 con una sola persona adulta y producto visible.",
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
    prompt_fragment: "Comparativa visual de dos alternativas mediante tarjetas equivalentes. Presentar un gasto conocido frente al valor del producto, con cifras verdaderas y una conclusión clara. La composición debe ayudar a decidir sin atacar ni nombrar competidores.",
    structure: {
      reference_blueprint: {
        layout: "Headline superior y dos tarjetas inclinadas o paralelas con el mismo peso visual.",
        hierarchy: ["comparación", "dos alternativas", "conclusión/CTA"],
        product_treatment: "Producto completo dentro de su tarjeta de valor.",
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
    short_description: "Una voz real lidera la pieza y el producto aparece como prueba tangible.",
    use_when: "Hay una reseña real, específica y autorizada que resuelve una objeción.",
    visual_keys: ["Cita dominante", "Prueba real", "Producto secundario"],
    prompt_fragment: "Testimonio auténtico como protagonista dentro de una tarjeta limpia, con nombre o señal de compra verificada sólo si existe. Producto real debajo como respaldo y un único CTA. Nunca inventar nombres, estrellas, porcentajes, resultados ni reseñas.",
    structure: {
      reference_blueprint: {
        layout: "Gran cita superior, tarjeta de reseña central, producto y CTA en la base.",
        hierarchy: ["frase humana", "reseña", "producto", "acción"],
        product_treatment: "Packshot sobrio, secundario a la voz de la clienta.",
        copy_pattern: "Cita breve más una reseña específica; máximo dos bloques.",
        density: "Media-baja, con abundante espacio neutro.",
        cta_behavior: "Un botón simple después de la prueba.",
      },
      estructura: {
        zona_superior: "Frase principal tomada de una reseña real.",
        zona_media: "Testimonio con atribución verificable.",
        zona_inferior: "Producto y CTA único.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Dar protagonismo a una experiencia humana específica, no a una promesa de marca.",
        camara_y_encuadre: "Composición frontal editorial, producto en escala media.",
        superficie_y_entorno: "Fondo cálido, neutro y creíble.",
        props: "Ninguno; la reseña y el producto bastan.",
      },
      rules: [...sharedRules, "Si no existe testimonio verificable, convertir el formato en cita de marca sin fingir clientas."],
    },
  },
  {
    id: "ugc_casual",
    name: "ugc_demostracion",
    label_visible: "UGC demostración",
    stage: "Descubrimiento",
    thumbnail_path: "/archetypes/curated/ugc-demostracion.webp",
    short_description: "Una persona usa o muestra el producto en una escena real con anotaciones mínimas.",
    use_when: "Se quiere cercanía, demostración de uso y sensación de recomendación orgánica.",
    visual_keys: ["Persona real", "Producto en uso", "Anotaciones mínimas"],
    prompt_fragment: "Fotografía UGC creíble de una persona adulta usando, abriendo o mostrando el producto en contexto real. Añadir como máximo dos anotaciones editoriales breves que aclaren uso o beneficio. Luz natural, encuadre imperfecto controlado y producto totalmente fiel.",
    structure: {
      reference_blueprint: {
        layout: "Fotografía humana a sangre con dos pequeñas cajas o flechas de apoyo.",
        hierarchy: ["persona/acción", "producto", "anotaciones"],
        product_treatment: "Producto sostenido y funcional, no packshot flotante.",
        copy_pattern: "Un hook conversacional y hasta dos apoyos breves.",
        density: "Baja; conservar la sensación de contenido real.",
        cta_behavior: "Texto discreto, no botón de ecommerce rígido.",
      },
      estructura: {
        zona_superior: "Hook conversacional sobre la escena.",
        zona_media: "Persona adulta usando o mostrando el producto.",
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
    short_description: "Convierte una pregunta real del avatar en una respuesta visual de producto.",
    use_when: "La clienta expresa su necesidad como una búsqueda, duda o pregunta concreta.",
    visual_keys: ["Pregunta real", "Producto respuesta", "Escena contextual"],
    prompt_fragment: "Una búsqueda o pregunta real del avatar aparece arriba y el producto o rutina propia de la marca responde visualmente debajo. La barra debe ser una convención editorial simple, no una copia exacta de Google ni una interfaz engañosa.",
    structure: {
      reference_blueprint: {
        layout: "Pregunta superior en cápsula editorial y respuesta fotográfica debajo.",
        hierarchy: ["búsqueda", "solución", "producto/rutina"],
        product_treatment: "Lineup ordenado o producto protagonista dentro de una escena coherente.",
        copy_pattern: "Una pregunta natural y una etiqueta de respuesta.",
        density: "Baja; la pregunta y la imagen cuentan todo.",
        cta_behavior: "Opcional; la solución puede cerrar sin botón.",
      },
      estructura: {
        zona_superior: "Pregunta o búsqueda auténtica del avatar.",
        zona_media: "Rótulo de solución y producto real.",
        zona_inferior: "Entorno o resultado que completa la respuesta.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer que la marca se perciba como respuesta directa a una pregunta existente.",
        camara_y_encuadre: "Frontal con la pregunta aislada y el producto bien anclado.",
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
    prompt_fragment: "Escena doméstica o personal con producto real y máximo tres notas físicas tipo post-it que comuniquen oferta, porcentaje y vigencia. Las notas deben verse pegadas en el entorno con perspectiva y sombra real; nunca como tarjetas digitales flotantes.",
    structure: {
      reference_blueprint: {
        layout: "Fotografía lifestyle vertical con producto en primer plano y notas repartidas en profundidad.",
        hierarchy: ["escena", "producto", "oferta manuscrita"],
        product_treatment: "Producto integrado en tocador, espejo o rutina personal.",
        copy_pattern: "Hasta tres notas: qué, cuánto y hasta cuándo.",
        density: "Media, compensada con una zona amplia sin texto.",
        cta_behavior: "La nota de urgencia funciona como llamada; evitar botón adicional.",
      },
      estructura: {
        zona_superior: "Una nota de apertura o urgencia.",
        zona_media: "Producto dentro de una escena personal real.",
        zona_inferior: "Nota de porcentaje, beneficio o vigencia.",
      },
      art_direction_default: {
        decision_visual_fuerte: "Hacer que la oferta parezca una anotación encontrada dentro de la rutina.",
        camara_y_encuadre: "Plano íntimo con perspectiva real de espejo o tocador.",
        superficie_y_entorno: "Dormitorio, baño o mesa con luz natural coherente.",
        props: "Notas físicas y objetos propios de la escena, sin decorado excesivo.",
      },
      rules: sharedRules,
    },
  },
];

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
    regla: "Usar la arquitectura, jerarquía y ritmo; nunca copiar marca, producto, texto, identidad o claims de la referencia.",
  };
}
