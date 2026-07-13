create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'creative-assets',
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  kind text not null default 'product_photo' check (kind in ('product_photo', 'logo', 'winner_ad', 'style_reference')),
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.static_archetypes (
  id text primary key,
  name text not null,
  label_visible text not null,
  stage text not null,
  structure jsonb not null default '{}'::jsonb,
  prompt_fragment text not null,
  thumbnail_path text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.static_creatives
  alter column storage_path drop not null,
  alter column prompt drop not null;

alter table public.static_creatives
  add column if not exists ficha jsonb not null default '{}'::jsonb,
  add column if not exists archetype text,
  add column if not exists format text,
  add column if not exists funnel_stage text,
  add column if not exists quality text not null default 'medium',
  add column if not exists version integer not null default 1,
  add column if not exists parent_id uuid references public.static_creatives(id) on delete set null,
  add column if not exists qa_report jsonb not null default '{}'::jsonb;

alter table public.static_creatives drop constraint if exists static_creatives_status_check;
alter table public.static_creatives
  add constraint static_creatives_status_check
  check (status in ('brief', 'generated', 'edited', 'downloaded', 'archived', 'failed'));

alter table public.brand_assets enable row level security;
alter table public.static_archetypes enable row level security;

drop policy if exists "brand_assets_owner_all" on public.brand_assets;
create policy "brand_assets_owner_all" on public.brand_assets
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "static_archetypes_authenticated_read" on public.static_archetypes;
create policy "static_archetypes_authenticated_read" on public.static_archetypes
for select using (auth.uid() is not null);

create index if not exists brand_assets_brand_created_idx on public.brand_assets (brand_id, created_at desc);
create index if not exists static_creatives_status_idx on public.static_creatives (brand_id, status, created_at desc);

insert into public.static_archetypes (id, name, label_visible, stage, structure, prompt_fragment, sort_order)
values
  (
    'oferta_directa',
    'Oferta directa',
    'Promo clara',
    'Conversión',
    '{"zones":{"top":"promesa o promocion","middle":"producto heroe","bottom":"cta visible"},"best_for":"precio, descuento, bono o urgencia"}',
    'Oferta directa: producto protagonista, promo inmediata, pocas palabras, contraste alto y CTA visible.',
    10
  ),
  (
    'testimonio_chat',
    'Testimonio/chat',
    'Prueba social',
    'Retargeting',
    '{"zones":{"top":"frase real de cliente","middle":"captura o burbuja social","bottom":"producto + cta"},"best_for":"reseñas, dudas, objeciones y prueba social"}',
    'Testimonio/chat: composición nativa tipo mensaje o reseña, prueba social creíble, sensación de recomendación.',
    20
  ),
  (
    'before_after',
    'Before/After',
    'Antes y después',
    'Consideración',
    '{"zones":{"left":"antes o problema","right":"despues o resultado","bottom":"mecanismo + cta"},"best_for":"transformación visible"}',
    'Before/After: contraste visual limpio entre problema y resultado, etiquetas cortas y producto como puente.',
    30
  ),
  (
    'us_vs_them',
    'Us vs Them',
    'Comparativa',
    'Consideración',
    '{"zones":{"left":"alternativa inferior","right":"tu marca","bottom":"diferenciador"},"best_for":"mercados con competencia o soluciones confusas"}',
    'Us vs Them: dos columnas, diferencias obvias, bullets muy cortos y superioridad concreta sin exagerar.',
    40
  ),
  (
    'beneficios_apilados',
    'Beneficios apilados',
    'Beneficios',
    'Consideración',
    '{"zones":{"center":"producto","around":"3 callouts","bottom":"cta"},"best_for":"productos con varias razones de compra"}',
    'Beneficios apilados: producto al centro con 3 callouts legibles, flechas sutiles y jerarquía rápida.',
    50
  ),
  (
    'problema_solucion',
    'Problema a solución',
    'Problema-solución',
    'Descubrimiento',
    '{"zones":{"top":"tension o dolor","middle":"producto como mecanismo","bottom":"alivio/beneficio"},"best_for":"audiencia consciente del problema"}',
    'Problema-solución: tensión visual arriba, producto como puente y alivio claro abajo.',
    60
  ),
  (
    'ugc_casual',
    'UGC casual',
    'Nativo UGC',
    'Descubrimiento',
    '{"zones":{"background":"foto realista","overlay":"caption corto","corner":"producto o prueba"},"best_for":"que parezca contenido, no anuncio"}',
    'UGC casual: estética de contenido real, encuadre natural, texto tipo caption y producto integrado.',
    70
  ),
  (
    'editorial_premium',
    'Editorial premium',
    'Editorial',
    'Descubrimiento',
    '{"zones":{"hero":"producto o persona aspiracional","text":"frase mínima","bottom":"marca/cta discreto"},"best_for":"marcas aspiracionales o ticket alto"}',
    'Editorial premium: mucho aire, composición refinada, pocas palabras y sensación de marca elevada.',
    80
  ),
  (
    'prueba_social_masiva',
    'Prueba social masiva',
    'Comunidad',
    'Retargeting',
    '{"zones":{"top":"numero o prueba","middle":"reseñas/estrellas","bottom":"producto + cta"},"best_for":"validación, comunidad, cantidad de clientas"}',
    'Prueba social masiva: número grande, reseñas condensadas y producto visible como consecuencia de confianza.',
    90
  ),
  (
    'urgencia_escasez',
    'Urgencia/escasez',
    'Urgencia',
    'Conversión',
    '{"zones":{"top":"tiempo/stock","middle":"oferta","bottom":"cta"},"best_for":"cierre de promo, último día, cupos o stock"}',
    'Urgencia/escasez: deadline claro, oferta concreta, tensión amable y CTA sin fricción.',
    100
  ),
  (
    'razones_listicle',
    'Razones',
    '3 razones',
    'Consideración',
    '{"zones":{"top":"titulo listicle","middle":"3 razones","bottom":"producto + cta"},"best_for":"educar rápido y ordenar beneficios"}',
    'Razones/listicle: titular tipo lista, 3 puntos escaneables y producto visible para anclar la promesa.',
    110
  ),
  (
    'meme_nativo',
    'Meme/nativo',
    'Scroll-stop',
    'Descubrimiento',
    '{"zones":{"top":"frase cultural o tensión","middle":"visual nativo","bottom":"giro de marca"},"best_for":"romper patrón sin perder claridad"}',
    'Meme/nativo: formato familiar de red social, giro inteligente y relación clara con el producto.',
    120
  )
on conflict (id) do update
set
  name = excluded.name,
  label_visible = excluded.label_visible,
  stage = excluded.stage,
  structure = excluded.structure,
  prompt_fragment = excluded.prompt_fragment,
  sort_order = excluded.sort_order,
  active = true;
