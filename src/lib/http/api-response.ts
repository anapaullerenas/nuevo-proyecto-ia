export type ApiErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
};

export class ApiResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiResponseError";
  }
}

export async function readApiResponse<T extends object>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const raw = await response.text();
  let payload: (T & ApiErrorPayload) | null = null;

  if (raw.trim()) {
    try {
      payload = JSON.parse(raw) as T & ApiErrorPayload;
    } catch {
      throw new ApiResponseError(
        friendlyHttpMessage(response.status, fallbackMessage),
        response.status,
      );
    }
  }

  if (!response.ok) {
    throw new ApiResponseError(
      payload?.error ||
        payload?.message ||
        friendlyHttpMessage(response.status, fallbackMessage),
      response.status,
      payload?.code,
    );
  }

  if (!payload) {
    throw new ApiResponseError(fallbackMessage, response.status);
  }

  return payload;
}

export function friendlyHttpMessage(status: number, fallbackMessage: string) {
  if (status === 401) {
    return "Tu sesión venció. Vuelve a iniciar sesión e intenta nuevamente.";
  }
  if (status === 413) {
    return "El archivo preparado es demasiado grande para enviarlo. Usa una versión más ligera o más corta e intenta nuevamente.";
  }
  if (status === 429) {
    return "Hay demasiadas solicitudes al mismo tiempo. Espera un momento e intenta nuevamente.";
  }
  if ([502, 503, 504].includes(status)) {
    return "El servicio tardó más de lo esperado. No se completó la acción; intenta nuevamente en un momento.";
  }
  return fallbackMessage;
}
