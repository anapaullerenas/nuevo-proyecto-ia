import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandIdentity";
import { BrandOnboardingForm } from "@/components/BrandOnboardingForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="setup-state">
        <h1>Estamos ajustando la plataforma</h1>
        <p>Vuelve en unos minutos para guardar tu marca.</p>
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
        <BrandMark subtitle="Marca madre" />
      </nav>
      <section className="onboarding-shell">
        <div className="onboarding-intro">
          <span className="eyebrow">Paso 1 de 3</span>
          <h1>Registra la información madre de tu marca.</h1>
          <p>
            Esta información será la base para el chat IA, análisis Meta,
            análisis creativos y generación de estáticos. No hay datos
            precargados: todo empieza con lo que guardes aquí.
          </p>
          <div className="onboarding-links">
            <Link href="/" className="secondary-action">Cancelar y volver</Link>
            <a className="secondary-action" href="/brand-template.txt" download>
              Descargar plantilla
            </a>
          </div>
        </div>
        <BrandOnboardingForm />
      </section>
    </main>
  );
}
