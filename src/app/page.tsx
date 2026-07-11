import Link from "next/link";
import {
  ArrowRight,
  Brain,
  ChartNoAxesCombined,
  ImagePlus,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="public-nav">
        <Link href="/" className="brand-lockup" aria-label="Proyecto IA">
          <span className="brand-mark" />
          <span>
            <b>Proyecto IA</b>
            <small>Creative operating studio</small>
          </span>
        </Link>
        <div>
          <Link href="/login">Entrar</Link>
          <Link href="/registro" className="nav-cta">
            Crear cuenta
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} /> IA para creativas, marcas y performance
          </span>
          <h1>Tu sistema para decidir, crear y medir anuncios sin perder el hilo.</h1>
          <p>
            Registra tu marca una vez. Desde ahi la IA usa esa memoria para
            analizar creativos, leer tus exports de Meta, conversar contigo y
            convertir aprendizajes en nuevos estaticos.
          </p>
          <div className="hero-actions">
            <Link href="/registro" className="primary-action">
              Empezar registro <ArrowRight size={17} />
            </Link>
            <Link href="/login" className="secondary-action">
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <aside className="flow-board" aria-label="Flujo de la plataforma">
          <div>
            <span>01</span>
            <b>Registro</b>
            <p>Cuenta, acceso Skool y saldo inicial.</p>
          </div>
          <div>
            <span>02</span>
            <b>Marca madre</b>
            <p>Oferta, audiencia, voz, claims y quien produce contenido.</p>
          </div>
          <div>
            <span>03</span>
            <b>Operacion IA</b>
            <p>Chat, Meta, creativos, estaticos y decisiones guardadas.</p>
          </div>
        </aside>
      </section>

      <section className="feature-strip">
        <article>
          <MessageCircle />
          <b>Chat IA</b>
          <p>Tu mano derecha para decidir que producir y por que.</p>
        </article>
        <article>
          <ChartNoAxesCombined />
          <b>Analisis Meta</b>
          <p>Sube exports y convierte datos en acciones creativas.</p>
        </article>
        <article>
          <Brain />
          <b>Analisis creativo</b>
          <p>Score, psicologia, estructura, variantes y prompts.</p>
        </article>
        <article>
          <ImagePlus />
          <b>Crear estaticos</b>
          <p>Brief, referencias, versiones y edicion con IA.</p>
        </article>
      </section>

      <section className="access-note">
        <ShieldCheck size={22} />
        <div>
          <b>Acceso pensado para miembros activos</b>
          <p>
            La base ya contempla estado Skool, saldo de creditos y bloqueo de
            consumo cuando una membresia no este activa. La integracion directa
            con Skool se conectara al final del flujo.
          </p>
        </div>
      </section>
    </main>
  );
}
