"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CircleDollarSign,
  Coins,
  Download,
  Gauge,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";

type ProviderStatus =
  | "operational"
  | "quota_exhausted"
  | "rate_limited"
  | "invalid_key"
  | "degraded"
  | "unconfigured";
type ProviderHealth = {
  id: "openai" | "anthropic";
  label: string;
  status: ProviderStatus;
  message: string;
  keyFingerprint: string | null;
  expectedFingerprint: string | null;
  keyMatchesExpected: boolean | null;
  model: string;
  checkedAt: string;
  latencyMs: number;
  officialMonthSpendUsd: number | null;
  configuredCreditUsd: number | null;
  estimatedBalanceUsd: number | null;
  adminReportingEnabled: boolean;
  consoleUrl: string;
};

type LedgerRow = {
  amount: number;
  reason: string;
  createdAt: string;
  balanceAfter: number | null;
  allowanceAfter: number | null;
  module: string | null;
  brandId: string | null;
};
type UserRow = {
  id: string;
  email: string;
  name: string;
  status: string;
  balance: number;
  spent: number;
  apiCost: number;
  revenue: number;
  recharges: number;
  images: number;
  analyses: number;
  storageMb: number;
  profit: number;
  lastActivity: string;
  createdAt: string;
  onboarding: boolean;
  brands: string[];
  ledger: LedgerRow[];
};
type Recharge = {
  id: string;
  folio: string;
  user_id: string;
  package: string;
  amount_usd: number;
  credits: number;
  status: string;
  note: string | null;
  created_at: string;
  email: string;
  name: string;
  old: boolean;
};
export type AdminDashboardData = {
  metrics: {
    spent: number;
    apiCost: number;
    revenue: number;
    profit: number;
    limit: number;
    storageGb: number;
    openaiCost: number;
    anthropicCost: number;
    images: number;
    analyses: number;
  };
  users: UserRow[];
  recharges: Recharge[];
  pricing: Array<{
    module: string;
    label: string;
    description: string;
    credits: number;
    estimated: number;
    average: number;
    price: number;
    profit: number;
    marginPercent: number;
    margin: number;
  }>;
  trial: {
    includedCredits: number;
    realCostLimit: number;
  };
};

export function AdminConsole({ data }: { data: AdminDashboardData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState("");
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [providerBusy, setProviderBusy] = useState(true);
  const [providerError, setProviderError] = useState("");
  const refreshProviders = useCallback(async () => {
    setProviderBusy(true);
    setProviderError("");
    try {
      const response = await fetch("/api/admin/provider-health", {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        providers?: ProviderHealth[];
        error?: string;
      };
      if (!response.ok || !result.providers)
        throw new Error(result.error || "No pudimos comprobar los proveedores.");
      setProviders(result.providers);
    } catch (error) {
      setProviderError(
        error instanceof Error
          ? error.message
          : "No pudimos comprobar los proveedores.",
      );
    } finally {
      setProviderBusy(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refreshProviders(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshProviders]);
  const users = useMemo(
    () =>
      data.users
        .filter((u) =>
          `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()),
        )
        .filter(
          (u) =>
            filter === "all" ||
            (filter === "active" && u.status === "active") ||
            (filter === "empty" && u.balance < 50) ||
            (filter === "inactive" && u.status !== "active") ||
            (filter === "recharge" && u.recharges > 0),
        )
        .sort((a, b) => (filter === "top" ? b.spent - a.spent : 0)),
    [data.users, query, filter],
  );
  async function action(payload: Record<string, unknown>) {
    setBusy(String(payload.requestId || payload.userId || "action"));
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setBusy("");
    if (!response.ok) return alert(result.error);
    window.location.reload();
  }
  function csv() {
    const head = [
      "Correo",
      "Nombre",
      "Estado",
      "Saldo",
      "Gastados",
      "Costo API",
      "Profit",
      "Recargas",
      "Imágenes",
      "Análisis",
      "Storage MB",
      "Última actividad",
    ];
    const rows = users.map((u) => [
      u.email,
      u.name,
      u.status,
      u.balance,
      u.spent,
      u.apiCost.toFixed(3),
      u.profit.toFixed(2),
      u.recharges,
      u.images,
      u.analyses,
      u.storageMb.toFixed(1),
      u.lastActivity,
    ]);
    const blob = new Blob(
      [
        [head, ...rows]
          .map((r) =>
            r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
          )
          .join("\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anapau-usuarios.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const limitPct = Math.min(
    100,
    (data.metrics.apiCost / data.metrics.limit) * 100,
  );
  return (
    <section className="admin-shell admin-operations">
      <div className="panel-heading split">
        <div>
          <span className="eyebrow">Panel madre · este mes</span>
          <h1>Operación y rentabilidad.</h1>
          <p>Créditos, costo real, recargas y actividad en una sola lectura.</p>
        </div>
        <div className={`admin-limit ${limitPct >= 80 ? "danger" : ""}`}>
          <span>Tope API</span>
          <b>{limitPct.toFixed(0)}%</b>
          <div>
            <i style={{ width: `${limitPct}%` }} />
          </div>
          <small>
            ${data.metrics.apiCost.toFixed(2)} de ${data.metrics.limit}
          </small>
        </div>
      </div>
      <div className="admin-metrics admin-metrics-live">
        <article>
          <Coins />
          <span>Créditos gastados</span>
          <b>{data.metrics.spent.toLocaleString("es-MX")}</b>
          <small>
            ${(data.metrics.spent * 0.01).toFixed(2)} precio · $
            {data.metrics.apiCost.toFixed(2)} costo
          </small>
        </article>
        <article>
          <BarChart3 />
          <span>Ingresos</span>
          <b>${data.metrics.revenue.toFixed(2)}</b>
          <small>Recargas aprobadas</small>
        </article>
        <article>
          <Gauge />
          <span>Profit</span>
          <b>${data.metrics.profit.toFixed(2)}</b>
          <small>Después de API y storage</small>
        </article>
        <article>
          <UsersRound />
          <span>Producción</span>
          <b>{data.metrics.images}</b>
          <small>
            {data.metrics.analyses} análisis ·{" "}
            {data.metrics.storageGb.toFixed(2)} GB
          </small>
        </article>
      </div>
      <div className="provider-split">
        <span>
          OpenAI <b>${data.metrics.openaiCost.toFixed(2)}</b>
        </span>
        <span>
          Anthropic <b>${data.metrics.anthropicCost.toFixed(2)}</b>
        </span>
        <span>
          Inicio{" "}
          <b>
            {data.trial.includedCredits.toLocaleString("es-MX")} cr · $
            {data.trial.realCostLimit.toFixed(2)} costo real
          </b>
        </span>
      </div>
      <ProviderPulse
        providers={providers}
        loading={providerBusy}
        error={providerError}
        internalCosts={{
          openai: data.metrics.openaiCost,
          anthropic: data.metrics.anthropicCost,
        }}
        onRefresh={refreshProviders}
      />
      {data.recharges.length > 0 && (
        <section className="admin-recharge-queue">
          <header>
            <div>
              <span className="eyebrow">Recargas pendientes</span>
              <h2>Confirmaciones por resolver</h2>
            </div>
            <b>{data.recharges.length}</b>
          </header>
          {data.recharges.map((r) => (
            <article key={r.id}>
              <div>
                <b>
                  {r.folio} · {r.name}
                </b>
                <small>
                  {r.email} · {r.package} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("es-MX")}
                </small>
              </div>
              <span>
                ${r.amount_usd} · {r.credits.toLocaleString("es-MX")} cr
              </span>
              <button
                disabled={busy === r.id}
                onClick={() =>
                  action({ action: "approve_recharge", requestId: r.id })
                }
              >
                <Check />
                Aprobar
              </button>
              <button
                className="danger"
                disabled={busy === r.id}
                onClick={() => {
                  const reason = prompt("Motivo del rechazo");
                  if (reason)
                    action({
                      action: "reject_recharge",
                      requestId: r.id,
                      reason,
                    });
                }}
              >
                <X />
                Rechazar
              </button>
            </article>
          ))}
        </section>
      )}
      <section className="admin-user-section">
        <header>
          <div>
            <span className="eyebrow">Usuarias</span>
            <h2>Rentabilidad individual</h2>
          </div>
          <div className="admin-table-tools">
            <label>
              <Search />
              <input
                placeholder="Buscar correo o nombre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="empty">Sin saldo</option>
              <option value="inactive">Inactivas</option>
              <option value="top">Top consumo</option>
              <option value="recharge">Con recargas</option>
            </select>
            <button onClick={csv}>
              <Download />
              CSV
            </button>
          </div>
        </header>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuaria</th>
                <th>Estado</th>
                <th>Saldo</th>
                <th>Gastados</th>
                <th>Costo API</th>
                <th>Profit</th>
                <th>Recargas</th>
                <th>Imágenes</th>
                <th>Análisis</th>
                <th>Storage</th>
                <th>Actividad</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} onClick={() => setSelected(u)}>
                  <td>
                    <b>{u.name}</b>
                    <small>{u.email}</small>
                  </td>
                  <td>
                    <span className={`admin-badge ${u.status}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>{u.balance.toLocaleString("es-MX")}</td>
                  <td>{u.spent.toLocaleString("es-MX")}</td>
                  <td>${u.apiCost.toFixed(3)}</td>
                  <td className={u.profit >= 0 ? "profit" : "loss"}>
                    ${u.profit.toFixed(2)}
                  </td>
                  <td>
                    ${u.revenue.toFixed(0)} · {u.recharges}
                  </td>
                  <td>{u.images}</td>
                  <td>{u.analyses}</td>
                  <td>{u.storageMb.toFixed(1)} MB</td>
                  <td>
                    {new Date(u.lastActivity).toLocaleDateString("es-MX")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-pricing">
        <header>
          <div>
            <span className="eyebrow">Costos y precios</span>
            <h2>Modelo financiero por acción</h2>
          </div>
          <small>
            Precio para usuaria vs. costo estimado, costo real promedio y
            ganancia bruta.
          </small>
        </header>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acción</th>
                <th>Qué cobra</th>
                <th>Créditos</th>
                <th>Paga usuaria</th>
                <th>Costo API estimado</th>
                <th>Costo real prom.</th>
                <th>Ganancia bruta</th>
                <th>Margen bruto</th>
              </tr>
            </thead>
            <tbody>
              {data.pricing.map((p) => (
                <tr key={p.module}>
                  <td>
                    <b>{p.label}</b>
                    <small>{p.module}</small>
                  </td>
                  <td>{p.description}</td>
                  <td>{p.credits}</td>
                  <td>${p.price.toFixed(2)}</td>
                  <td>${p.estimated.toFixed(3)}</td>
                  <td>{p.average ? `$${p.average.toFixed(3)}` : "Sin uso aún"}</td>
                  <td>${p.profit.toFixed(3)}</td>
                  <td>{p.marginPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-alerts">
        <AlertTriangle />
        <div>
          <b>Alertas operativas</b>
          <p>
            {data.users.filter((u) => u.balance < 50).length} usuarias con menos
            de 50 créditos · {data.users.filter((u) => !u.onboarding).length}{" "}
            onboarding incompletos ·{" "}
            {data.recharges.filter((r) => r.old).length} recargas con más de 24
            horas.
          </p>
        </div>
      </section>
      {selected && (
        <div className="admin-drawer">
          <button onClick={() => setSelected(null)}>
            <X />
          </button>
          <span className="eyebrow">Detalle de usuaria</span>
          <h2>{selected.name}</h2>
          <p>{selected.email}</p>
          <div className="drawer-kpis">
            <span>
              <b>{selected.balance}</b> saldo
            </span>
            <span>
              <b>${selected.apiCost.toFixed(3)}</b> costo API
            </span>
            <span>
              <b>${selected.profit.toFixed(2)}</b> profit
            </span>
          </div>
          <p>
            <b>Marcas:</b> {selected.brands.join(", ") || "Sin marca"}
          </p>
          <div className="drawer-actions">
            <button
              onClick={() => {
                const amount = Number(prompt("Créditos a regalar"));
                const reason = prompt("Motivo");
                if (amount && reason)
                  action({
                    action: "grant",
                    userId: selected.id,
                    amount,
                    reason,
                  });
              }}
            >
              Regalar créditos
            </button>
            <button
              onClick={() =>
                action({
                  action: "status",
                  userId: selected.id,
                  status: selected.status === "active" ? "inactive" : "active",
                })
              }
            >
              {selected.status === "active" ? "Desactivar" : "Activar"}
            </button>
          </div>
          <h3>Historial de créditos</h3>
          {selected.ledger.length === 0 && (
            <p>Esta usuaria todavía no tiene movimientos.</p>
          )}
          {selected.ledger.map((l, i) => (
            <article
              key={`${l.createdAt}-${i}`}
              className={l.amount >= 0 ? "credit-positive" : "credit-negative"}
            >
              <span>
                <b>{creditReason(l.reason, l.module)}</b>
                <small>
                  {l.amount >= 0
                    ? "Créditos acreditados"
                    : "Créditos utilizados"}
                  {l.balanceAfter !== null || l.allowanceAfter !== null
                    ? ` · restantes ${Number(l.balanceAfter || 0) + Number(l.allowanceAfter || 0)}`
                    : ""}
                </small>
              </span>
              <b>
                {l.amount > 0 ? "+" : ""}
                {l.amount}
              </b>
              <time>{new Date(l.createdAt).toLocaleString("es-MX")}</time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProviderPulse({
  providers,
  loading,
  error,
  internalCosts,
  onRefresh,
}: {
  providers: ProviderHealth[];
  loading: boolean;
  error: string;
  internalCosts: { openai: number; anthropic: number };
  onRefresh: () => Promise<void>;
}) {
  const hasIncident = providers.some(
    (provider) => provider.status !== "operational",
  );
  return (
    <section className={`provider-pulse ${hasIncident ? "has-incident" : ""}`}>
      <header>
        <div>
          <span className="eyebrow">Pulso de proveedores</span>
          <h2>La IA, vigilada antes de que falle.</h2>
          <p>
            Comprueba cuota utilizable, modelo, llave conectada y gasto oficial.
          </p>
        </div>
        <button disabled={loading} onClick={() => void onRefresh()}>
          <RefreshCw className={loading ? "spinning" : ""} />
          {loading ? "Comprobando" : "Comprobar ahora"}
        </button>
      </header>
      {error && <div className="provider-pulse-error">{error}</div>}
      {loading && providers.length === 0 ? (
        <div className="provider-pulse-loading">
          <Activity />
          Consultando OpenAI y Anthropic con una prueba mínima…
        </div>
      ) : (
        <div className="provider-health-grid">
          {providers.map((provider) => {
            const internalCost = internalCosts[provider.id];
            return (
              <article
                key={provider.id}
                className={`provider-health-card ${provider.status}`}
              >
                <div className="provider-health-head">
                  <span className="provider-health-orbit">
                    <i />
                    {provider.id === "openai" ? <Activity /> : <ShieldCheck />}
                  </span>
                  <div>
                    <small>{provider.label}</small>
                    <h3>{statusLabel(provider.status)}</h3>
                  </div>
                  <em>{provider.latencyMs} ms</em>
                </div>
                <p>{provider.message}</p>
                <dl>
                  <div>
                    <dt>
                      <KeyRound /> Llave conectada
                    </dt>
                    <dd>{provider.keyFingerprint || "Sin configurar"}</dd>
                    <small className={keyMatchClass(provider)}>
                      {keyMatchLabel(provider)}
                    </small>
                  </div>
                  <div>
                    <dt>
                      <CircleDollarSign /> Saldo visible
                    </dt>
                    <dd>
                      {provider.estimatedBalanceUsd !== null
                        ? `$${provider.estimatedBalanceUsd.toFixed(2)}`
                        : "No expuesto por API"}
                    </dd>
                    <small>
                      {provider.officialMonthSpendUsd !== null
                        ? `$${provider.officialMonthSpendUsd.toFixed(2)} de gasto oficial este mes`
                        : `$${internalCost.toFixed(3)} estimado por Anapau este mes`}
                    </small>
                  </div>
                </dl>
                <footer>
                  <span>{provider.model}</span>
                  <time>
                    {new Date(provider.checkedAt).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                  <a href={provider.consoleUrl} target="_blank" rel="noreferrer">
                    Abrir facturación
                  </a>
                </footer>
                {!provider.adminReportingEnabled && (
                  <div className="provider-admin-key-note">
                    Agrega la llave administrativa para ver gasto oficial. El
                    saldo exacto permanece en la consola del proveedor.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <small className="provider-pulse-footnote">
        Cada comprobación hace una respuesta mínima de un token. Si la cuota se
        agota o la llave cambia, este semáforo se pondrá rojo y mostrará el motivo.
      </small>
    </section>
  );
}

function statusLabel(status: ProviderStatus) {
  const labels: Record<ProviderStatus, string> = {
    operational: "Operativo",
    quota_exhausted: "Sin cuota",
    rate_limited: "Límite temporal",
    invalid_key: "Llave rechazada",
    degraded: "Requiere atención",
    unconfigured: "Sin configurar",
  };
  return labels[status];
}

function keyMatchLabel(provider: ProviderHealth) {
  if (!provider.expectedFingerprint) return "Sin huella esperada configurada";
  return provider.keyMatchesExpected
    ? `Coincide con ${provider.expectedFingerprint}`
    : `No coincide con ${provider.expectedFingerprint}`;
}

function keyMatchClass(provider: ProviderHealth) {
  if (provider.keyMatchesExpected === null) return "";
  return provider.keyMatchesExpected ? "key-match" : "key-mismatch";
}

function creditReason(reason: string, module: string | null) {
  const key = module || reason;
  const labels: Record<string, string> = {
    refund: "Devolución automática",
    static_brief: "Ficha de anuncio",
    static_generate_medium: "Imagen estándar",
    static_generate_high: "Imagen en alta calidad",
    static_edit: "Edición de imagen",
    reference_analysis: "Análisis de referencia",
    creative_analysis_image: "Análisis de creativo",
    creative_analysis_video: "Análisis de video",
    creative_analysis_script: "Análisis de guion",
    chat_message: "Mensaje de chat",
    voice_note: "Nota de voz",
    meta_analysis: "Análisis de Meta",
    admin_grant: "Créditos de cortesía",
  };
  return labels[key] || key.replaceAll("_", " ");
}
