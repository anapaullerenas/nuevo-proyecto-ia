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
      setMessage(
        "Estamos ajustando la plataforma. Intenta de nuevo en unos minutos.",
      );
      return;
    }

    setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");

    if (mode === "login") {
      const response = await fetch("/api/auth/email-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as {
        direct?: boolean;
        redirectTo?: string;
        message?: string;
        error?: string;
      };

      setIsLoading(false);
      if (response.ok && payload.direct) {
        router.replace(payload.redirectTo || "/dashboard");
        router.refresh();
        return;
      }
      setMessage(
        payload.message || payload.error || "No pudimos validar tu acceso.",
      );
      return;
    }

    const password = String(formData.get("password") || "");
    const fullName = String(formData.get("fullName") || "");
    const supabase = createSupabaseBrowserClient();

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
      setMessage(
        "Cuenta creada. Revisa tu correo para activar el acceso y volver al onboarding.",
      );
      return;
    }

    router.push("/onboarding");
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <span className="eyebrow">
        {mode === "registro" ? "Crear acceso" : "Entrar"}
      </span>
      <h1>
        {mode === "registro"
          ? "Empieza con tu cuenta y luego registra tu marca."
          : "Vuelve a tu centro creativo."}
      </h1>
      <p>
        {mode === "registro"
          ? "Después de crear usuario, la plataforma te lleva al onboarding de marca. Nada aparece precargado."
          : "Escribe el correo con el que estás inscrita en la comunidad. Validaremos tu acceso y entrarás directamente."}
      </p>

      {mode === "registro" && (
        <label>
          Nombre
          <input
            name="fullName"
            autoComplete="name"
            placeholder="Ej. Ana Paula"
            required
          />
        </label>
      )}

      <label>
        Correo
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="correo@marca.com"
          required
        />
      </label>

      {mode === "registro" && (
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </label>
      )}

      {message && <p className="form-message">{message}</p>}

      <button className="primary-action" type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="spin" size={17} /> : null}
        {mode === "registro" ? "Crear cuenta" : "Entrar a la plataforma"}{" "}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
