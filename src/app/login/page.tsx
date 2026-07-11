import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-copy">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" />
          <span>
            <b>Proyecto IA</b>
            <small>Acceso</small>
          </span>
        </Link>
        <h2>Entra a tu sistema creativo.</h2>
        <p>
          Si todavia no has registrado marca, te llevaremos al onboarding. Si ya
          existe, veras tu dashboard con datos reales.
        </p>
        <Link href="/registro" className="text-link">
          Crear cuenta nueva
        </Link>
      </section>
      <AuthPanel mode="login" />
    </main>
  );
}
