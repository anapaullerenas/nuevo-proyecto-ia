"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clipboard, FileJson, Loader2, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { WorkspaceBrand } from "@/lib/workspace";

type BrandForm = {
  name: string; website: string; category: string; content_owner: string; audience: string; offer: string; voice: string; creative_goal: string;
  brand_story: string; differentiators: string; pains: string; desires: string; objections: string; awareness: string; angles: string; proof: string; beliefs: string; forbidden_claims: string; visual_direction: string;
};

const strategicKeys = ["brand_story", "differentiators", "pains", "desires", "objections", "awareness", "angles", "proof", "beliefs", "forbidden_claims", "visual_direction"] as const;

export function BrandOnboardingForm({ initialBrand, submitLabel = "Guardar marca madre" }: { initialBrand?: WorkspaceBrand; submitLabel?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);
  const context = initialBrand?.strategic_context || {};
  const [form, setForm] = useState<BrandForm>({
    name: initialBrand?.name || "", website: initialBrand?.website || "", category: initialBrand?.category || "", content_owner: initialBrand?.content_owner || "owner", audience: initialBrand?.audience || "", offer: initialBrand?.offer || "", voice: initialBrand?.voice || "", creative_goal: initialBrand?.creative_goal || "",
    brand_story: context.brand_story || "", differentiators: context.differentiators || "", pains: context.pains || "", desires: context.desires || "", objections: context.objections || "", awareness: context.awareness || "", angles: context.angles || "", proof: context.proof || "", beliefs: context.beliefs || "", forbidden_claims: context.forbidden_claims || "", visual_direction: context.visual_direction || "",
  });

  const extractionPrompt = useMemo(() => buildExtractionPrompt(form.name), [form.name]);
  const update = (key: keyof BrandForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function copyPrompt() {
    await navigator.clipboard.writeText(extractionPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function importFromAi() {
    try {
      const parsed = JSON.parse(importText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, ""));
      const brand = parsed.brand || parsed;
      const strategic = parsed.strategic_context || parsed.contexto_estrategico || {};
      setForm((current) => {
        const next = { ...current };
        (["name", "website", "category", "audience", "offer", "voice", "creative_goal"] as const).forEach((key) => { if (typeof brand[key] === "string") next[key] = brand[key]; });
        strategicKeys.forEach((key) => { const value = strategic[key]; if (typeof value === "string") next[key] = value; else if (Array.isArray(value)) next[key] = value.join("\n"); });
        return next;
      });
      setMode("manual");
      setMessage("Contexto importado. Revísalo y guarda la marca.");
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
        <div className="form-grid"><Field label="Nombre de marca" value={form.name} onChange={(value) => update("name", value)} required placeholder="Escribe el nombre de tu marca" /><Field label="Sitio o Instagram" value={form.website} onChange={(value) => update("website", value)} placeholder="https:// o @usuario" /><Field label="Categoría" value={form.category} onChange={(value) => update("category", value)} required placeholder="Ej. educación, servicios, retail o tecnología" /><label>Quién crea el contenido<select value={form.content_owner} onChange={(event) => update("content_owner", event.target.value)}><option value="owner">La persona/dueña lo crea</option><option value="team">Tiene equipo interno</option><option value="agency">Agencia o freelancer</option><option value="mixed">Mixto</option></select></label></div>
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

function buildExtractionPrompt(brandName: string) {
  return `Actúa como estratega creativo senior y arquitecta de marca. Revisa TODA nuestra conversación e información previa sobre ${brandName || "mi marca"}. Tu objetivo es convertir lo que ya sabes en un brief profundo para crear anuncios de performance sin inventar datos.\n\nPrimero identifica qué información falta. Si faltan datos importantes, hazme máximo 10 preguntas incisivas sobre oferta, avatar, dolores, deseos, objeciones, nivel de conciencia, mecanismo, pruebas, ángulos, voz, claims permitidos y dirección visual. No entregues el JSON hasta que responda.\n\nDespués devuelve ÚNICAMENTE JSON válido, sin markdown, con esta estructura exacta:\n{"brand":{"name":"","website":"","category":"","audience":"","offer":"","voice":"","creative_goal":""},"strategic_context":{"brand_story":"","differentiators":"","pains":"","desires":"","objections":"","awareness":"","angles":[""],"proof":[""],"beliefs":"","forbidden_claims":[""],"visual_direction":""}}\n\nReglas: separa hechos de supuestos; no inventes claims, cifras ni testimonios; usa el lenguaje real de la audiencia cuando exista; convierte ideas vagas en información accionable para copy, conceptos y dirección de arte; si algo no se sabe, déjalo vacío.`;
}
