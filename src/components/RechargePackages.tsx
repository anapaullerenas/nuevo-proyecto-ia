"use client";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

const packages = [
  { id: "impulso", name: "Impulso", price: "$10", credits: "2,000 créditos", note: "Para impulsar pruebas puntuales" },
  { id: "crecimiento", name: "Crecimiento", price: "$25", credits: "6,000 créditos", note: "Para crear y analizar cada semana" },
  { id: "estudio", name: "Estudio", price: "$50", credits: "14,000 créditos", note: "Para producción creativa continua" },
];

export function RechargePackages({ pendingFolio }: { pendingFolio?: string | null }) {
  const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState("");
  async function requestRecharge(packageId: string) {
    setBusy(packageId); setMessage("");
    try { const response = await fetch("/api/recharges", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ package: packageId }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage(`Solicitud creada · ${data.folio}`); if (data.whatsappUrl) window.open(data.whatsappUrl, "_blank", "noopener,noreferrer"); else setMessage(`Solicitud ${data.folio} creada. La administradora recibirá tu folio.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos crear la solicitud."); } finally { setBusy(null); }
  }
  return <><section className="credit-packages">{packages.map((pack) => <article key={pack.id}><span>{pack.name}</span><b>{pack.price}</b><p>{pack.credits}</p><small>{pack.note}</small><button type="button" disabled={Boolean(pendingFolio) || Boolean(busy)} onClick={() => requestRecharge(pack.id)}>{busy === pack.id ? <Loader2 className="spin" /> : <MessageCircle />} Solicitar por WhatsApp</button></article>)}</section>{pendingFolio && <p className="recharge-pending">Esperando confirmación de pago · folio <b>{pendingFolio}</b></p>}{message && <p className="form-message">{message}</p>}</>;
}
