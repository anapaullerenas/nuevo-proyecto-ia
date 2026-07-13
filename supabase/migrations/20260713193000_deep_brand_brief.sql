alter table public.brands
  add column if not exists strategic_context jsonb not null default '{}'::jsonb;
