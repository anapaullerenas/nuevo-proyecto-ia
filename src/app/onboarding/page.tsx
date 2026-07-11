import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandOnboardingForm } from "@/components/BrandOnboardingForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="setup-state">
        <h1>Supabase aun no esta conectado</h1>
        <p>Cuando las variables esten listas, este onboarding guardara marcas reales.</p>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="onboarding-page">
      <nav className="public-nav compact">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" />
          <span>
            <b>Proyecto IA</b>
            <small>Marca madre</small>
          </span>
        </Link>
      </nav>
      <section className="onboarding-shell">
        <div className="onboarding-intro">
          <span className="eyebrow">Paso 2 de 3</span>
          <h1>Registra la informacion madre de tu marca.</h1>
          <p>
            Esta informacion sera la base para el chat IA, analisis Meta,
            analisis creativos y generacion de estaticos. No hay datos
            precargados: todo empieza con lo que guardes aqui.
          </p>
        </div>
        <BrandOnboardingForm />
      </section>
    </main>
  );
}
