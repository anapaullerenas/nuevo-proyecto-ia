import { z } from "zod";

export type StaticBrief = {
  arquetipo: string;
  arquetipo_label: string;
  concepto: string;
  hook_visual: string;
  texto_principal: string;
  texto_secundario: string;
  cta: string;
  logo_usage: "none" | "subtle" | "prominent";
  cta_usage: "none" | "text" | "button";
  disclaimer: string;
  text_render_mode: "baked" | "layered";
  composicion: {
    zona_superior: string;
    zona_media: string;
    zona_inferior: string;
  };
  art_direction: {
    decision_visual_fuerte: string;
    iluminacion: string;
    camara_y_encuadre: string;
    superficie_y_entorno: string;
    props: string;
    tratamiento_color: string;
  };
  paleta: string[];
  emocion_objetivo: string;
  por_que_funciona: string;
  riesgo_a_evitar: string;
  notas_disenadora: string[];
  must_preserve: string[];
  must_avoid: string[];
  review_score: number;
  review_summary: string;
};

export const StaticBriefSchema = z.object({
  arquetipo: z.string(),
  arquetipo_label: z.string(),
  concepto: z.string(),
  hook_visual: z.string(),
  texto_principal: z.string(),
  texto_secundario: z.string(),
  cta: z.string(),
  logo_usage: z.enum(["none", "subtle", "prominent"]),
  cta_usage: z.enum(["none", "text", "button"]),
  disclaimer: z.string(),
  text_render_mode: z.enum(["baked", "layered"]),
  composicion: z.object({ zona_superior: z.string(), zona_media: z.string(), zona_inferior: z.string() }),
  art_direction: z.object({ decision_visual_fuerte: z.string(), iluminacion: z.string(), camara_y_encuadre: z.string(), superficie_y_entorno: z.string(), props: z.string(), tratamiento_color: z.string() }),
  paleta: z.array(z.string()),
  emocion_objetivo: z.string(),
  por_que_funciona: z.string(),
  riesgo_a_evitar: z.string(),
  notas_disenadora: z.array(z.string()),
  must_preserve: z.array(z.string()),
  must_avoid: z.array(z.string()),
  review_score: z.number().min(0).max(100),
  review_summary: z.string(),
});

export const STATIC_BRIEF_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    arquetipo: { type: "string" }, arquetipo_label: { type: "string" }, concepto: { type: "string" }, hook_visual: { type: "string" },
    texto_principal: { type: "string" }, texto_secundario: { type: "string" }, cta: { type: "string" }, disclaimer: { type: "string" },
    logo_usage: { type: "string", enum: ["none", "subtle", "prominent"] },
    cta_usage: { type: "string", enum: ["none", "text", "button"] },
    text_render_mode: { type: "string", enum: ["baked", "layered"] },
    composicion: {
      type: "object", additionalProperties: false,
      properties: { zona_superior: { type: "string" }, zona_media: { type: "string" }, zona_inferior: { type: "string" } },
      required: ["zona_superior", "zona_media", "zona_inferior"],
    },
    art_direction: {
      type: "object", additionalProperties: false,
      properties: { decision_visual_fuerte: { type: "string" }, iluminacion: { type: "string" }, camara_y_encuadre: { type: "string" }, superficie_y_entorno: { type: "string" }, props: { type: "string" }, tratamiento_color: { type: "string" } },
      required: ["decision_visual_fuerte", "iluminacion", "camara_y_encuadre", "superficie_y_entorno", "props", "tratamiento_color"],
    },
    paleta: { type: "array", items: { type: "string" } }, emocion_objetivo: { type: "string" }, por_que_funciona: { type: "string" },
    riesgo_a_evitar: { type: "string" }, notas_disenadora: { type: "array", items: { type: "string" } },
    must_preserve: { type: "array", items: { type: "string" } }, must_avoid: { type: "array", items: { type: "string" } },
    review_score: { type: "number" }, review_summary: { type: "string" },
  },
  required: ["arquetipo", "arquetipo_label", "concepto", "hook_visual", "texto_principal", "texto_secundario", "cta", "disclaimer", "logo_usage", "cta_usage", "text_render_mode", "composicion", "art_direction", "paleta", "emocion_objetivo", "por_que_funciona", "riesgo_a_evitar", "notas_disenadora", "must_preserve", "must_avoid", "review_score", "review_summary"],
};

export type StaticArchetype = {
  id: string;
  name: string;
  label_visible: string;
  stage: string;
  prompt_fragment: string;
  structure?: Record<string, unknown>;
};

export function normalizeStaticBrief(value: Partial<StaticBrief> | null | undefined, fallbackArchetype = "automatico"): StaticBrief {
  // Normal generation produces a finished ad. A post-render card must never
  // cover an otherwise good composition unless a caller opts in explicitly.
  const renderMode: StaticBrief["text_render_mode"] = "baked";
  return {
    arquetipo: value?.arquetipo || fallbackArchetype,
    arquetipo_label: value?.arquetipo_label || "Automático",
    concepto: value?.concepto || "Concepto pendiente",
    hook_visual: value?.hook_visual || "Oferta o resultado protagonista con jerarquía clara.",
    texto_principal: clampWords(typeof value?.texto_principal === "string" ? value.texto_principal : "Beneficio claro", 6),
    texto_secundario: clampWords(typeof value?.texto_secundario === "string" ? value.texto_secundario : "Oferta fácil de entender", 8),
    cta: clampWords(typeof value?.cta === "string" ? value.cta : "Conoce más", 4),
    logo_usage: ["none", "subtle", "prominent"].includes(value?.logo_usage || "") ? value!.logo_usage! : "subtle",
    cta_usage: ["none", "text", "button"].includes(value?.cta_usage || "") ? value!.cta_usage! : "text",
    disclaimer: value?.disclaimer?.trim() || "",
    text_render_mode: renderMode,
    composicion: {
      zona_superior: value?.composicion?.zona_superior || "Texto principal",
      zona_media: value?.composicion?.zona_media || "Oferta o resultado protagonista",
      zona_inferior: value?.composicion?.zona_inferior || "CTA visible",
    },
    art_direction: {
      decision_visual_fuerte: value?.art_direction?.decision_visual_fuerte || "Oferta, resultado o persona con una sola acción clara y jerarquía inequívoca.",
      iluminacion: value?.art_direction?.iluminacion || "Luz lateral suave con sombras de contacto y reflejos físicamente plausibles.",
      camara_y_encuadre: value?.art_direction?.camara_y_encuadre || "Encuadre frontal a 3/4, sujeto principal al 45% del lienzo y márgenes de 8%.",
      superficie_y_entorno: value?.art_direction?.superficie_y_entorno || "Una escena real coherente con la marca, sin fondos compuestos.",
      props: value?.art_direction?.props || "Ninguno, salvo un objeto funcional.",
      tratamiento_color: value?.art_direction?.tratamiento_color || "Dos colores de marca, un neutro y contraste natural.",
    },
    paleta: Array.isArray(value?.paleta) && value.paleta.length ? value.paleta.slice(0, 5) : ["#632E59", "#F4ECC9", "#FFF6F0"],
    emocion_objetivo: value?.emocion_objetivo || "claridad, deseo y confianza",
    por_que_funciona: value?.por_que_funciona || "Ordena la oferta en una pieza que se entiende rápido.",
    riesgo_a_evitar: value?.riesgo_a_evitar || "Que el anuncio se vea genérico o con texto ilegible.",
    notas_disenadora: Array.isArray(value?.notas_disenadora) ? value.notas_disenadora.slice(0, 5) : [],
    must_preserve: Array.isArray(value?.must_preserve) ? value.must_preserve.slice(0, 6) : [],
    must_avoid: Array.isArray(value?.must_avoid) ? value.must_avoid.slice(0, 6) : [],
    review_score: Math.min(100, Math.max(0, Number(value?.review_score) || 0)),
    review_summary: value?.review_summary || "Ficha revisada por dirección creativa.",
  };
}

const variationMoves = [
  "Lidera con una prueba específica y una composición editorial limpia.",
  "Lidera con el problema y una tensión visual clara antes de presentar la solución.",
  "Lidera con prueba social humana, concreta y creíble.",
];

function formatArchetypeRecipe(archetype?: StaticArchetype | null) {
  if (!archetype?.structure) return "- Sigue la composición por zonas de la ficha y mantén una sola idea dominante.";
  const structure = archetype.structure;
  const blueprint = (structure.reference_blueprint || {}) as Record<string, unknown>;
  const zones = (structure.estructura || structure.zones || {}) as Record<string, unknown>;
  const rules = Array.isArray(structure.rules) ? structure.rules : [];
  const hierarchy = Array.isArray(blueprint.hierarchy) ? blueprint.hierarchy.join(" → ") : "headline → visual principal → apoyo";
  const lines = [
    `- Arquitectura: ${String(blueprint.layout || "Composición clara basada en el arquetipo elegido.")}`,
    `- Jerarquía exacta: ${hierarchy}.`,
    `- Tratamiento de la oferta: ${String(blueprint.product_treatment || "Oferta, resultado o activo principal reconocible y protagonista.")}`,
    `- Patrón de copy: ${String(blueprint.copy_pattern || "Copy breve y escaneable.")}`,
    `- Densidad: ${String(blueprint.density || "Baja, con aire visual.")}`,
    `- Comportamiento del CTA: ${String(blueprint.cta_behavior || "Sólo cuando ayude a completar la acción.")}`,
    ...Object.entries(zones).map(([zone, value]) => `- ${zone.replaceAll("_", " ")}: ${String(value)}`),
    ...rules.map((rule) => `- ${String(rule)}`),
  ];
  return lines.join("\n");
}

export function compileDesignPrompt({
  brandName,
  brandVoice,
  brandCategory,
  format,
  ficha,
  archetype,
  quality,
  serviceNoProduct,
  variantIndex,
  styleReferenceCount = 0,
  brandAssetCount = 0,
}: {
  brandName: string;
  brandVoice?: string | null;
  brandCategory?: string | null;
  format: string;
  ficha: StaticBrief;
  archetype?: StaticArchetype | null;
  quality: "medium" | "high";
  serviceNoProduct?: boolean;
  variantIndex?: number;
  styleReferenceCount?: number;
  brandAssetCount?: number;
}) {
  const canvas = getCanvas(format);
  const safeZone =
    format.includes("9:16")
      ? `REGLA INNEGOCIABLE PARA STORY/REEL:
- Deja libre el 14% superior y el 20% inferior del lienzo.
- Todo texto, visual principal, CTA y logo deben vivir en la zona segura central.
- Las franjas superior e inferior solo pueden llevar fondo, textura o ambiente.`
      : "Mantén márgenes amplios para que el anuncio respire y sea legible en celular.";

  const visibleCta = ficha.cta_usage === "none" ? "" : ficha.cta;
  const textDirection = ficha.text_render_mode === "layered"
    ? `MODO CAPA DE TEXTO — OBLIGATORIO:
- Genera la fotografía/composición BASE SIN NINGUNA PALABRA, letra, número, logo tipográfico ni pseudo texto.
- Reserva aire visual limpio para que el servidor añada después el copy exacto.
- Deja una zona negativa clara en la parte superior para headline y una zona inferior para apoyo${visibleCta ? ", CTA" : ""} y disclaimer.
- No intentes renderizar: "${ficha.texto_principal}", "${ficha.texto_secundario}"${visibleCta ? `, "${visibleCta}"` : ""} ni "${ficha.disclaimer}".`
    : `TEXTO EN LA IMAGEN, EXACTO Y SIN AÑADIR MÁS:
- Texto principal: "${ficha.texto_principal}"
- Texto secundario: "${ficha.texto_secundario}"
${visibleCta ? `- CTA: "${visibleCta}" (${ficha.cta_usage === "button" ? "botón" : "texto discreto"})` : "- No incluyas CTA visible."}

REGLAS ABSOLUTAS DE TEXTO:
- Renderiza exactamente esos textos, ni una palabra más.
- Español correcto con acentos.
- Legible en un teléfono a 400px de ancho.
- Alto contraste, máximo 20% del área total con texto.`;

  const normalizedCategory = String(brandCategory || "").toLowerCase();
  const categoryRules = /(skin|piel|belleza|beauty|cosm[eé]tic|bienestar|salud)/i.test(normalizedCategory)
    ? `- Para esta categoría usa formulaciones prudentes como "ayuda a" o "visiblemente". Evita absolutos como "elimina", "cura", "borra" o "garantizado".
- No señales inseguridades corporales ni inventes resultados.`
    : `- Usa exclusivamente objetos, escenarios, beneficios y vocabulario de la marca activa.
- No importes productos, partes del cuerpo, ingredientes ni supuestos de otra categoría.`;

  return `Diseña un anuncio estático publicitario profesional para Meta/Instagram. NO es una ilustración ni arte conceptual: debe verse como un anuncio terminado listo para pautar.

FORMATO: ${canvas}
CALIDAD: ${quality}
MARCA: ${brandName}
VOZ DE MARCA: ${brandVoice || "clara, específica y coherente con la identidad de la marca"}
ARQUETIPO: ${ficha.arquetipo_label || archetype?.label_visible || "Automático"}
MECÁNICA DEL ARQUETIPO: ${archetype?.prompt_fragment || "Jerarquía clara, oferta o resultado protagonista y CTA sólo cuando aporte."}
RECETA VISUAL DE LA REFERENCIA ELEGIDA:
${formatArchetypeRecipe(archetype)}
- La referencia define arquitectura, ritmo y jerarquía. Está terminantemente prohibido copiar su categoría, marca, oferta, texto, colores, claims o identidad.
VARIANTE: ${variantIndex || 1}
MOVIMIENTO CREATIVO OBLIGATORIO: ${variationMoves[((variantIndex || 1) - 1) % variationMoves.length]}
${(variantIndex || 1) > 1 ? "Esta variante debe distinguirse de las demás por escena, mecanismo visual, sujeto o arquitectura. Cambiar sólo color, crop, sombra o tipografía NO cuenta como variante." : ""}

${safeZone}

COMPOSICIÓN POR ZONAS:
- Zona superior: ${ficha.composicion.zona_superior}
- Zona media: ${ficha.composicion.zona_media}
- Zona inferior: ${ficha.composicion.zona_inferior}

FOTOGRAFÍA — INSTRUCCIONES EJECUTABLES:
- Decisión visual: ${ficha.art_direction.decision_visual_fuerte}
- Iluminación: ${ficha.art_direction.iluminacion}
- Cámara y encuadre: ${ficha.art_direction.camara_y_encuadre}
- Superficie y entorno: ${ficha.art_direction.superficie_y_entorno}
- Props: ${ficha.art_direction.props}
- Tratamiento de color: ${ficha.art_direction.tratamiento_color}

CONCEPTO:
${ficha.concepto}

HOOK VISUAL:
${ficha.hook_visual}

${textDirection}

MARCA Y ESTILO:
- Paleta prioritaria: ${ficha.paleta.join(", ")}
- Emoción objetivo: ${ficha.emocion_objetivo}
- Estética fiel a la identidad y categoría de la marca; refinada, actual y sin apariencia de plantilla.
- ${serviceNoProduct ? "Es un servicio: representa resultado, autoridad, confianza o transformación." : "El producto adjunto es FUENTE DE VERDAD. Conserva exactamente geometría, proporciones, tapa, envase, etiqueta, logotipo, colores y rasgos identificables. No inventes, reescribas ni sustituyas el empaque."}

DOCTRINA VISUAL OBLIGATORIA:
- Una sola idea entendible en 2 segundos.
- La oferta, producto, persona, resultado o interfaz protagonista ocupa entre 35% y 60% del lienzo, según la categoría.
- Al menos 30% del lienzo debe permanecer visualmente limpio.
- Jerarquía: headline, visual principal y apoyo${visibleCta ? ", con CTA sólo si aporta a la acción" : ""}.
- Máximo 4 zonas de texto. Sólo un módulo secundario: una prueba, una cifra, una oferta, una comparación o hasta 3 apoyos breves.
- Estética de anuncio de performance hecho por dirección de arte: fotográfico, táctil, limpio y con una decisión visual fuerte.
- Luz premium de campaña, composición limpia, una sola pieza dominante y comprensión en un vistazo a tamaño pulgar.
- Si aparecen personas, deben verse reales y naturales; manos correctas, diversidad coherente con la audiencia y nunca figuras públicas.
- Fotografía comercial creíble: física, escala, sombras de contacto, reflejos y materiales plausibles; pequeñas imperfecciones ópticas naturales.
- Nada de brillo plástico, simetría imposible, objetos flotantes, UI falsa, chat inventado o escenografía sintética salvo que el arquetipo lo exija.

REGLAS DE ORO DEL CATÁLOGO:
1. UNA idea y un protagonista claro —oferta, producto, persona, resultado o interfaz— por pieza.
2. Nada toca bordes: padding 6-8% en los cuatro lados y mínimo 30% de aire.
3. Headline de 2-4 palabras por línea, máximo dos familias y una sola palabra acentuada.
4. Máximo un sticker, badge o roundel.
5. Máximo cuatro beneficios de cuatro palabras cada uno, con estilo consistente.
6. Fotografía real y táctil: materiales, superficies, personas y texturas físicamente creíbles cuando correspondan.
7. El fondo toma una sola decisión: escena única, color plano o gradiente suave.
8. Si el formato es nativo, debe parecer contenido orgánico creíble, no una parodia de UI.
9. Disclaimer pequeño al pie y sin competir.
10. Dos o tres colores de marca más un neutro; nunca una paleta descontrolada.

PUERTA DE RELEVANCIA COMERCIAL:
- Debe reconocerse para quién es, qué tensión humana resuelve, qué transformación promete, cuál es la razón para creer y qué oferta presenta.
- El copy habla como la audiencia real, no como ficha técnica.
- No inventes cifras, certificaciones, testimonios, atributos, resultados ni claims.
${categoryRules}
- Sin antes/después dramático ni lenguaje que señale inseguridades corporales.

${styleReferenceCount > 0 ? `REFERENCIAS DE ESTILO (${styleReferenceCount}):
- Los archivos marcados como inspiración aportan formato, jerarquía, densidad, ritmo, encuadre y tratamiento fotográfico.
- Nunca copies su categoría, logos, ofertas, textos, colores de marca ni identidad.` : "No hay referencias de estilo seleccionadas; crea una dirección original coherente con la marca."}

${brandAssetCount > 0 ? `ACTIVOS REALES DE MARCA (${brandAssetCount}):
- El producto adjunto, cuando exista, es fuente de verdad de packaging y debe conservarse con máxima fidelidad.
${ficha.logo_usage === "none" ? "- No reserves ni dibujes un logo adicional: el packaging o la identidad visual ya son suficientes." : `- El logo oficial se colocará después de generar: reserva una zona limpia y discreta en una esquina, sin tarjeta blanca, y NO dibujes, inventes ni escribas ningún logo.`}` : ""}

PROHIBICIONES:
- No inventes texto adicional, letras decorativas, marcas de agua, logos de terceros ni elementos sin propósito.
- No deformes manos, rostros, empaques o etiquetas.
- No uses aspecto de banco de imágenes, fondos oscuros pesados ni degradados sucios.
- Evita: cheap, low quality, plastic skin, fake model, distorted hands, extra fingers, misspelled text, warped packaging, wrong label, cluttered layout, watermark, logo soup, oversaturated, HDR halo, stock photo look.
- Sin card soup, mosaicos densos, exceso de iconos, mini callouts, personas plásticas, decoraciones de IA ni composición de folleto.
- Las instrucciones, nombres de secciones, códigos de color, medidas y markdown nunca son texto visible.
- Evita composición genérica; debe sentirse como una pieza pensada por dirección creativa.

CONTROL DE FIDELIDAD:
${serviceNoProduct ? "La escena debe verse humana y fotográficamente creíble." : "Si no puedes reproducir el producto fielmente desde el activo adjunto, NO fabriques un sustituto. Prioriza el producto real incluso sobre adornos o complejidad visual."}

SALIDA:
Una sola imagen terminada, standalone y lista para pautar. No collage, mockup de pantalla, cuadrícula ni múltiples propuestas dentro de la imagen.
`;
}

export function getCanvas(format: string) {
  if (format.includes("1:1") || format.includes("Carrusel")) return "1080x1080";
  if (format.includes("9:16")) return "1080x1920 con zona segura central";
  return "1080x1350";
}

export function getImageSize(format: string) {
  if (format.includes("1:1") || format.includes("Carrusel")) return "1024x1024";
  if (format.includes("9:16")) return "1024x1792";
  return "1088x1360";
}

function clampWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}
