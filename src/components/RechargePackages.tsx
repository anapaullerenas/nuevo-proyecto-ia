"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { RECHARGE_PACKAGES } from "@/lib/recharge-packages";

const packages = Object.entries(RECHARGE_PACKAGES).map(([id, pack]) => ({
  id,
  name: pack.name,
  price: `US$${pack.amount}`,
  credits: `${pack.credits.toLocaleString("es-MX")} créditos`,
  note: pack.note,
}));

export function RechargePackages() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPayment = searchParams.get("payment");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState(
    initialPayment === "cancelled"
      ? "Pago cancelado. No se realizó ningún cargo ni cambio de saldo."
      : initialPayment === "success"
        ? "Pago recibido. Confirmando el abono de créditos…"
        : "",
  );
  const [tone, setTone] = useState<"success" | "warning" | "error">("warning");

  useEffect(() => {
    const payment = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");
    if (payment === "cancelled") return;
    if (payment !== "success" || !sessionId) return;

    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/stripe/status?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No pudimos confirmar el pago.");
        if (data.status === "paid") {
          if (cancelled) return;
          setTone("success");
          setMessage(`Pago confirmado. Se abonaron ${Number(data.credits).toLocaleString("es-MX")} créditos.`);
          window.history.replaceState({}, "", "/cuenta");
          router.refresh();
          return;
        }
        if (data.status === "failed" || data.status === "expired") {
          if (cancelled) return;
          setTone("error");
          setMessage("Stripe no confirmó el pago. No se abonaron créditos.");
          return;
        }
      } catch (error) {
        if (attempts >= 10 && !cancelled) {
          setTone("warning");
          setMessage(error instanceof Error ? error.message : "La confirmación está tardando. Actualiza la página en unos segundos.");
          return;
        }
      }
      if (!cancelled && attempts < 10) window.setTimeout(check, 1500);
    };

    void check();
    return () => { cancelled = true; };
  }, [router, searchParams]);

  async function openCheckout(packageId: string) {
    setBusy(packageId);
    setMessage("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ package: packageId }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "No pudimos abrir Stripe.");
      window.location.assign(data.url);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "No pudimos abrir Stripe.");
      setBusy(null);
    }
  }

  return <>
    <section className="stripe-assurance">
      <ShieldCheck />
      <span>Pago seguro con tarjeta procesado por Stripe. AnaPau iA nunca recibe los datos de tu tarjeta.</span>
    </section>
    <section className="credit-packages">
      {packages.map((pack) => <article key={pack.id}>
        <span>{pack.name}</span>
        <b>{pack.price}</b>
        <p>{pack.credits}</p>
        <small>{pack.note}</small>
        <button type="button" disabled={Boolean(busy)} onClick={() => void openCheckout(pack.id)}>
          {busy === pack.id ? <Loader2 className="spin" /> : <CreditCard />}
          {busy === pack.id ? "Abriendo Stripe…" : "Pagar con tarjeta"}
        </button>
      </article>)}
    </section>
    {message && <p className={`recharge-status ${tone}`}>
      {tone === "success" && <CheckCircle2 />}
      {tone !== "success" && <ShieldCheck />}
      <span>{message}</span>
    </p>}
  </>;
}
