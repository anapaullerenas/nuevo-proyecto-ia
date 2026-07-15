"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clipboard, FileJson, Loader2, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { WorkspaceBrand } from "@/lib/workspace";

type ContentOwner = "owner" | "team" | "agency" | "mixed";

type BrandForm = {
  name: string; website: string; category: string; content_owner: ContentOwner; audience: string; offer: string; voice: string; creative_goal: string;
  brand_story: string; differentiators: string; pains: string; desires: string; objections: string; awareness: string; angles: string; proof: string; beliefs: string; forbidden_claims: string; visual_direction: string;
};

const strategicKeys = ["brand_story", "differentiators", "pains", "desires", "objections", "awareness", "angles", "proof", "beliefs", "forbidden_claims", "visual_direction"] as const;

const EXTRACTION_PROMPT = `Actúa como estratega creativo senior especializado en anuncios de performance. Tu tarea es llenar el onboarding de mi marca con la máxima profundidad posible SIN inventar nada.

FASE 1 — FUENTES
Antes de preguntar, extrae todo lo que puedas de: (a) esta conversación e información previa, (b) el sitio web / Instagram si te lo doy, (c) reviews, testimonios o ads anteriores que te pegue. Usa el lenguaje literal de clientes cuando exista.

FASE 2 — PREGUNTAS
Identifica solo los huecos que las fuentes no cubren. Hazme máximo 10 preguntas, ordenadas por impacto en la venta, agrupadas por tema. Para cada una dame un ejemplo de respuesta útil para que sepa el nivel de detalle que esperas. No entregues nada hasta que responda.

FASE 3 — ENTREGA
Devuelve ÚNICAMENTE JSON válido, sin markdown, con esta estructura:
{"brand":{"name":"","website":"","category":"","content_creator":"","audience":"","offer":"","voice":"","creative_goal":""},"strategic_context":{"brand_story":"","differentiators":"","pains":"","desires":"","objections":"","awareness":"","angles":[""],"proof":[""],"beliefs":"","forbidden_claims":[""],"visual_direction":""}}

REGLAS POR CAMPO (respeta el formato exacto que pide cada uno):
- audience: quién compra, contexto de vida, lenguaje real y situación actual — no demografía genérica.
- offer: qué vendo, para quién, cómo funciona, precio y condiciones relevantes.
- voice: cómo habla la marca Y qué nunca diría.
- creative_goal: qué necesita lograr con sus anuncios (negocio, no vanidad).
- brand_story: por qué existe y qué quiere cambiar.
- differentiators: qué hace distinta la oferta y por qué creerlo (no adjetivos, mecanismos).
- pains: problemas, frustraciones y momentos detonantes concretos.
- desires: resultado funcional + emocional + identidad deseada.
- objections: pares "objeción → evidencia que la resuelve".
- awareness: qué sabe hoy la audiencia del problema y de la solución (nivel dominante + matices).
- angles: un ángulo por elemento del array, tipificado: problema, deseo, mecanismo, prueba, identidad...
- proof: solo pruebas verificables (testimonios reales, cifras, proceso, credenciales). Si no hay, déjalo vacío.
- beliefs: formato "parte de creer X → debe llegar a creer Y".
- forbidden_claims: qué no se puede prometer, decir ni mostrar (legal + Meta + marca).
- visual_direction: fotografía, luz, textura, tipografía y cosas a evitar.

REGLAS GLOBALES: separa hechos de supuestos y usa solo hechos en el JSON; nunca inventes claims, cifras ni testimonios; convierte respuestas vagas en lenguaje accionable para copy y arte; lo que no se sepa queda vacío ("").`;

function normalizeContentOwner(value: unknown): ContentOwner | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (normalized === "owner" || normalized === "team" || normalized === "agency" || normalized === "mixed") return normalized;

  const hasOwner = /duen|fundador|propietari|\byo\b|persona.*marca|owner/.test(normalized);
  const hasTeam = /equipo|intern/.test(normalized);
  const hasAgency = /agencia|freelance|extern|ugc/.test(normalized);
  const matchedGroups = [hasOwner, hasTeam, hasAgency].filter(Boolean).length;

  if (/mixt|combin|varias|amb[oa]s/.test(normalized) || matchedGroups > 1) return "mixed";
  if (hasOwner) return "owner";
  if (hasTeam) return "team";
  if (hasAgency) return "agency";

  return null;
}

function fieldText(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join("\n");
  return null;
}

export function BrandOnboardingForm({ initialBrand, submitLabel = "Guardar marca madre" }: { initialBrand?: WorkspaceBrand; submitLabel?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);
  const context = initialBrand?.strategic_context || {};
  const [form, setForm] = useState<BrandForm>({
    name: initialBrand?.name || "", website: initialBrand?.website || "", category: initialBrand?.category || "", content_owner: normalizeContentOwner(initialBrand?.content_owner) || "owner", audience: initialBrand?.audience || "", offer: initialBrand?.offer || "", voice: initialBrand?.voice || "", creative_goal: initialBrand?.creative_goal || "",
    brand_story: context.brand_story || "", differentiators: context.differentiators || "", pains: context.pains || "", desires: context.desires || "", objections: context.objections || "", awareness: context.awareness || "", angles: context.angles || "", proof: context.proof || "", beliefs: context.beliefs || "", forbidden_claims: context.forbidden_claims || "", visual_direction: context.visual_direction || "",
  });

  const update = <Key extends keyof BrandForm>(key: Key, value: BrandForm[Key]) => setForm((current) => ({ ...current, [key]: value }));

  async function copyPrompt() {
    await navigator.clipboard.writeText(EXTRACTION_PROMPT);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function importFromAi() {
    try {
      const cleaned = importText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      const parsed = JSON.parse(jsonStart >= 0 && jsonEnd >= jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned);
      const brand = parsed.brand || parsed;
      const strategic = parsed.strategic_context || parsed.contexto_estrategico || {};
      const contentCreator = brand.content_creator ?? brand.content_owner;
      const contentOwner = normalizeContentOwner(contentCreator);
      setForm((current) => {
        const next = { ...current };
        (["name", "website", "category", "audience", "offer", "voice", "creative_goal"] as const).forEach((key) => {
          const value = fieldText(brand[key]);
          if (value !== null) next[key] = value;
        });
        if (contentOwner) next.content_owner = contentOwner;
        strategicKeys.forEach((key) => {
          const value = fieldText(strategic[key]);
          if (value !== null) next[key] = value;
        });
        return next;
      });
      setMode("manual");
      setMessage(typeof contentCreator === "string" && contentCreator.trim() && !contentOwner
        ? "Contexto importado. Revisa manualmente quién crea el contenido y guarda la marca."
        : "Contexto importado. Revísalo y guarda la marca.");
    } catch {
      setMessage("No pude leer ese JSON. Pídele a la IA que respete exactamente el formato del prompt.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(""); setIsLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setIsLoading(false); return setMessage("Tu sesión expiró. Vuelve a entrar."); }
    const strategic_context = Object.fromEntries(strategicKeys.map((key) => [key, form[key].trim()]));
    const payload = { owner_id: userData.user.id, name: form.name, website: form.website, category: form.category, audience: form.audience, offer: form.offer, voice: form.voice, content_owner: form.content_owner, creative_goal: form.creative_goal, strategic_context };
    const { error } = initialBrand ? await supabase.from("brands").update(payload).eq("id", initialBrand.id) : await supabase.from("brands").insert(payload);
    if (error) { setIsLoading(false); return setMessage(error.message); }
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userData.user.id);
    router.push(initialBrand ? "/marcas" : "/dashboard"); router.refresh();
  }

  async function skipOnboarding() {
    setMessage("");
    setIsLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setIsLoading(false);
      setMessage("Tu sesión expiró. Vuelve a entrar.");
      return;
    }

    const firstName = String(userData.user.user_metadata?.full_name || "").trim().split(/\s+/)[0];
    const { error } = await supabase.from("brands").insert({
      owner_id: userData.user.id,
      name: firstName ? `Marca de ${firstName}` : "Mi espacio creativo",
      category: "Por definir",
      audience: "Por definir",
      offer: "Por definir",
      voice: "Cercana y clara",
      content_owner: "owner",
      creative_goal: "Crear y analizar contenido",
      strategic_context: { onboarding_skipped: "true", brand_type: "personal" },
    });

    if (error) {
      setIsLoading(false);
      setMessage(error.message);
      return;
    }

    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userData.user.id);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="onboarding-form deep-brand-form" onSubmit={handleSubmit}>
      <section className="brand-input-paths">
        <header><div><span className="eyebrow">Dos formas de construir el brief</span><h2>Alimenta la inteligencia de tu marca</h2><p>Completa el brief aquí o trae todo lo que ya sabe ChatGPT, Claude u otra IA.</p></div><div className="brand-path-tabs"><button type="button" className={mode === "manual" ? "selected" : ""} onClick={() => setMode("manual")}>Rellenar manualmente</button><button type="button" className={mode === "ai" ? "selected" : ""} onClick={() => setMode("ai")}><Sparkles /> Traer desde una IA</button></div></header>
        {mode === "ai" && <div className="ai-brand-import"><article><span>1</span><div><b>Copia el prompt de extracción</b><p>Pégalo en la conversación donde más has hablado de tu marca. La IA primero detectará vacíos y después devolverá un JSON.</p></div><button type="button" onClick={copyPrompt}>{copied ? <Check /> : <Clipboard />}{copied ? "Copiado" : "Copiar prompt completo"}</button></article><article><span>2</span><div><b>Pega aquí el JSON final</b><p>La plataforma convertirá esa conversación en audiencia, ángulos, objeciones, pruebas y dirección visual.</p></div></article><textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'Pega aquí el JSON que te devolvió la IA…'} /><button className="secondary-action" type="button" onClick={importFromAi}><FileJson /> Autorrellenar brief</button></div>}
      </section>

      <section className="brand-brief-fields">
        <div className="form-grid"><Field label="Nombre de marca" value={form.name} onChange={(value) => update("name", value)} required placeholder="Escribe el nombre de tu marca" /><Field label="Sitio o Instagram" value={form.website} onChange={(value) => update("website", value)} placeholder="https:// o @usuario" /><Field label="Categoría" value={form.category} onChange={(value) => update("category", value)} required placeholder="Ej. educación, servicios, retail o tecnología" /><label>Quién crea el contenido<select value={form.content_owner} onChange={(event) => update("content_owner", normalizeContentOwner(event.target.value) || "owner")}><option value="owner">La persona/dueña lo crea</option><option value="team">Tiene equipo interno</option><option value="agency">Agencia o freelancer</option><option value="mixed">Mixto</option></select></label></div>
        <TextField label="Audiencia y avatar" value={form.audience} onChange={(value) => update("audience", value)} required placeholder="Quién compra, contexto de vida, lenguaje y situación actual." />
        <TextField label="Oferta principal" value={form.offer} onChange={(value) => update("offer", value)} required placeholder="Qué vendes, para quién, cómo funciona, precio y condiciones relevantes." />
        <div className="form-grid"><TextField label="Voz de marca" value={form.voice} onChange={(value) => update("voice", value)} required placeholder="Cómo habla y qué nunca diría." /><TextField label="Objetivo creativo" value={form.creative_goal} onChange={(value) => update("creative_goal", value)} placeholder="Qué necesita lograr con sus anuncios." /></div>
      </section>

      <details className="strategic-depth" open><summary><div><span className="eyebrow">Brief de estratega creativo</span><b>Contexto psicológico y ángulos</b></div><small>La capa que mejora copies y decisiones visuales</small></summary><div className="strategic-field-grid"><TextField label="Historia y creencia de marca" value={form.brand_story} onChange={(v) => update("brand_story", v)} placeholder="Por qué existe y qué quiere cambiar." /><TextField label="Diferenciadores reales" value={form.differentiators} onChange={(v) => update("differentiators", v)} placeholder="Qué hace distinta a la oferta y por qué creerlo." /><TextField label="Dolores y tensiones" value={form.pains} onChange={(v) => update("pains", v)} placeholder="Problemas, frustraciones y momentos detonantes." /><TextField label="Deseos profundos" value={form.desires} onChange={(v) => update("desires", v)} placeholder="Resultado funcional, emocional e identidad deseada." /><TextField label="Objeciones" value={form.objections} onChange={(v) => update("objections", v)} placeholder="Qué frena la compra y qué evidencia lo resuelve." /><TextField label="Nivel de conciencia" value={form.awareness} onChange={(v) => update("awareness", v)} placeholder="Qué sabe hoy la audiencia del problema y la solución." /><TextField label="Ángulos creativos" value={form.angles} onChange={(v) => update("angles", v)} placeholder="Un ángulo por línea: problema, deseo, mecanismo, prueba…" /><TextField label="Pruebas y razones para creer" value={form.proof} onChange={(v) => update("proof", v)} placeholder="Testimonios, proceso, demostraciones, cifras o credenciales verificables." /><TextField label="Creencias que hay que mover" value={form.beliefs} onChange={(v) => update("beliefs", v)} placeholder="De qué creencia parte y a cuál debe llegar." /><TextField label="Claims y límites" value={form.forbidden_claims} onChange={(v) => update("forbidden_claims", v)} placeholder="Qué no se puede prometer, decir o mostrar." /><TextField label="Dirección visual" value={form.visual_direction} onChange={(v) => update("visual_direction", v)} placeholder="Fotografía, luz, textura, tipografía y cosas a evitar." /></div></details>

      {message && <p className="form-message">{message}</p>}
      <div className="onboarding-submit-actions">
        {!initialBrand && <button className="secondary-action" type="button" disabled={isLoading} onClick={skipOnboarding}>Omitir por ahora</button>}
        <button className="primary-action" type="submit" disabled={isLoading}>{isLoading && <Loader2 className="spin" />}{submitLabel}<ArrowRight /></button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) { return <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} /></label>; }
function TextField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) { return <label>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} /></label>; }
