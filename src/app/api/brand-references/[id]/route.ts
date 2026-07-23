import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return NextResponse.json(
      { error: "La plataforma no está conectada." },
      { status: 500 },
    );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Inicia sesión para borrar referencias." },
      { status: 401 },
    );

  const { id } = await context.params;
  const { data: asset, error: findError } = await supabase
    .from("brand_assets")
    .select("id,bucket_id,storage_path")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("kind", "style_reference")
    .maybeSingle();

  if (findError)
    return NextResponse.json(
      { error: "No pudimos localizar la referencia." },
      { status: 500 },
    );
  if (!asset)
    return NextResponse.json(
      { error: "La referencia ya no existe." },
      { status: 404 },
    );

  const { error: storageError } = await supabase.storage
    .from(asset.bucket_id)
    .remove([asset.storage_path]);
  if (storageError)
    return NextResponse.json(
      { error: "No pudimos borrar el archivo de la referencia." },
      { status: 500 },
    );

  const { error: deleteError } = await supabase
    .from("brand_assets")
    .delete()
    .eq("id", asset.id)
    .eq("owner_id", user.id)
    .eq("kind", "style_reference");
  if (deleteError)
    return NextResponse.json(
      { error: "El archivo se eliminó, pero no pudimos actualizar la biblioteca." },
      { status: 500 },
    );

  return NextResponse.json({ deleted: true, id: asset.id });
}
