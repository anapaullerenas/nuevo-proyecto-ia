export type StaticBrief = {
  arquetipo: string;
  arquetipo_label: string;
  concepto: string;
  hook_visual: string;
  texto_principal: string;
  texto_secundario: string;
  cta: string;
  composicion: {
    zona_superior: string;
    zona_media: string;
    zona_inferior: string;
  };
  paleta: string[];
  emocion_objetivo: string;
  por_que_funciona: string;
  riesgo_a_evitar: string;
  notas_disenadora: string[];
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
  return {
    arquetipo: value?.arquetipo || fallbackArchetype,
    arquetipo_label: value?.arquetipo_label || "Automático",
    concepto: value?.concepto || "Concepto pendiente",
    hook_visual: value?.hook_visual || "Producto protagonista con jerarquía clara.",
    texto_principal: clampWords(value?.texto_principal || "Beneficio claro", 6),
    texto_secundario: clampWords(value?.texto_secundario || "Oferta fácil de entender", 8),
    cta: clampWords(value?.cta || "Pide el tuyo", 4),
    composicion: {
      zona_superior: value?.composicion?.zona_superior || "Texto principal",
      zona_media: value?.composicion?.zona_media || "Producto o resultado protagonista",
      zona_inferior: value?.composicion?.zona_inferior || "CTA visible",
    },
    paleta: Array.isArray(value?.paleta) && value.paleta.length ? value.paleta.slice(0, 5) : ["#632E59", "#F4ECC9", "#FFF6F0"],
    emocion_objetivo: value?.emocion_objetivo || "claridad, deseo y confianza",
    por_que_funciona: value?.por_que_funciona || "Ordena la oferta en una pieza que se entiende rápido.",
    riesgo_a_evitar: value?.riesgo_a_evitar || "Que el anuncio se vea genérico o con texto ilegible.",
    notas_disenadora: Array.isArray(value?.notas_disenadora) ? value.notas_disenadora.slice(0, 5) : [],
  };
}

export function compileDesignPrompt({
  brandName,
  brandVoice,
  format,
  ficha,
  archetype,
  quality,
  serviceNoProduct,
  variantIndex,
}: {
  brandName: string;
  brandVoice?: string | null;
  format: string;
  ficha: StaticBrief;
  archetype?: StaticArchetype | null;
  quality: "medium" | "high";
  serviceNoProduct?: boolean;
  variantIndex?: number;
}) {
  const canvas = getCanvas(format);
  const safeZone =
    format.includes("9:16")
      ? `REGLA INNEGOCIABLE PARA STORY/REEL:
- Deja libre el 14% superior y el 20% inferior del lienzo.
- Todo texto, producto, CTA y logo deben vivir en la zona segura central.
- Las franjas superior e inferior solo pueden llevar fondo, textura o ambiente.`
      : "Mantén márgenes amplios para que el anuncio respire y sea legible en celular.";

  return `Diseña un anuncio estático publicitario profesional para Meta/Instagram. NO es una ilustración ni arte conceptual: debe verse como un anuncio terminado listo para pautar.

FORMATO: ${canvas}
CALIDAD: ${quality}
MARCA: ${brandName}
VOZ DE MARCA: ${brandVoice || "femenina, clara, premium y directa"}
ARQUETIPO: ${ficha.arquetipo_label || archetype?.label_visible || "Automático"}
MECÁNICA DEL ARQUETIPO: ${archetype?.prompt_fragment || "Jerarquía clara, producto/resultado protagonista y CTA visible."}
VARIANTE: ${variantIndex || 1}

${safeZone}

COMPOSICIÓN POR ZONAS:
- Zona superior: ${ficha.composicion.zona_superior}
- Zona media: ${ficha.composicion.zona_media}
- Zona inferior: ${ficha.composicion.zona_inferior}

CONCEPTO:
${ficha.concepto}

HOOK VISUAL:
${ficha.hook_visual}

TEXTO EN LA IMAGEN, EXACTO Y SIN AÑADIR MÁS:
- Texto principal: "${ficha.texto_principal}"
- Texto secundario: "${ficha.texto_secundario}"
- CTA: "${ficha.cta}"

REGLAS ABSOLUTAS DE TEXTO:
- Renderiza exactamente esos textos, ni una palabra más.
- Español correcto con acentos.
- Legible en un teléfono a 400px de ancho.
- Alto contraste, máximo 20% del área total con texto.

MARCA Y ESTILO:
- Paleta prioritaria: ${ficha.paleta.join(", ")}
- Emoción objetivo: ${ficha.emocion_objetivo}
- Estética femenina, refinada, actual y pagable; nada barato, saturado ni de plantilla.
- ${serviceNoProduct ? "Es un servicio: representa resultado, autoridad, confianza o transformación." : "Usa la foto de producto adjunta como referencia: respeta forma, etiqueta, color y proporciones reales."}

PROHIBICIONES:
- No inventes texto adicional, letras decorativas, marcas de agua, logos de terceros ni elementos sin propósito.
- No deformes manos, rostros, empaques o etiquetas.
- No uses aspecto de banco de imágenes, fondos oscuros pesados ni degradados sucios.
- Evita composición genérica; debe sentirse como una pieza pensada por dirección creativa.
`;
}

export function getCanvas(format: string) {
  if (format.includes("1:1") || format.includes("Carrusel")) return "1080x1080";
  if (format.includes("9:16")) return "1080x1920 con zona segura central";
  return "1080x1350";
}

export function getImageSize(format: string) {
  if (format.includes("1:1") || format.includes("Carrusel")) return "1024x1024";
  return "1024x1536";
}

function clampWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}
