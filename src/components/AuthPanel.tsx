"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Mode = "registro" | "login";

export function AuthPanel({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!isSupabaseConfigured()) {
      setMessage("Supabase aun no esta conectado. Espera a que quede lista la base.");
      return;
    }

    setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const fullName = String(formData.get("fullName") || "");
    const supabase = createSupabaseBrowserClient();

    if (mode === "registro") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });

      setIsLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.session) {
        setMessage("Cuenta creada. Revisa tu correo para activar el acceso y volver al onboarding.");
        return;
      }

      router.push("/onboarding");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <span className="eyebrow">{mode === "registro" ? "Crear acceso" : "Entrar"}</span>
      <h1>{mode === "registro" ? "Empieza con tu cuenta y luego registra tu marca." : "Vuelve a tu centro creativo."}</h1>
      <p>
        {mode === "registro"
          ? "Despues de crear usuario, la plataforma te lleva al onboarding de marca. Nada aparece precargado."
          : "Usa el correo y contrasena con los que te registraste."}
      </p>

      {mode === "registro" && (
        <label>
          Nombre
          <input name="fullName" autoComplete="name" placeholder="Ej. Ana Paula" required />
        </label>
      )}

      <label>
        Correo
        <input name="email" type="email" autoComplete="email" placeholder="correo@marca.com" required />
      </label>

      <label>
        Contrasena
        <input
          name="password"
          type="password"
          autoComplete={mode === "registro" ? "new-password" : "current-password"}
          minLength={8}
          placeholder="Minimo 8 caracteres"
          required
        />
      </label>

      {message && <p className="form-message">{message}</p>}

      <button className="primary-action" type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="spin" size={17} /> : null}
        {mode === "registro" ? "Crear cuenta" : "Entrar"} <ArrowRight size={17} />
      </button>
    </form>
  );
}
