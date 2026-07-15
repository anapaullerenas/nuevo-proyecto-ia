import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chargeCredits,
  CREDIT_COSTS,
  creditErrorStatus,
  refundCredits,
} from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "La plataforma aun no esta configurada." },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Inicia sesión para enviar audio." },
      { status: 401 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "La transcripcion aun no esta activa." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json(
      { error: "No se recibio audio." },
      { status: 400 },
    );
  }

  if (audio.size > 24 * 1024 * 1024) {
    return NextResponse.json(
      {
        error: "El audio es demasiado grande. Intenta con una nota mas corta.",
      },
      { status: 413 },
    );
  }

  let creditCharge;
  try {
    creditCharge = await chargeCredits({
      userId: user.id,
      amount: CREDIT_COSTS.voice_note,
      reason: "voice_note",
      provider: "openai",
      model: "gpt-4o-mini-transcribe",
      costUsd: estimateCostUsd({
        provider: "openai",
        model: "gpt-4o-mini-transcribe",
        minutes: 2,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos validar tus créditos.",
      },
      { status: creditErrorStatus(error) },
    );
  }

  const openAiForm = new FormData();
  openAiForm.append("file", audio, audio.name || "nota.webm");
  openAiForm.append(
    "model",
    process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
  );
  openAiForm.append("language", "es");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
      body: openAiForm,
    },
  );

  if (!response.ok) {
    console.error(
      "transcription failed",
      response.status,
      (await response.text()).slice(0, 400),
    );
    if (creditCharge.charged)
      await refundCredits(
        user.id,
        creditCharge.amount,
        "voice_note",
        null,
        creditCharge.operationId,
      );
    return NextResponse.json(
      {
        error:
          "No pudimos transcribir esta nota. Intenta con un audio más corto y claro.",
      },
      { status: 500 },
    );
  }

  const data = await response.json();
  return NextResponse.json({ text: data.text || "" });
}
