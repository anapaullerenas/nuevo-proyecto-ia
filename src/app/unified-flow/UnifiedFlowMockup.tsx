"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Bot,
  Brain,
  ChartNoAxesCombined,
  Check,
  CircleDollarSign,
  ClipboardCopy,
  Eye,
  FileSpreadsheet,
  Filter,
  ImagePlus,
  LayoutDashboard,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRoundCheck,
  WandSparkles,
  WalletCards,
  Zap,
} from "lucide-react";
import styles from "./unified-flow.module.css";

export type View = "home" | "chat" | "meta" | "creative" | "static" | "brands" | "account" | "admin";

const tabs: { id: Exclude<View, "admin">; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "chat", label: "Chat IA", icon: MessageCircle },
  { id: "meta", label: "Análisis Meta", icon: ChartNoAxesCombined },
  { id: "creative", label: "Análisis creativos", icon: Brain },
  { id: "static", label: "Crear estáticos", icon: ImagePlus },
  { id: "brands", label: "Mis marcas", icon: UserRoundCheck },
  { id: "account", label: "Cuenta", icon: WalletCards },
];

const viewLabels: Record<View, string> = {
  home: "Home",
  chat: "Chat IA",
  meta: "Análisis Meta",
  creative: "Análisis creativos",
  static: "Crear estáticos",
  brands: "Mis marcas",
  account: "Cuenta",
  admin: "Admin",
};

const viewCopy: Record<View, string> = {
  home: "Centro de mando con próximas acciones, marca activa, saldo y accesos principales.",
  chat: "La IA actúa como directora creativa: lee contexto, recomienda y abre módulos.",
  meta: "Dashboard para subir export de Meta, detectar ganadores y decidir qué producir.",
  creative: "Análisis profundo: carga video o imagen, revisa biblioteca, score, psicología, receta, variantes y prompts.",
  static: "Studio premium para crear estáticos con dirección, referencias, variantes y edición.",
  brands: "Memoria madre que alimenta todas las funciones y define quién produce contenido.",
  account: "Créditos, Skool, facturación, acceso y panel de control de la dueña.",
  admin: "Control interno de usuarios, membresía, recargas, consumo, límites y rentabilidad.",
};

const winnerRows = [
  ["CREM07", "Demo piel sensible", "3.8x", "Ganador", "Crear 5 estáticos"],
  ["CREM02", "Antes/después editorial", "2.9x", "Escalar", "Analizar fórmula"],
  ["CREM14", "Testimonio texto", "2.2x", "Iterar", "Cambiar hook"],
  ["CREM11", "Producto en baño", "1.1x", "Pausar", "Oferta débil"],
];

const recipe = [
  "Abre nombrando la objeción principal del cliente escéptico.",
  "Demuestra producto en piel real, no en un estudio perfecto.",
  "Usa triple negación rítmica para romper objeciones rápido.",
  "Cierra con libertad emocional, no solo con beneficio funcional.",
];

const variants = [
  ["Variante 01", "Hook de objeción", "Parece calcomanía → se ve real en piel"],
  ["Variante 02", "Prueba social", "Antes de salir / después del gym"],
  ["Variante 03", "Oferta", "Kit 2 semanas + garantía visible"],
];

const analysisTabs = ["Dashboard", "Estructura", "Psicología", "Guion", "Variantes", "Prompts", "Plan réplica"];

const studioModes = [
  ["Desde cero", "Idea nueva con memoria de marca"],
  ["Adaptar ganador", "Convierte un análisis en estático"],
  ["Variantes", "Cambia hook, oferta o ángulo"],
  ["Lote 5", "Hipótesis listas para test"],
];

const metaChecklist = [
  "Nombre del anuncio y conjunto",
  "Importe gastado",
  "Impresiones y alcance",
  "CTR y clics",
  "Costo por resultado / CPA",
  "ROAS de compras",
  "Reproducciones de video 3s, 25%, 50%, 75%",
  "Compras, leads o resultado principal",
];

const brandSections = [
  ["Historia", "Por qué existe, qué combate y qué promete."],
  ["Producto", "Mecanismo, beneficios, diferenciales y bundles."],
  ["Audiencia", "Dolores, objeciones, deseo profundo y lenguaje real."],
  ["Voz", "Cómo habla, qué palabras usa y qué nunca diría."],
  ["Visual", "Paleta, foto, referencias, estilos permitidos y prohibidos."],
  ["Claims", "Pruebas, legales, disclaimers y promesas aprobadas."],
];

const adminUsers = [
  ["Mariana López", "Skool activo", "$24.00", "1,860", "$7.40", "Rentable"],
  ["Fer Rivas", "Skool activo", "$10.00", "620", "$2.16", "Normal"],
  ["Paula Méndez", "Sin membresía", "$0.00", "0", "$0.00", "Bloqueado"],
  ["Ana Torres", "Skool activo", "$19.00", "240", "$1.10", "Bajo uso"],
];

const adminLedger = [
  ["Recarga mínima", "$10", "1,000 créditos", "saldo prepago"],
  ["Bono mensual Skool", "$19", "300 créditos", "máx. costo $3"],
  ["Imagen estándar", "70 créditos", "costo estimado $0.04-$0.06", "margen 7x-10x"],
  ["Análisis creativo", "120 créditos", "costo estimado $0.02-$0.08", "margen 12x+"],
  ["Análisis Meta", "60 créditos", "costo estimado <$0.03", "margen alto"],
];

function FlowerMark() {
  return <span className={styles.flower} aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>;
}

export function UnifiedFlowMockup({ initialView = "home" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const activeLabel = useMemo(() => viewLabels[view], [view]);

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <button className={styles.brandButton} onClick={() => setView("home")} aria-label="Ir a home">
        <FlowerMark />
        <span><b>Proyecto IA</b><small>Studio creativo unificado</small></span>
      </button>
      <nav className={styles.mainNav} aria-label="Módulos principales">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} className={view === tab.id ? styles.active : ""} onClick={() => setView(tab.id)}>
            <Icon size={15} /><span>{tab.label}</span>
          </button>;
        })}
      </nav>
      <section className={styles.accountStrip}>
        <div><span>Marca activa</span><b>Skinglow</b></div>
        <div><span>Créditos</span><b>1,248</b></div>
      </section>
    </header>

    <section className={styles.workspace}>
      <section className={styles.moduleIntro}>
        <h1>{activeLabel}</h1>
        <p>{viewCopy[view]}</p>
      </section>
      <section className={styles.productCanvas}>
        {view === "home" && <HomeView setView={setView} />}
        {view === "chat" && <ChatView setView={setView} />}
        {view === "meta" && <MetaView />}
        {view === "creative" && <CreativeView />}
        {view === "static" && <StaticView />}
        {view === "brands" && <BrandsView />}
        {view === "account" && <AccountView setView={setView} />}
        {view === "admin" && <AdminView />}
      </section>
    </section>
  </main>;
}

function HomeView({ setView }: { setView: (view: View) => void }) {
  const cards: { view: View; title: string; copy: string; cost: string; icon: React.ElementType }[] = [
    { view: "chat", title: "Chat IA", copy: "Pregunta qué hacer, pide ideas o abre un flujo guiado.", cost: "Gratis para orientar", icon: Bot },
    { view: "meta", title: "Análisis Meta", copy: "Sube export, detecta ganadores y decide presupuesto.", cost: "6 créditos", icon: FileSpreadsheet },
    { view: "creative", title: "Análisis creativos", copy: "Diagnóstico profundo de video o imagen.", cost: "8-18 créditos", icon: Brain },
    { view: "static", title: "Crear estáticos", copy: "Studio con referencias, variantes y edición por chat.", cost: "14 créditos", icon: ImagePlus },
    { view: "brands", title: "Mis marcas", copy: "Memoria madre, assets, claims y filtro de producción.", cost: "Base del sistema", icon: UserRoundCheck },
    { view: "account", title: "Cuenta", copy: "Créditos, Skool, facturación y permisos.", cost: "Control", icon: WalletCards },
  ];
  return <div className={styles.homeScreen}>
    <section className={styles.homeHero}>
      <div><span><Sparkles size={16} /> Plan operativo</span><h2>Semana creativa de Skinglow</h2><p>Resumen de oportunidades, saldo y próximos pasos. Todo entra por la misma memoria de marca y termina en acciones de producción.</p></div>
      <div className={styles.homeMetrics}>
        <article><b>4</b><small>ganadores detectados</small></article>
        <article><b>12</b><small>referencias madre</small></article>
        <article><b>1,248</b><small>créditos disponibles</small></article>
      </div>
      <button onClick={() => setView("chat")}>Hablar con la IA <ArrowRight size={16} /></button>
    </section>
    <section className={styles.homeActions}>{cards.map((card) => {
      const Icon = card.icon;
      return <button key={card.view} onClick={() => setView(card.view)}>
        <Icon size={21} /><b>{card.title}</b><p>{card.copy}</p><small>{card.cost}</small>
      </button>;
    })}</section>
    <aside className={styles.nextAction}><b>Siguiente mejor acción</b><p>El ganador CREM07 puede convertirse en 5 estáticos. Ya tiene objeción, prueba visual y claim claro.</p><button onClick={() => setView("static")}>Abrir studio <ArrowRight size={15} /></button></aside>
    <section className={styles.homeActivity}>
      <header><b>Actividad reciente</b><span>Últimas decisiones del sistema</span></header>
      <article><strong>CREM07</strong><span>Análisis creativo completado</span><em>76/100</em><small>Convertir en lote estático</small></article>
      <article><strong>Meta julio</strong><span>Export procesado</span><em>4 ganadores</em><small>Escalar CREM02 y pausar CREM11</small></article>
      <article><strong>Skinglow</strong><span>Memoria madre actualizada</span><em>88%</em><small>Falta claims legales</small></article>
    </section>
  </div>;
}

function ChatView({ setView }: { setView: (view: View) => void }) {
  return <div className={styles.chatScreen}>
    <section className={styles.chatThread}>
      <article className={styles.assistantBubble}>Tengo contexto de Skinglow, los últimos ganadores de Meta y 28 piezas generadas. ¿Qué quieres resolver?</article>
      <article className={styles.userBubble}>Analiza qué debo producir esta semana con los ganadores.</article>
      <article className={styles.assistantBubble}>Prioridad: convertir CREM07 en estáticos. Mantener objeción + textura real + claim suave. También pausaría CREM11 por oferta débil.</article>
      <div className={styles.chatComposer}>Pregunta o pide una acción... <button><Send size={15} /></button></div>
    </section>
    <aside className={styles.contextPanel}>
      <h3>Contexto que está leyendo</h3>
      <p><Check size={14} /> Memoria de marca Skinglow</p>
      <p><Check size={14} /> Export Meta julio</p>
      <p><Check size={14} /> 12 referencias madre analizadas</p>
      <p><Check size={14} /> 4 creativos ganadores</p>
      <button onClick={() => setView("meta")}><FileSpreadsheet size={15} /> Abrir Meta</button>
      <button onClick={() => setView("creative")}><Brain size={15} /> Abrir análisis</button>
      <button onClick={() => setView("static")}><ImagePlus size={15} /> Crear estáticos</button>
    </aside>
  </div>;
}

function MetaView() {
  return <div className={styles.metaScreen}>
    <aside className={styles.exportGuide}>
      <span>Antes de exportar desde Meta</span>
      <h2>Marca estas columnas</h2>
      <div>{metaChecklist.map((item) => <p key={item}><Check size={13} /> {item}</p>)}</div>
      <button><UploadCloud size={15} /> Subir CSV/XLSX</button>
    </aside>
    <section className={styles.metaDashboard}>
      <header><div><span>Dashboard de ganadores</span><h2>Lectura de campaña</h2></div><button><ClipboardCopy size={15} /> Copiar resumen</button></header>
      <div className={styles.kpis}><article><b>3.8x</b><span>Mejor ROAS</span></article><article><b>27%</b><span>Hook rate</span></article><article><b>$182</b><span>CPA ganador</span></article><article><b>4</b><span>Acciones</span></article></div>
      <div className={styles.metaChart}>{[58, 34, 78, 45, 66, 29, 82, 52, 71].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
      <div className={styles.winnerTable}>{winnerRows.map(([id, name, roas, status, action]) => <article key={id}><b>{id}</b><span>{name}</span><strong>{roas}</strong><em>{status}</em><small>{action}</small></article>)}</div>
    </section>
    <aside className={styles.metaInsight}>
      <BadgeCheck size={24} /><h3>Insight IA</h3><p>Los ganadores muestran textura real antes del segundo 2 y objeción explícita. El siguiente test debe ser estático con producto grande y frase de negación.</p>
      <button>Crear lote desde ganadores <ArrowRight size={15} /></button>
    </aside>
  </div>;
}

function CreativeView() {
  return <div className={styles.analysisScreen}>
    <section className={styles.analysisEntry}>
      <article>
        <UploadCloud size={22} />
        <h3>Nuevo análisis</h3>
        <p>Sube video o imagen. La IA extrae estructura, psicología, guion, señales y variantes replicables.</p>
        <div><button>Subir video</button><button>Subir imagen</button></div>
      </article>
      <article>
        <Brain size={22} />
        <h3>Análisis anteriores</h3>
        <p>Reabre resultados guardados por marca, score o formato para convertirlos en nuevos estáticos.</p>
        <div className={styles.analysisLibrary}><span>CREM07 · 76</span><span>CREM02 · 81</span><span>FI27 · 74</span></div>
      </article>
    </section>
    <section className={styles.darkAnalysis}>
      <header><div><span>Resultado profundo</span><b>Proyecto IA</b></div><button><ClipboardCopy size={15} /> Copiar todo el análisis</button></header>
      <section className={styles.verdictCard}>
        <div className={styles.scoreRing}><b>76</b><span>/100</span><small>Alto potencial</small></div>
        <div><span>Por qué funciona</span><h2>Funciona porque ataca la razón número uno por la que nadie compra: “parece calcomanía”, y luego demuestra piel real.</h2></div>
      </section>
      <nav className={styles.analysisTabs} aria-label="Capas del análisis">
        {analysisTabs.map((tab, index) => <button key={tab} className={index === 0 ? styles.selected : ""}>{tab}</button>)}
      </nav>
      <section className={styles.signalGrid}>
        <article><Zap size={16} /><b>Detiene el scroll</b><em>Alto</em><p>La aplicación en seco del dedo es visualmente inusual y llama la atención inmediato.</p></article>
        <article><Eye size={16} /><b>Se entiende al instante</b><em>Alto</em><p>Desde el segundo 0 queda claro qué venden y cuál es la promesa.</p></article>
        <article><CircleDollarSign size={16} /><b>Oferta convincente</b><em>Medio</em><p>La promesa es fuerte, pero faltan precio visible e incentivo concreto.</p></article>
      </section>
    </section>
    <section className={styles.analysisGrid}>
      <article><h3>La receta ganadora</h3>{recipe.map((item, index) => <p key={item}><b>{index + 1}.</b>{item}</p>)}</article>
      <article><h3>Qué mantener</h3><p><Check size={14} /> Hook con objeción principal en los primeros 2 segundos.</p><p><Check size={14} /> B-roll del producto en contexto social real.</p><p><Check size={14} /> Cierre emocional: libertad sin compromisos.</p></article>
      <article><h3>Psicología del anuncio</h3><p>El creativo reduce riesgo percibido, rompe una creencia negativa y convierte la prueba visual en permiso emocional para comprar.</p><p><b>Deseo activado:</b> verse bien sin compromiso permanente.</p></article>
      <article><h3>Variantes sugeridas</h3>{variants.map(([title, axis, copy]) => <p key={title}><b>{title}</b>{axis}: {copy}</p>)}</article>
      <article><h3>Guion y estructura</h3><p><b>0-2s</b>Objeción directa y prueba visual.</p><p><b>3-7s</b>Demostración del mecanismo con textura real.</p><p><b>8-12s</b>Oferta, garantía y cierre emocional.</p></article>
      <article><h3>Qué producir después</h3><p><Check size={14} /> 5 estáticos con el claim ganador.</p><p><Check size={14} /> 3 hooks de objeción para video corto.</p><p><Check size={14} /> 1 comparativo antes/después con prueba social.</p></article>
      <article className={styles.wideCard}><h3>Prompt para producir variantes</h3><p>Crear cinco estáticos 4:5 basados en el patrón ganador: objeción visible, piel real, producto protagonista, claim honesto y CTA directo. Mantener estética premium y evitar promesas médicas.</p></article>
    </section>
  </div>;
}

function StaticView() {
  return <div className={styles.staticScreen}>
    <section className={styles.staticControls}>
      <div className={styles.brandReady}><span>SK</span><div><b>SKINGLOW está detrás del brief</b><small>15 activos · contexto automático habilitado</small></div><Check size={16} /></div>
      <div className={styles.studioModes}>{studioModes.map(([title, copy], index) => <button key={title} className={index === 1 ? styles.selected : ""}><b>{title}</b><small>{copy}</small></button>)}</div>
      <section><div className={styles.stepTitle}><span>01</span><div><h3>Dirección creativa</h3><p>Pega la respuesta del brief madre o describe la idea.</p></div><button><ClipboardCopy size={14} /> Brief madre</button></div><textarea placeholder="Cuenta qué quieres comunicar, a quién y qué debería entender en dos segundos..." /></section>
      <section><div className={styles.stepTitle}><span>02</span><div><h3>Biblioteca de formatos y referencias</h3><p>Usa referencias madre guardadas, sube nuevas o añade inspiración para esta ejecución.</p></div></div><div className={styles.referenceModes}><button className={styles.selected}>Automático<small>La IA elige formatos</small></button><button>Elegir<small>Tú decides referencias</small></button><button>Sin refs<small>Solo memoria y prompt</small></button></div><div className={styles.referenceBank}><b>REFERENCIAS MADRE · 12 SUBIDAS · 9 ANALIZADAS</b><div><button>Ver galería</button><button>Analizar pendientes</button><button>Subir a biblioteca</button></div></div></section>
      <section><div className={styles.stepTitle}><span>03</span><div><h3>Ajustes mínimos</h3><p>Ángulo, conciencia, formato, calidad y número de variantes.</p></div></div><div className={styles.settingsGrid}><button>4:5</button><button>Oferta</button><button>Producción</button><button>5 variantes</button></div></section>
      <button className={styles.generateButton}><WandSparkles size={17} /> Generar creativo</button>
    </section>
    <aside className={styles.staticPreview}>
      <div className={styles.canvasHead}><span>LIENZO / 4:5</span><button><ArrowDownToLine size={15} /> Descargar</button></div>
      <div className={styles.adMock}><h2>Cuando descubres que sí existe.</h2><div className={styles.productOrb}>Skinglow</div><p>¿EN VERDAAD???</p></div>
      <div className={styles.editBox}><b>EDITAR ESTA VERSIÓN</b><button><RefreshCw size={14} /> Otra versión</button><div>Dile al diseñador qué cambiar... <button><Send size={14} /></button></div></div>
      <div className={styles.outputStrip}><span>01</span><span>02</span><span>03</span><span>04</span><span>05</span></div>
    </aside>
  </div>;
}

function BrandsView() {
  return <div className={styles.brandsScreen}>
    <section className={styles.brandSummary}><h2>Skinglow</h2><p>La memoria madre alimenta análisis, chat, Meta y generación de estáticos.</p><div><i style={{ width: "88%" }} /></div><span>88% completa</span></section>
    <section className={styles.brandMatrix}>{brandSections.map(([title, copy]) => <article key={title}><Check size={15} /><b>{title}</b><p>{copy}</p></article>)}</section>
    <aside className={styles.creatorRules}><Filter size={18} /><h3>Filtro de producción</h3><label><input type="radio" defaultChecked /> La fundadora aparece en cámara</label><label><input type="radio" /> Equipo interno graba</label><label><input type="radio" /> UGC externo</label><label><input type="radio" /> No delegar, solo producto/estáticos</label></aside>
  </div>;
}

function AccountView({ setView }: { setView: (view: View) => void }) {
  return <div className={styles.accountScreen}>
    <section><WalletCards size={24} /><h2>1,248 créditos</h2><p>Saldo compartido para análisis, Meta y estáticos.</p><button>Abonar saldo</button></section>
    <section><ShieldCheck size={24} /><h2>Skool activo</h2><p>Acceso ligado a membresía. Si vence, se bloquea creación y consumo.</p><span>Última validación: hoy 11:42</span></section>
    <section><LockKeyhole size={24} /><h2>Panel dueña</h2><p>Ver usuarios, saldos, recargas, uso y estado de membresía.</p><button onClick={() => setView("admin")}>Abrir admin</button></section>
  </div>;
}

function AdminView() {
  return <div className={styles.adminScreen}>
    <section className={styles.adminHeader}>
      <div><span>Vista interna</span><h2>Control de créditos y acceso</h2><p>La dueña ve quién puede entrar, cuánto saldo tiene, cuánto consume y si el margen sigue sano.</p></div>
      <button><ShieldCheck size={15} /> Exportar reporte</button>
    </section>
    <section className={styles.adminKpis}>
      <article><span>MRR Skool</span><b>$1,178</b><small>62 miembros activos · $19</small></article>
      <article><span>Recargas</span><b>$420</b><small>42 recargas de $10</small></article>
      <article><span>Costo IA</span><b>$96</b><small>límite operativo mensual</small></article>
      <article><span>Margen estimado</span><b>84%</b><small>después de consumo IA</small></article>
    </section>
    <section className={styles.adminMain}>
      <article className={styles.adminTable}>
        <header><b>Usuarios y saldo</b><span>Control para que el consumo no se vaya de las manos</span></header>
        {adminUsers.map(([name, access, paid, credits, cost, status]) => <div key={name}>
          <strong>{name}</strong><span>{access}</span><span>{paid}</span><span>{credits}</span><span>{cost}</span><em>{status}</em>
        </div>)}
      </article>
      <aside className={styles.creditPolicy}>
        <h3>Reglas recomendadas</h3>
        <p><Check size={14} /> Recarga mínima: $10 = 1,000 créditos.</p>
        <p><Check size={14} /> Bono incluido por Skool: 300 créditos/mes.</p>
        <p><Check size={14} /> El bono debe costar máximo $3 en IA.</p>
        <p><Check size={14} /> Si Skool está inactivo: solo lectura, sin consumir IA.</p>
        <p><Check size={14} /> Alertas cuando un usuario consuma más de $2.50 sin recargar.</p>
      </aside>
    </section>
    <section className={styles.ledgerTable}>
      <header><b>Tarifario de créditos</b><span>Lo que ve administración antes de publicar precios</span></header>
      {adminLedger.map(([item, userPrice, value, margin]) => <article key={item}>
        <strong>{item}</strong><span>{userPrice}</span><span>{value}</span><em>{margin}</em>
      </article>)}
    </section>
  </div>;
}
