"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function cleanNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function readHashParams() {
  if (typeof window === "undefined" || !window.location.hash) {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.hash.slice(1));
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirmando tu acceso...");

  useEffect(() => {
    let isMounted = true;

    async function finishSignIn() {
      const supabase = createSupabaseBrowserClient();
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = readHashParams();
      const next = cleanNextPath(searchParams.get("next") || hashParams.get("next"));
      const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");

      if (errorDescription) {
        throw new Error(errorDescription);
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          throw error;
        }

        router.replace(next);
        router.refresh();
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") || "magiclink";

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "magiclink" | "email",
        });

        if (error) {
          throw error;
        }

        router.replace(next);
        router.refresh();
        return;
      }

      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        router.replace(next);
        router.refresh();
        return;
      }

      throw new Error("El enlace de acceso no trajo una validacion valida.");
    }

    finishSignIn().catch((error) => {
      console.error("No se pudo completar el acceso por correo.", error);

      if (isMounted) {
        setMessage("No pudimos confirmar tu acceso. Pide un nuevo enlace e intenta otra vez.");
      }

      window.setTimeout(() => {
        router.replace("/login?error=callback");
      }, 1800);
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <span className="eyebrow">Acceso</span>
        <h2>Estamos abriendo tu cuenta.</h2>
        <p>No cierres esta ventana; en un momento entraras a tu plataforma.</p>
      </section>
      <section className="auth-panel">
        <Loader2 className="spin" size={22} />
        <p className="form-message">{message}</p>
      </section>
    </main>
  );
}
