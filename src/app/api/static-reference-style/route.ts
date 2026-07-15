import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "La plataforma no está conectada." }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar estilos." }, { status: 401 });
  const { assetId, name } = (await request.json()) as { assetId?: string; name?: string };
  if (!assetId) return NextResponse.json({ error: "Falta la referencia." }, { status: 400 });

  const { data: asset } = await supabase
    .from("brand_assets")
    .select("id,metadata")
    .eq("id", assetId)
    .eq("owner_id", user.id)
    .eq("kind", "style_reference")
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: "No encontré la referencia." }, { status: 404 });
  const metadata = {
    ...((asset.metadata as Record<string, unknown> | null) || {}),
    saved_as_style: true,
    custom_style_name: String(name || "Mi estilo").slice(0, 60),
    saved_as_style_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("brand_assets").update({ metadata }).eq("id", asset.id);
  if (error) return NextResponse.json({ error: "No pudimos guardar el estilo." }, { status: 500 });
  return NextResponse.json({ ok: true, metadata });
}
