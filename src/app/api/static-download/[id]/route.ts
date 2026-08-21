import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return NextResponse.json({ error: "La plataforma no está conectada." }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Inicia sesión nuevamente." }, { status: 401 });
  const { id } = await params;
  const { data: creative } = await supabase
    .from("static_creatives")
    .select("id,brand_id,archetype,ficha,qa_report")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!creative)
    return NextResponse.json({ error: "No encontré esa pieza." }, { status: 404 });

  if (
    (creative.qa_report as { look_disenador?: boolean } | null)?.look_disenador &&
    creative.archetype
  ) {
    await supabase.from("golden_briefs").insert({
      archetype_id: creative.archetype,
      scope: "brand",
      brand_id: creative.brand_id,
      ficha: creative.ficha,
      source: "downloaded_qa_pass",
    });
  }
  return NextResponse.json({ ok: true });
}
