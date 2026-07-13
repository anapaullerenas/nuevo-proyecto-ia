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
import { BrandMark, PRODUCT_NAME } from "@/components/BrandIdentity";

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="public-nav">
        <BrandMark subtitle="Creative operating studio" />
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
          <h1>{PRODUCT_NAME}: tu sistema para decidir, crear y medir anuncios sin perder el hilo.</h1>
          <p>
            Registra tu marca una vez. Desde ahí la IA usa esa memoria para
            analizar creativos, leer tus exports de Meta, conversar contigo y
            convertir aprendizajes en nuevos estáticos.
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
            <b>Operación IA</b>
            <p>Chat, Meta, creativos, estáticos y decisiones guardadas.</p>
          </div>
        </aside>
      </section>

      <section className="feature-strip">
        <article>
          <MessageCircle />
          <b>Chat IA</b>
          <p>Tu mano derecha para decidir qué producir y por qué.</p>
        </article>
        <article>
          <ChartNoAxesCombined />
          <b>Análisis Meta</b>
          <p>Sube exports y convierte datos en acciones creativas.</p>
        </article>
        <article>
          <Brain />
          <b>Análisis creativo</b>
          <p>Score, psicología, estructura, variantes y prompts.</p>
        </article>
        <article>
          <ImagePlus />
          <b>Crear estáticos</b>
          <p>Brief, referencias, versiones y edición con IA.</p>
        </article>
      </section>

      <section className="access-note">
        <ShieldCheck size={22} />
        <div>
          <b>Acceso pensado para miembros activos</b>
          <p>
            La base contempla membresía, saldo de créditos y control de acceso
            para operar con orden desde el primer día.
          </p>
        </div>
      </section>
    </main>
  );
}
