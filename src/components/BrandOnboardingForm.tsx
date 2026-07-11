"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function BrandOnboardingForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setIsLoading(false);
      setMessage("Tu sesion expiro. Vuelve a entrar.");
      return;
    }

    const { error } = await supabase.from("brands").insert({
      owner_id: userData.user.id,
      name: String(formData.get("name") || ""),
      website: String(formData.get("website") || ""),
      category: String(formData.get("category") || ""),
      audience: String(formData.get("audience") || ""),
      offer: String(formData.get("offer") || ""),
      voice: String(formData.get("voice") || ""),
      content_owner: String(formData.get("content_owner") || "owner"),
      creative_goal: String(formData.get("creative_goal") || ""),
    });

    if (error) {
      setIsLoading(false);
      setMessage(error.message);
      return;
    }

    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userData.user.id);

    router.push("/dashboard");
  }

  return (
    <form className="onboarding-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Nombre de marca
          <input name="name" placeholder="Ej. marca de skincare, agencia, tienda..." required />
        </label>
        <label>
          Sitio o Instagram
          <input name="website" placeholder="https:// o @usuario" />
        </label>
        <label>
          Categoria
          <input name="category" placeholder="Belleza, moda, cursos, ecommerce..." required />
        </label>
        <label>
          Quien crea el contenido
          <select name="content_owner" defaultValue="owner">
            <option value="owner">La persona/duena lo crea</option>
            <option value="team">Tiene equipo interno</option>
            <option value="agency">Lo delega a agencia/freelancer</option>
            <option value="mixed">Mixto</option>
          </select>
        </label>
      </div>

      <label>
        Audiencia
        <textarea name="audience" placeholder="A quien le vende, que desea, que objeciones tiene..." required />
      </label>
      <label>
        Oferta principal
        <textarea name="offer" placeholder="Producto, promesa, precio, bonus, garantia, mecanismo..." required />
      </label>
      <label>
        Voz de marca
        <textarea name="voice" placeholder="Como habla, que palabras usa, que nunca diria..." required />
      </label>
      <label>
        Objetivo creativo inicial
        <textarea name="creative_goal" placeholder="Ej. encontrar ganadores para Meta, crear estaticos, analizar videos..." />
      </label>

      {message && <p className="form-message">{message}</p>}

      <button className="primary-action" type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="spin" size={17} /> : null}
        Guardar marca madre <ArrowRight size={17} />
      </button>
    </form>
  );
}
