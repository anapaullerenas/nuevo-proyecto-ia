create sequence if not exists public.recharge_folio_seq start 1;
create table if not exists public.recharge_requests (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique default ('R-'||lpad(nextval('public.recharge_folio_seq')::text,4,'0')),
  user_id uuid not null references auth.users(id) on delete cascade,
  package text not null check(package in ('impulso','crecimiento','estudio')),
  amount_usd numeric(10,2) not null,
  credits integer not null,
  status text not null default 'pendiente' check(status in ('pendiente','aprobada','rechazada','expirada')),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);
create unique index if not exists recharge_one_pending_idx on public.recharge_requests(user_id) where status='pendiente';
create index if not exists recharge_status_created_idx on public.recharge_requests(status,created_at desc);
alter table public.recharge_requests enable row level security;
drop policy if exists "recharge_select_own" on public.recharge_requests;
create policy "recharge_select_own" on public.recharge_requests for select using(auth.uid()=user_id);

create or replace function public.approve_recharge(p_request_id uuid,p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.recharge_requests%rowtype; result jsonb;
begin
  select * into r from public.recharge_requests where id=p_request_id for update;
  if not found then raise exception 'recharge_not_found'; end if;
  if r.status<>'pendiente' then raise exception 'recharge_already_resolved'; end if;
  update public.recharge_requests set status='aprobada',resolved_at=now(),resolved_by=p_admin_id where id=r.id;
  result:=public.grant_credits(r.user_id,r.credits,'recharge',jsonb_build_object('folio',r.folio,'amount_usd',r.amount_usd,'package',r.package,'provider','manual','model','manual','input_tokens',0,'output_tokens',0,'images',0,'cost_usd',0));
  return result||jsonb_build_object('folio',r.folio,'credits',r.credits);
end; $$;
revoke all on function public.approve_recharge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_recharge(uuid,uuid) to service_role;
