"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Coins,
  Download,
  ExternalLink,
  Gauge,
  Loader2,
  Search,
  UsersRound,
  X,
} from "lucide-react";

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
  resolved_at?: string | null;
  email: string;
  name: string;
  old: boolean;
};

type UserDetail = {
  ledger: Array<{
    id: string;
    amount: number;
    reason: string;
    source: string;
    metadata: { module?: string; cost_usd?: number } | null;
    balance_after: number | null;
    allowance_remaining_after: number | null;
    created_at: string;
  }>;
  ledgerPage: number;
  ledgerPages: number;
  modules: Array<{ module: string; credits: number; cost: number; actions: number }>;
  recharges: Array<{ id: string; folio: string; package: string; amount_usd: number; credits: number; status: string; note: string | null; created_at: string }>;
  brands: Array<{ id: string; name: string; status: string; created_at: string }>;
  files: Array<{ id: string; file_name?: string | null; kind?: string; asset_type?: string; file_size?: number | null; created_at: string }>;
  gallery: Array<{ id: string; quality: string; status: string; created_at: string; url: string | null }>;
};

type SortKey = keyof Pick<UserRow, "name" | "status" | "balance" | "spent" | "apiCost" | "profit" | "revenue" | "images" | "analyses" | "storageMb" | "lastActivity" | "createdAt">;

export type AdminDashboardData = {
  metrics: {
    spent: number;
    apiCost: number;
    revenue: number;
    recharges: number;
    profit: number;
    limit: number;
    storageGb: number;
    openaiCost: number;
    anthropicCost: number;
    images: number;
    imageCost: number;
    creativeAnalyses: number;
    creativeAnalysisCost: number;
    metaAnalyses: number;
    metaAnalysisCost: number;
    briefs: number;
    users: number;
    activeUsers: number;
    inactiveUsers: number;
    pendingUsers: number;
  };
  users: UserRow[];
  recharges: Recharge[];
  pricing: Array<{ module: string; credits: number; average: number; price: number; margin: number }>;
  alerts: {
    anomalies: string[];
    lowBalance: number;
    pendingValidation: number;
    incompleteOnboarding: number;
    apiLimit: boolean;
    oldRecharges: number;
  };
};

const labels: Record<string, string> = {
  chat_message: "Chat",
  voice_note: "Transcripción",
  creative_analysis_image: "Análisis de imagen",
  creative_analysis_video: "Análisis de video",
  meta_analysis: "Análisis Meta",
  static_brief: "Ficha creativa",
  static_generate_medium: "Imagen medium",
  static_generate_high: "Imagen high",
  static_edit: "Edición",
  reference_analysis: "Referencia",
};

export function AdminConsole({ data }: { data: AdminDashboardData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "lastActivity", direction: "desc" });
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");

  const users = useMemo(() => {
    const filtered = data.users
      .filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()))
      .filter(
        (user) =>
          filter === "all" ||
          (filter === "active" && user.status === "active") ||
          (filter === "empty" && user.balance < 50) ||
          (filter === "inactive" && user.status !== "active") ||
          (filter === "recharge" && user.recharges > 0) ||
          filter === "top",
      );
    const key = filter === "top" ? "spent" : sort.key;
    const direction = filter === "top" ? "desc" : sort.direction;
    return filtered.sort((a, b) => compare(a[key], b[key]) * (direction === "asc" ? 1 : -1));
  }, [data.users, filter, query, sort]);

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

  async function loadDetail(user: UserRow, page = 1) {
    setSelected(user);
    setDetailLoading(true);
    const response = await fetch(`/api/admin?userId=${encodeURIComponent(user.id)}&page=${page}`, { cache: "no-store" });
    const result = await response.json();
    setDetailLoading(false);
    if (!response.ok) return alert(result.error);
    setDetail(result as UserDetail);
  }

  function changeSort(key: SortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }));
  }

  function csv() {
    const head = ["Correo", "Nombre", "Estado", "Saldo", "Gastados", "Costo API", "Profit", "Recargas USD", "Número recargas", "Imágenes", "Análisis", "Storage MB", "Última actividad", "Registro"];
    const rows = users.map((user) => [user.email, user.name, user.status, user.balance, user.spent, user.apiCost.toFixed(3), user.profit.toFixed(2), user.revenue.toFixed(2), user.recharges, user.images, user.analyses, user.storageMb.toFixed(1), user.lastActivity, user.createdAt]);
    const blob = new Blob([[head, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "anapau-usuarios.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const limitPct = data.metrics.limit > 0 ? Math.min(100, (data.metrics.apiCost / data.metrics.limit) * 100) : 0;
  const alerts = [
    data.alerts.anomalies.length ? `Consumo anómalo: ${data.alerts.anomalies.join(", ")}.` : "",
    data.alerts.lowBalance ? `${data.alerts.lowBalance} usuarias con menos de 50 créditos.` : "",
    data.alerts.pendingValidation ? `${data.alerts.pendingValidation} sin validar Skool después de 3 días.` : "",
    data.alerts.incompleteOnboarding ? `${data.alerts.incompleteOnboarding} con onboarding o marca incompletos.` : "",
    data.alerts.apiLimit ? "El gasto mensual de API alcanzó al menos el 80%." : "",
    data.alerts.oldRecharges ? `${data.alerts.oldRecharges} recargas llevan más de 24 horas pendientes.` : "",
  ].filter(Boolean);

  return (
    <section className="admin-shell admin-operations">
      <div className="panel-heading split">
        <div>
          <span className="eyebrow">Panel madre · este mes</span>
          <h1>Operación y rentabilidad.</h1>
          <p>Créditos, costo real, recargas y actividad en una sola lectura.</p>
        </div>
        <div className={`admin-limit ${limitPct >= 80 ? "danger" : ""}`}>
          <span>Tope API</span><b>{limitPct.toFixed(0)}%</b>
          <div><i style={{ width: `${limitPct}%` }} /></div>
          <small>${data.metrics.apiCost.toFixed(2)} de ${data.metrics.limit.toFixed(2)}</small>
        </div>
      </div>

      <div className="admin-metrics admin-metrics-live">
        <article><Coins /><span>Créditos gastados</span><b>{data.metrics.spent.toLocaleString("es-MX")}</b><small>${(data.metrics.spent * 0.01).toFixed(2)} precio · ${data.metrics.apiCost.toFixed(2)} costo</small></article>
        <article><BarChart3 /><span>Ingresos</span><b>${data.metrics.revenue.toFixed(2)}</b><small>{data.metrics.recharges} recargas aprobadas</small></article>
        <article><Gauge /><span>Profit</span><b>${data.metrics.profit.toFixed(2)}</b><small>Después de API y storage</small></article>
        <article><UsersRound /><span>Producción</span><b>{data.metrics.images}</b><small>{data.metrics.creativeAnalyses + data.metrics.metaAnalyses} análisis · {data.metrics.storageGb.toFixed(2)} GB</small></article>
      </div>

      <div className="provider-split">
        <span>OpenAI <b>${data.metrics.openaiCost.toFixed(2)}</b></span>
        <span>Anthropic <b>${data.metrics.anthropicCost.toFixed(2)}</b></span>
      </div>

      <section className="admin-counter-grid">
        <article><span>Usuarias</span><b>{data.metrics.users}</b><small>{data.metrics.activeUsers} activas · {data.metrics.inactiveUsers} inactivas · {data.metrics.pendingUsers} sin validar</small></article>
        <article><span>Imágenes</span><b>{data.metrics.images}</b><small>${data.metrics.imageCost.toFixed(3)} costo API</small></article>
        <article><span>Análisis creativos</span><b>{data.metrics.creativeAnalyses}</b><small>${data.metrics.creativeAnalysisCost.toFixed(3)} costo API</small></article>
        <article><span>Análisis Meta</span><b>{data.metrics.metaAnalyses}</b><small>${data.metrics.metaAnalysisCost.toFixed(3)} costo API</small></article>
        <article><span>Fichas creadas</span><b>{data.metrics.briefs}</b><small>Durante el mes actual</small></article>
        <article><span>Storage total</span><b>{data.metrics.storageGb.toFixed(2)} GB</b><small>${(data.metrics.storageGb * 0.021).toFixed(3)} al mes</small></article>
      </section>

      {data.recharges.length > 0 && (
        <section className="admin-recharge-queue">
          <header><div><span className="eyebrow">Recargas pendientes</span><h2>Confirmaciones por resolver</h2></div><b>{data.recharges.length}</b></header>
          {data.recharges.map((recharge) => (
            <article key={recharge.id}>
              <div><b>{recharge.folio} · {recharge.name}</b><small>{recharge.email} · {recharge.package} · {new Date(recharge.created_at).toLocaleDateString("es-MX")}</small></div>
              <span>${recharge.amount_usd} · {recharge.credits.toLocaleString("es-MX")} cr</span>
              <button disabled={busy === recharge.id} onClick={() => action({ action: "approve_recharge", requestId: recharge.id })}><Check />Aprobar</button>
              <button className="danger" disabled={busy === recharge.id} onClick={() => { const reason = prompt("Motivo del rechazo"); if (reason) action({ action: "reject_recharge", requestId: recharge.id, reason }); }}><X />Rechazar</button>
            </article>
          ))}
        </section>
      )}

      <section className="admin-user-section">
        <header>
          <div><span className="eyebrow">Usuarias</span><h2>Rentabilidad individual</h2></div>
          <div className="admin-table-tools">
            <label><Search /><input placeholder="Buscar correo o nombre" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Todas</option><option value="active">Activas</option><option value="empty">Sin saldo</option><option value="inactive">Inactivas Skool</option><option value="top">Top consumo</option><option value="recharge">Con recargas</option>
            </select>
            <button onClick={csv}><Download />CSV</button>
          </div>
        </header>
        <div className="admin-table-wrap">
          <table>
            <thead><tr>
              <Sortable label="Usuaria" column="name" onSort={changeSort} />
              <Sortable label="Estado" column="status" onSort={changeSort} />
              <Sortable label="Saldo" column="balance" onSort={changeSort} />
              <Sortable label="Gastados" column="spent" onSort={changeSort} />
              <Sortable label="Costo API" column="apiCost" onSort={changeSort} />
              <Sortable label="Profit" column="profit" onSort={changeSort} />
              <Sortable label="Recargas" column="revenue" onSort={changeSort} />
              <Sortable label="Imágenes" column="images" onSort={changeSort} />
              <Sortable label="Análisis" column="analyses" onSort={changeSort} />
              <Sortable label="Storage" column="storageMb" onSort={changeSort} />
              <Sortable label="Actividad" column="lastActivity" onSort={changeSort} />
              <Sortable label="Registro" column="createdAt" onSort={changeSort} />
            </tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.id} onClick={() => loadDetail(user)}>
                <td><b>{user.name}</b><small>{user.email}</small></td><td><span className={`admin-badge ${user.status}`}>{user.status}</span></td><td>{user.balance.toLocaleString("es-MX")}</td><td>{user.spent.toLocaleString("es-MX")}</td><td>${user.apiCost.toFixed(3)}</td><td className={user.profit >= 0 ? "profit" : "loss"}>${user.profit.toFixed(2)}</td><td>${user.revenue.toFixed(0)} · {user.recharges}</td><td>{user.images}</td><td>{user.analyses}</td><td>{user.storageMb.toFixed(1)} MB</td><td>{formatDate(user.lastActivity)}</td><td>{formatDate(user.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-pricing">
        <header><span className="eyebrow">Costos y precios</span><h2>Margen vivo por acción</h2></header>
        <div className="admin-table-wrap"><table><thead><tr><th>Acción</th><th>Créditos</th><th>Precio equivalente</th><th>Costo API promedio</th><th>Margen</th></tr></thead><tbody>{data.pricing.map((price) => <tr key={price.module}><td>{labels[price.module] || price.module}</td><td>{price.credits}</td><td>${price.price.toFixed(2)}</td><td>${price.average.toFixed(4)}</td><td>{price.margin ? `${price.margin.toFixed(1)}x` : "Sin datos"}</td></tr>)}</tbody></table></div>
      </section>

      <section className="admin-alerts"><AlertTriangle /><div><b>Alertas operativas</b>{alerts.length ? <ul>{alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul> : <p>Sin alertas activas.</p>}</div></section>

      {selected && (
        <div className="admin-drawer">
          <button onClick={() => { setSelected(null); setDetail(null); }} aria-label="Cerrar detalle"><X /></button>
          <span className="eyebrow">Detalle de usuaria</span><h2>{selected.name}</h2><p>{selected.email}</p>
          <div className="drawer-kpis"><span><b>{selected.balance.toLocaleString("es-MX")}</b> saldo</span><span><b>${selected.apiCost.toFixed(3)}</b> costo API</span><span><b>${selected.profit.toFixed(2)}</b> profit</span></div>
          <div className="drawer-actions"><button onClick={() => { const amount = Number(prompt("Créditos a regalar")); const reason = prompt("Motivo"); if (amount && reason) action({ action: "grant", userId: selected.id, amount, reason }); }}>Regalar créditos</button><button onClick={() => action({ action: "status", userId: selected.id, status: selected.status === "active" ? "inactive" : "active" })}>{selected.status === "active" ? "Desactivar" : "Activar"}</button></div>
          {detailLoading && <div className="admin-detail-loading"><Loader2 className="spin" /> Cargando detalle…</div>}
          {detail && !detailLoading && (
            <>
              <h3>Consumo por módulo</h3><div className="drawer-breakdown">{detail.modules.map((item) => <span key={item.module}><b>{labels[item.module] || item.module}</b><small>{item.credits.toLocaleString("es-MX")} cr · {item.actions} acciones · ${item.cost.toFixed(3)}</small></span>)}</div>
              <h3>Movimientos</h3>{detail.ledger.map((entry) => <article key={entry.id}><span>{labels[entry.metadata?.module || ""] || entry.reason}</span><b>{entry.amount}</b><time>{formatDate(entry.created_at)}</time></article>)}
              <div className="drawer-pagination"><button disabled={detail.ledgerPage <= 1} onClick={() => loadDetail(selected, detail.ledgerPage - 1)}><ChevronLeft />Anterior</button><span>{detail.ledgerPage} de {detail.ledgerPages}</span><button disabled={detail.ledgerPage >= detail.ledgerPages} onClick={() => loadDetail(selected, detail.ledgerPage + 1)}>Siguiente<ChevronRight /></button></div>
              <h3>Recargas</h3><div className="drawer-list">{detail.recharges.length ? detail.recharges.map((item) => <span key={item.id}><b>{item.folio} · {item.package}</b><small>${item.amount_usd} · {item.credits.toLocaleString("es-MX")} cr · {item.status}</small></span>) : <small>Sin recargas.</small>}</div>
              <h3>Marcas y archivos</h3><p><b>Marcas:</b> {detail.brands.map((brand) => brand.name).join(", ") || "Sin marca"}</p><div className="drawer-list">{detail.files.slice(0, 30).map((file) => <span key={file.id}><b>{file.file_name || file.asset_type || file.kind || "Archivo"}</b><small>{((Number(file.file_size || 0)) / 1_000_000).toFixed(1)} MB · {formatDate(file.created_at)}</small></span>)}</div>
              <h3>Galería</h3><div className="drawer-gallery">{detail.gallery.filter((item) => item.url).map((item) => <a key={item.id} href={item.url || "#"} target="_blank" rel="noreferrer"><Image unoptimized width={160} height={200} src={item.url || ""} alt={`Creativo ${item.quality}`} /><ExternalLink /></a>)}</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Sortable({ label, column, onSort }: { label: string; column: SortKey; onSort: (column: SortKey) => void }) {
  return <th><button className="admin-sort" onClick={() => onSort(column)}>{label}<ChevronsUpDown /></button></th>;
}

function compare(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
