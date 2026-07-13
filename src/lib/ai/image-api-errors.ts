export class ImageApiError extends Error {
  status: number;
  code: string | null;
  type: string | null;
  requestId: string | null;
  moderationStage: string | null;
  moderationCategories: string[];

  constructor({
    message,
    status,
    code,
    type,
    requestId,
    moderationStage,
    moderationCategories,
  }: {
    message: string;
    status: number;
    code?: string | null;
    type?: string | null;
    requestId?: string | null;
    moderationStage?: string | null;
    moderationCategories?: string[];
  }) {
    super(message);
    this.name = "ImageApiError";
    this.status = status;
    this.code = code || null;
    this.type = type || null;
    this.requestId = requestId || null;
    this.moderationStage = moderationStage || null;
    this.moderationCategories = moderationCategories || [];
  }
}

export async function imageApiErrorFromResponse(response: Response) {
  let payload: {
    error?: {
      message?: string;
      code?: string;
      type?: string;
      moderation_details?: {
        moderation_stage?: string;
        categories?: string[];
      };
    };
  } = {};

  try {
    payload = await response.json();
  } catch {
    // Some upstream failures return no JSON body. The status remains actionable.
  }

  const details = payload.error?.moderation_details;
  return new ImageApiError({
    message: payload.error?.message || `El motor de imágenes respondió con estado ${response.status}.`,
    status: response.status,
    code: payload.error?.code,
    type: payload.error?.type,
    requestId: response.headers.get("x-request-id"),
    moderationStage: details?.moderation_stage,
    moderationCategories: Array.isArray(details?.categories) ? details.categories : [],
  });
}

export function appendInputFidelityWhenSupported(form: FormData, model: string) {
  // GPT Image 2 already processes every input at high fidelity and rejects this parameter.
  if (!model.startsWith("gpt-image-2")) form.append("input_fidelity", "high");
}

export function imageGenerationFailure(error: unknown) {
  if (error instanceof ImageApiError) {
    if (error.code === "moderation_blocked") {
      const targetingLanguage = error.moderationCategories.includes("harassment");
      return {
        status: 400,
        code: "moderation_blocked",
        message: targetingLanguage
          ? "El motor bloqueó el enfoque de esta pieza. Exprésalo como un beneficio positivo y evita frases como “atacar la inseguridad”. Tus créditos fueron devueltos."
          : "El motor bloqueó esta solicitud por seguridad. Ajusta el mensaje o la referencia visual e intenta nuevamente; tus créditos fueron devueltos.",
      };
    }

    if (error.status === 429) {
      return {
        status: 503,
        code: "image_engine_busy",
        message: "El motor de imágenes está ocupado. Tus créditos fueron devueltos; espera un momento y vuelve a generar.",
      };
    }

    if (error.status >= 500) {
      return {
        status: 502,
        code: "image_engine_unavailable",
        message: "El motor de imágenes no respondió correctamente. Tus créditos fueron devueltos; vuelve a intentarlo en unos minutos.",
      };
    }

    return {
      status: 400,
      code: error.code || "image_request_invalid",
      message: "No pudimos procesar esta solicitud de imagen. Tus créditos fueron devueltos; vuelve a intentarlo y, si se repite, cambia una referencia visual.",
    };
  }

  const message = error instanceof Error ? error.message : "";
  if (/foto original|foto real|producto|logotipo|referencia/i.test(message)) {
    return {
      status: 400,
      code: "brand_asset_unreadable",
      message: `${message} Tus créditos fueron devueltos.`,
    };
  }

  return {
    status: 500,
    code: "static_generation_failed",
    message: "No pudimos terminar la imagen. Tus créditos fueron devueltos y tu ficha sigue guardada para que puedas reintentar.",
  };
}
