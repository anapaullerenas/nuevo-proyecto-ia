import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCuratedStaticFormat } from "@/lib/static-format-catalog";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "La plataforma no está conectada." }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar tu opinión." }, { status: 401 });

  const body = (await request.json()) as { staticId?: string; rating?: number };
  if (!body.staticId || ![-1, 1].includes(Number(body.rating))) {
    return NextResponse.json({ error: "La valoración no es válida." }, { status: 400 });
  }

  const { data: creative } = await supabase
    .from("static_creatives")
    .select("id,brand_id,archetype,funnel_stage")
    .eq("id", body.staticId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!creative) return NextResponse.json({ error: "No encontré la pieza." }, { status: 404 });

  const pattern = getCuratedStaticFormat(creative.archetype);
  const { error } = await supabase.from("static_creative_feedback").upsert({
    owner_id: user.id,
    brand_id: creative.brand_id,
    static_id: creative.id,
    archetype_id: creative.archetype || "automatico",
    pattern_version: pattern?.version || "1.0.0",
    angle: creative.funnel_stage,
    rating: Number(body.rating),
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id,static_id" });
  if (error) return NextResponse.json({ error: "No pudimos guardar tu opinión." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
