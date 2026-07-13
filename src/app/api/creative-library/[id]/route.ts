import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "La plataforma no está conectada." }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión nuevamente." }, { status: 401 });
  const { id } = await params;
  const { name } = (await request.json()) as { name?: string };
  const cleanName = name?.trim().slice(0, 90);
  if (!cleanName || cleanName.length < 2) return NextResponse.json({ error: "Escribe un nombre válido." }, { status: 400 });
  const { data: analysis } = await supabase.from("creative_analyses").select("asset_id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!analysis?.asset_id) return NextResponse.json({ error: "No encontré ese creativo." }, { status: 404 });
  const { error } = await supabase.from("creative_assets").update({ file_name: cleanName }).eq("id", analysis.asset_id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: "No se pudo cambiar el nombre." }, { status: 500 });
  return NextResponse.json({ name: cleanName });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "La plataforma no está conectada." }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión nuevamente." }, { status: 401 });
  const { id } = await params;
  const { data: analysis } = await supabase.from("creative_analyses").select("asset_id,creative_assets(storage_path)").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!analysis) return NextResponse.json({ error: "No encontré ese análisis." }, { status: 404 });
  const asset = Array.isArray(analysis.creative_assets) ? analysis.creative_assets[0] : analysis.creative_assets;
  const { error: deleteAnalysisError } = await supabase.from("creative_analyses").delete().eq("id", id).eq("owner_id", user.id);
  if (deleteAnalysisError) return NextResponse.json({ error: "No se pudo borrar el análisis." }, { status: 500 });
  if (analysis.asset_id) await supabase.from("creative_assets").delete().eq("id", analysis.asset_id).eq("owner_id", user.id);
  if (asset?.storage_path) await supabase.storage.from("creative-assets").remove([asset.storage_path]);
  return NextResponse.json({ deleted: true });
}
