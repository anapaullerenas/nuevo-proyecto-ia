import { AuthPanel } from "@/components/AuthPanel";
import { BrandMark } from "@/components/BrandIdentity";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-copy">
        <BrandMark subtitle="Acceso" />
        <h2>Entra a tu sistema creativo.</h2>
        <p>
          Usa el correo con el que estás inscrita en la comunidad. Si todavía no
          has registrado marca, te llevaremos al onboarding.
        </p>
      </section>
      <AuthPanel mode="login" />
    </main>
  );
}
