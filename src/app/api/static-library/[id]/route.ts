import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "La plataforma no está conectada." }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión nuevamente." }, { status: 401 });

  const { id } = await params;
  const { data: creative } = await supabase
    .from("static_creatives")
    .select("id,storage_path")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!creative) return NextResponse.json({ error: "No encontré esa pieza." }, { status: 404 });
  const { error } = await supabase.from("static_creatives").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: "No se pudo borrar la pieza." }, { status: 500 });
  if (creative.storage_path) await supabase.storage.from("creative-assets").remove([creative.storage_path]);
  return NextResponse.json({ deleted: true });
}
