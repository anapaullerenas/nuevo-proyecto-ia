import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";

export default function RegistroPage() {
  return (
    <main className="auth-page">
      <section className="auth-copy">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" />
          <span>
            <b>Proyecto IA</b>
            <small>Registro</small>
          </span>
        </Link>
        <h2>El registro no empieza con anuncios. Empieza con contexto.</h2>
        <p>
          Primero creas tu acceso. Luego completas la memoria madre de la marca:
          oferta, audiencia, voz, claims y quien produce el contenido.
        </p>
        <div className="mini-steps">
          <span>1. Cuenta</span>
          <span>2. Marca</span>
          <span>3. Dashboard vacio listo para operar</span>
        </div>
      </section>
      <AuthPanel mode="registro" />
    </main>
  );
}
