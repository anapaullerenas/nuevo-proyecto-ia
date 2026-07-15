import { NextResponse, type NextRequest } from "next/server";
import { isAccessException } from "@/lib/auth/access-exceptions";
import { ensureExceptionWorkspace } from "@/lib/auth/exception-workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NOT_FOUND_MESSAGE =
  "No encontramos este correo en la lista de suscripciones. Verifica que esté bien escrito o contacta a atención a clientes.";

export async function POST(request: NextRequest) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return NextResponse.json(
      { error: "El acceso por correo aún no está configurado." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || email.length > 254 || !email.includes("@")) {
    return NextResponse.json(
      { error: "Escribe un correo válido." },
      { status: 400 },
    );
  }

  const exception = isAccessException(email);

  if (exception) {
    const directSession = await createDirectSession(email);
    if (directSession instanceof NextResponse) return directSession;

    try {
      await ensureExceptionWorkspace({
        database: admin,
        email,
        userId: directSession.userId,
      });
    } catch (workspaceError) {
      console.error("No se pudo asociar la cuenta recuperada.", workspaceError);
      return NextResponse.json(
        { error: "No pudimos abrir tu cuenta recuperada. Intenta de nuevo." },
        { status: 503 },
      );
    }

    return NextResponse.json({ direct: true, redirectTo: "/dashboard" });
  }

  const { data: member, error: memberError } = await admin
    .from("miembros_club")
    .select("Email")
    .ilike("Email", email)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    console.error(
      "No se pudo consultar la lista de suscripciones.",
      memberError,
    );
    return NextResponse.json(
      { error: "No pudimos consultar tu acceso. Intenta de nuevo." },
      { status: 503 },
    );
  }

  if (!member) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  const directSession = await createDirectSession(email);
  if (directSession instanceof NextResponse) return directSession;

  return NextResponse.json({ direct: true, redirectTo: "/dashboard" });
}

async function createDirectSession(email: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "No pudimos abrir tu cuenta. Intenta de nuevo." },
      { status: 503 },
    );
  }

  // Supabase crea un token de un solo uso, pero lo confirmamos en el servidor.
  // Así conservamos una sesión real y segura sin depender de la entrega de correo.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link.properties?.hashed_token;

  if (linkError || !tokenHash) {
    console.error("No se pudo crear la sesión directa.", linkError);
    return NextResponse.json(
      { error: "No pudimos abrir tu cuenta. Intenta de nuevo." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "No pudimos abrir tu cuenta. Intenta de nuevo." },
      { status: 503 },
    );
  }

  const { data: verified, error: verificationError } =
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

  if (verificationError || !verified?.session || !verified.user) {
    console.error("No se pudo confirmar la sesión directa.", verificationError);
    return NextResponse.json(
      { error: "No pudimos abrir tu cuenta. Intenta de nuevo." },
      { status: 503 },
    );
  }

  return { userId: verified.user.id };
}
